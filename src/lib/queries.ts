import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import {
  accounts,
  dayJournals,
  imports,
  instruments,
  ledgerEntries,
  mistakeTags,
  playbookRules,
  playbooks,
  screenshots,
  sessionDefs,
  settings,
  trades,
  type Account,
  type DayJournal,
  type Trade,
} from '@/lib/db/schema';
import { DEFAULT_INSTRUMENTS, DEFAULT_MISTAKE_TAGS, DEFAULT_SESSIONS, FEE_KINDS } from '@/lib/defaults';

export const ACCOUNT_COOKIE = 'tj_account';

let bootstrapped = false;

/** Seeds the reference tables (instruments, sessions, tags, settings row) exactly once. */
export async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped) return;
  await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing();
  await db.insert(instruments).values(DEFAULT_INSTRUMENTS).onConflictDoNothing();
  await db.insert(sessionDefs).values(DEFAULT_SESSIONS).onConflictDoNothing();
  const existingTags = await db.select({ id: mistakeTags.id }).from(mistakeTags).limit(1);
  if (!existingTags.length) {
    await db.insert(mistakeTags).values(DEFAULT_MISTAKE_TAGS.map((name, i) => ({ name, sortOrder: i })));
  }
  bootstrapped = true;
}

export async function getSettings() {
  await ensureBootstrapped();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row ?? { id: 1, timezone: 'Australia/Sydney', beBandR: 0.09, lastSymbol: null, lastAccountId: null, updatedAt: new Date() };
}

export async function getAccounts(): Promise<Account[]> {
  await ensureBootstrapped();
  return db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.id));
}

export async function getAccount(id: number): Promise<Account | undefined> {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
  return row;
}

export async function getSessionDefs() {
  await ensureBootstrapped();
  return db.select().from(sessionDefs).orderBy(asc(sessionDefs.sortOrder));
}

export async function getInstruments() {
  await ensureBootstrapped();
  return db.select().from(instruments).orderBy(asc(instruments.sortOrder), asc(instruments.symbol));
}

export async function getPlaybooks() {
  return db.select().from(playbooks).orderBy(asc(playbooks.id));
}

export async function getPlaybookRules() {
  return db.select().from(playbookRules).orderBy(asc(playbookRules.sortOrder), asc(playbookRules.id));
}

export async function getMistakeTags() {
  await ensureBootstrapped();
  return db.select().from(mistakeTags).orderBy(asc(mistakeTags.sortOrder), asc(mistakeTags.id));
}

/** Which account the header dropdown currently points at. `null` means "All accounts". */
export async function getSelectedAccountId(all: Account[]): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(ACCOUNT_COOKIE)?.value;
  if (raw === 'all') return null;
  const id = Number(raw);
  if (Number.isFinite(id) && all.some((a) => a.id === id)) return id;
  const firstActive = all.find((a) => a.status === 'ACTIVE') ?? all[0];
  return firstActive?.id ?? null;
}

export type Scope = {
  accounts: Account[];
  account: Account | null;
  accountIds: number[];
  isAll: boolean;
};

export async function getScope(): Promise<Scope> {
  const all = await getAccounts();
  const selected = await getSelectedAccountId(all);
  const account = selected == null ? null : (all.find((a) => a.id === selected) ?? null);
  return {
    accounts: all,
    account,
    accountIds: account ? [account.id] : all.map((a) => a.id),
    isAll: account == null,
  };
}

export type TradeFilter = {
  accountIds: number[];
  from?: string;
  to?: string;
  includeHidden?: boolean;
};

export async function getTrades(filter: TradeFilter): Promise<Trade[]> {
  if (!filter.accountIds.length) return [];
  const where = [inArray(trades.accountId, filter.accountIds)];
  if (filter.from) where.push(gte(trades.tradeDate, filter.from));
  if (filter.to) where.push(lte(trades.tradeDate, filter.to));
  if (!filter.includeHidden) where.push(eq(trades.hidden, false));
  const rows = await db
    .select()
    .from(trades)
    .where(and(...where))
    .orderBy(asc(trades.openedAt));
  if (filter.includeHidden) return rows;
  const hidden = await getHiddenDays(filter.accountIds);
  return rows.filter((t) => !hidden.has(`${t.accountId}|${t.tradeDate}`));
}

export async function getHiddenDays(accountIds: number[]): Promise<Set<string>> {
  if (!accountIds.length) return new Set();
  const rows = await db
    .select({ accountId: dayJournals.accountId, date: dayJournals.date })
    .from(dayJournals)
    .where(and(inArray(dayJournals.accountId, accountIds), eq(dayJournals.hidden, true)));
  return new Set(rows.map((r) => `${r.accountId}|${r.date}`));
}

export async function getHiddenDayCount(accountIds: number[]): Promise<number> {
  return (await getHiddenDays(accountIds)).size;
}

export async function getJournals(accountIds: number[], from?: string, to?: string): Promise<DayJournal[]> {
  if (!accountIds.length) return [];
  const where = [inArray(dayJournals.accountId, accountIds)];
  if (from) where.push(gte(dayJournals.date, from));
  if (to) where.push(lte(dayJournals.date, to));
  return db
    .select()
    .from(dayJournals)
    .where(and(...where))
    .orderBy(asc(dayJournals.date));
}

export async function getJournal(accountId: number, date: string): Promise<DayJournal | undefined> {
  const [row] = await db
    .select()
    .from(dayJournals)
    .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)));
  return row;
}

export async function getLedger(accountIds: number[]) {
  if (!accountIds.length) return [];
  return db
    .select()
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.accountId, accountIds))
    .orderBy(desc(ledgerEntries.date), desc(ledgerEntries.id));
}

export async function getScreenshots(accountIds: number[], date?: string) {
  if (!accountIds.length) return [];
  const where = [inArray(screenshots.accountId, accountIds)];
  if (date) where.push(eq(screenshots.tradeDate, date));
  return db
    .select({
      id: screenshots.id,
      tradeId: screenshots.tradeId,
      accountId: screenshots.accountId,
      tradeDate: screenshots.tradeDate,
      url: screenshots.url,
      caption: screenshots.caption,
      createdAt: screenshots.createdAt,
    })
    .from(screenshots)
    .where(and(...where))
    .orderBy(desc(screenshots.id));
}

export async function getImports(accountIds: number[]) {
  if (!accountIds.length) return [];
  return db.select().from(imports).where(inArray(imports.accountId, accountIds)).orderBy(desc(imports.id));
}

export type AccountMoney = {
  accountId: number;
  netPnl: number;
  fees: number;
  payouts: number;
  deposits: number;
  withdrawals: number;
  balance: number;
  /** Payouts + refunds - all fees, for prop books. */
  netOnSpend: number;
};

export async function getAccountMoney(list: Account[]): Promise<Map<number, AccountMoney>> {
  const ids = list.map((a) => a.id);
  const result = new Map<number, AccountMoney>();
  for (const a of list) {
    result.set(a.id, {
      accountId: a.id,
      netPnl: 0,
      fees: 0,
      payouts: 0,
      deposits: 0,
      withdrawals: 0,
      balance: a.type === 'PROP' ? (a.accountSize ?? a.startingBalance) : a.startingBalance,
      netOnSpend: 0,
    });
  }
  if (!ids.length) return result;

  const pnlRows = await db
    .select({ accountId: trades.accountId, total: sql<number>`coalesce(sum(${trades.pnl}), 0)` })
    .from(trades)
    .where(and(inArray(trades.accountId, ids), eq(trades.hidden, false)))
    .groupBy(trades.accountId);
  for (const row of pnlRows) {
    const m = result.get(row.accountId);
    if (m) m.netPnl = Number(row.total);
  }

  const ledgerRows = await db
    .select({
      accountId: ledgerEntries.accountId,
      kind: ledgerEntries.kind,
      total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)`,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.accountId, ids))
    .groupBy(ledgerEntries.accountId, ledgerEntries.kind);
  for (const row of ledgerRows) {
    const m = result.get(row.accountId);
    if (!m) continue;
    const amount = Number(row.total);
    if (FEE_KINDS.includes(row.kind)) m.fees += amount;
    else if (row.kind === 'PAYOUT') m.payouts += amount;
    else if (row.kind === 'DEPOSIT') m.deposits += amount;
    else if (row.kind === 'WITHDRAWAL') m.withdrawals += amount;
  }

  for (const a of list) {
    const m = result.get(a.id)!;
    if (a.type === 'PROP') {
      m.balance = (a.accountSize ?? 0) + m.netPnl - m.payouts;
      m.netOnSpend = m.payouts - m.fees;
    } else {
      m.balance = a.startingBalance + m.deposits - m.withdrawals + m.netPnl;
      m.netOnSpend = m.netPnl;
    }
  }
  return result;
}

export function groupAccounts(list: Account[]) {
  const groups: { label: string; accounts: Account[] }[] = [
    { label: 'Active', accounts: [] },
    { label: 'Funded', accounts: [] },
    { label: 'Evals', accounts: [] },
    { label: 'Personal', accounts: [] },
    { label: 'Blown / archived', accounts: [] },
  ];
  const byLabel = (label: string) => groups.find((g) => g.label === label)!;
  for (const a of list) {
    if (a.status === 'ARCHIVED' || a.stage === 'BLOWN') byLabel('Blown / archived').accounts.push(a);
    else if (a.type === 'PERSONAL') byLabel('Personal').accounts.push(a);
    else if (a.stage === 'FUNDED') byLabel('Funded').accounts.push(a);
    else if (a.stage === 'EVAL') byLabel('Evals').accounts.push(a);
    else byLabel('Active').accounts.push(a);
  }
  return groups.filter((g) => g.accounts.length);
}
