import 'server-only';
import { cache } from 'react';
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
import {
  DEFAULT_CHECKLIST,
  DEFAULT_INSTRUMENTS,
  DEFAULT_MISTAKE_TAGS,
  DEFAULT_SESSION_ALIASES,
  DEFAULT_SESSIONS,
  FEE_KINDS,
  SEEDED_INSTRUMENT_ALIASES,
} from '@/lib/defaults';

export const ACCOUNT_COOKIE = 'tj_account';

let bootstrapTask: Promise<void> | null = null;

/** Seeds the reference tables (instruments, sessions, tags, settings row) exactly once. */
export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapTask) {
    bootstrapTask = runBootstrap().catch((error) => {
      bootstrapTask = null;
      throw error;
    });
  }
  return bootstrapTask;
}

async function runBootstrap(): Promise<void> {
  await Promise.all([
    db.insert(settings).values({ id: 1 }).onConflictDoNothing(),
    db.insert(instruments).values(DEFAULT_INSTRUMENTS).onConflictDoNothing(),
    db.insert(sessionDefs).values(DEFAULT_SESSIONS).onConflictDoNothing(),
  ]);

  const [existingTags, specs, sessionRows, configRows] = await Promise.all([
    db.select({ id: mistakeTags.id, name: mistakeTags.name }).from(mistakeTags).orderBy(asc(mistakeTags.id)),
    db.select().from(instruments),
    db.select().from(sessionDefs),
    db.select().from(settings).where(eq(settings.id, 1)),
  ]);

  const seen = new Set<string>();
  const duplicateIds: number[] = [];
  for (const tag of existingTags) {
    const key = tag.name.toLowerCase();
    if (seen.has(key)) duplicateIds.push(tag.id);
    else seen.add(key);
  }
  const missing = DEFAULT_MISTAKE_TAGS.filter((name) => !seen.has(name.toLowerCase()));
  const config = configRows[0];
  const writes: Promise<unknown>[] = [];
  if (duplicateIds.length) writes.push(db.delete(mistakeTags).where(inArray(mistakeTags.id, duplicateIds)));
  if (missing.length) {
    writes.push(
      db
        .insert(mistakeTags)
        .values(missing.map((name, i) => ({ name, sortOrder: existingTags.length + i })))
        .onConflictDoNothing(),
    );
  }
  for (const spec of specs) {
    const seeded = SEEDED_INSTRUMENT_ALIASES[spec.symbol];
    if (seeded && (!spec.aliases || spec.aliases.length === 0)) {
      writes.push(db.update(instruments).set({ aliases: seeded }).where(eq(instruments.symbol, spec.symbol)));
    }
  }
  for (const session of sessionRows) {
    const aliases = DEFAULT_SESSION_ALIASES[session.key];
    if (aliases && (!session.aliases || session.aliases.length === 0)) {
      writes.push(db.update(sessionDefs).set({ aliases }).where(eq(sessionDefs.key, session.key)));
    }
  }
  if (config && (!config.checklistItems || config.checklistItems.length === 0)) {
    writes.push(
      db.update(settings).set({ checklistItems: DEFAULT_CHECKLIST, checklistSkipIfNo: 2 }).where(eq(settings.id, 1)),
    );
  }
  if (writes.length) await Promise.all(writes);
  await ensureQuickLog();
}

async function ensureQuickLog() {
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.isQuickLog, true)).limit(1);
  if (existing) return;
  await db.insert(accounts).values({
    name: 'Quick log',
    type: 'PERSONAL',
    status: 'ACTIVE',
    startingBalance: 0,
    startDate: new Date().toISOString().slice(0, 10),
    isQuickLog: true,
    sortOrder: 1000,
    notes: 'Trades logged without a prop or personal account.',
  });
}

function idKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(',');
}

export const getSettings = cache(async () => {
  await ensureBootstrapped();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return (
    row ?? {
      id: 1,
      timezone: 'Australia/Sydney',
      beBandR: 0.09,
      rRounding: 0,
      checklistItems: [] as string[],
      checklistSkipIfNo: 2,
      lastSymbol: null,
      lastAccountId: null,
      tradeEntryMode: 'quick' as const,
      updatedAt: new Date(),
    }
  );
});

export const getAccounts = cache(async (): Promise<Account[]> => {
  await ensureBootstrapped();
  return db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.id));
});

export async function getAccount(id: number): Promise<Account | undefined> {
  const all = await getAccounts();
  return all.find((account) => account.id === id);
}

export const getSessionDefs = cache(async () => {
  await ensureBootstrapped();
  return db.select().from(sessionDefs).orderBy(asc(sessionDefs.sortOrder));
});

export const getInstruments = cache(async () => {
  await ensureBootstrapped();
  return db.select().from(instruments).orderBy(asc(instruments.sortOrder), asc(instruments.symbol));
});

export const getPlaybooks = cache(async () => {
  return db.select().from(playbooks).orderBy(asc(playbooks.id));
});

export const getPlaybookRules = cache(async () => {
  return db.select().from(playbookRules).orderBy(asc(playbookRules.sortOrder), asc(playbookRules.id));
});

export const getMistakeTags = cache(async () => {
  await ensureBootstrapped();
  return db.select().from(mistakeTags).orderBy(asc(mistakeTags.sortOrder), asc(mistakeTags.id));
});

/** Which account the header dropdown currently points at. `null` means "All accounts". */
export async function getSelectedAccountId(all: Account[]): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(ACCOUNT_COOKIE)?.value;
  if (raw === 'all') return null;
  const id = Number(raw);
  if (Number.isFinite(id) && all.some((a) => a.id === id)) return id;
  const firstActive = all.find((a) => a.status === 'ACTIVE' && !a.isQuickLog) ?? all.find((a) => !a.isQuickLog) ?? all[0];
  return firstActive?.id ?? null;
}

export type Scope = {
  accounts: Account[];
  account: Account | null;
  accountIds: number[];
  isAll: boolean;
};

export const getScope = cache(async (): Promise<Scope> => {
  const all = await getAccounts();
  const selected = await getSelectedAccountId(all);
  const account = selected == null ? null : (all.find((a) => a.id === selected) ?? null);
  return {
    accounts: all,
    account,
    accountIds: account ? [account.id] : all.map((a) => a.id),
    isAll: account == null,
  };
});

export type TradeFilter = {
  accountIds: number[];
  from?: string;
  to?: string;
  includeHidden?: boolean;
};

const loadTrades = cache(async (key: string): Promise<Trade[]> => {
  const parsed = JSON.parse(key) as { ids: string; from: string; to: string; includeHidden: boolean };
  const accountIds = parsed.ids ? parsed.ids.split(',').map(Number) : [];
  if (!accountIds.length) return [];
  const where = [inArray(trades.accountId, accountIds)];
  if (parsed.from) where.push(gte(trades.tradeDate, parsed.from));
  if (parsed.to) where.push(lte(trades.tradeDate, parsed.to));
  if (!parsed.includeHidden) where.push(eq(trades.hidden, false));
  const rowsPromise = db.select().from(trades).where(and(...where)).orderBy(asc(trades.openedAt));
  if (parsed.includeHidden) return rowsPromise;
  const [rows, hidden] = await Promise.all([rowsPromise, getHiddenDays(accountIds)]);
  return rows.filter((t) => !hidden.has(`${t.accountId}|${t.tradeDate}`));
});

export function getTrades(filter: TradeFilter): Promise<Trade[]> {
  return loadTrades(
    JSON.stringify({
      ids: idKey(filter.accountIds),
      from: filter.from ?? '',
      to: filter.to ?? '',
      includeHidden: Boolean(filter.includeHidden),
    }),
  );
}

const loadHiddenDays = cache(async (key: string): Promise<Set<string>> => {
  if (!key) return new Set();
  const accountIds = key.split(',').map(Number);
  const rows = await db
    .select({ accountId: dayJournals.accountId, date: dayJournals.date })
    .from(dayJournals)
    .where(and(inArray(dayJournals.accountId, accountIds), eq(dayJournals.hidden, true)));
  return new Set(rows.map((r) => `${r.accountId}|${r.date}`));
});

export function getHiddenDays(accountIds: number[]): Promise<Set<string>> {
  return loadHiddenDays(idKey(accountIds));
}

export async function getHiddenDayCount(accountIds: number[]): Promise<number> {
  return (await getHiddenDays(accountIds)).size;
}

const loadJournals = cache(async (key: string): Promise<DayJournal[]> => {
  const parsed = JSON.parse(key) as { ids: string; from: string; to: string };
  const accountIds = parsed.ids ? parsed.ids.split(',').map(Number) : [];
  if (!accountIds.length) return [];
  const where = [inArray(dayJournals.accountId, accountIds)];
  if (parsed.from) where.push(gte(dayJournals.date, parsed.from));
  if (parsed.to) where.push(lte(dayJournals.date, parsed.to));
  return db.select().from(dayJournals).where(and(...where)).orderBy(asc(dayJournals.date));
});

export function getJournals(accountIds: number[], from?: string, to?: string): Promise<DayJournal[]> {
  return loadJournals(JSON.stringify({ ids: idKey(accountIds), from: from ?? '', to: to ?? '' }));
}

export async function getJournal(accountId: number, date: string): Promise<DayJournal | undefined> {
  const [row] = await db
    .select()
    .from(dayJournals)
    .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)));
  return row;
}

const loadLedger = cache(async (key: string) => {
  if (!key) return [];
  const accountIds = key.split(',').map(Number);
  return db
    .select()
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.accountId, accountIds))
    .orderBy(desc(ledgerEntries.date), desc(ledgerEntries.id));
});

export function getLedger(accountIds: number[]) {
  return loadLedger(idKey(accountIds));
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

const loadImports = cache(async (key: string) => {
  if (!key) return [];
  const accountIds = key.split(',').map(Number);
  return db.select().from(imports).where(inArray(imports.accountId, accountIds)).orderBy(desc(imports.id));
});

export function getImports(accountIds: number[]) {
  return loadImports(idKey(accountIds));
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

const loadAccountMoney = cache(async (key: string): Promise<Map<number, AccountMoney>> => {
  const ids = key ? key.split(',').map(Number) : [];
  const list = (await getAccounts()).filter((account) => ids.includes(account.id));
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

  // Hidden days are left out of every number the app shows, including the balance.
  const notOnAHiddenDay = sql`not exists (
    select 1 from ${dayJournals}
    where ${dayJournals.accountId} = ${trades.accountId}
      and ${dayJournals.date} = ${trades.tradeDate}
      and ${dayJournals.hidden}
  )`;

  const [pnlRows, ledgerRows] = await Promise.all([
    db
      .select({ accountId: trades.accountId, total: sql<number>`coalesce(sum(${trades.pnl}), 0)` })
      .from(trades)
      .where(and(inArray(trades.accountId, ids), eq(trades.hidden, false), notOnAHiddenDay))
      .groupBy(trades.accountId),
    db
      .select({
        accountId: ledgerEntries.accountId,
        kind: ledgerEntries.kind,
        total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)`,
      })
      .from(ledgerEntries)
      .where(inArray(ledgerEntries.accountId, ids))
      .groupBy(ledgerEntries.accountId, ledgerEntries.kind),
  ]);
  for (const row of pnlRows) {
    const m = result.get(row.accountId);
    if (m) m.netPnl = Number(row.total);
  }
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
});

export function getAccountMoney(list: Account[]): Promise<Map<number, AccountMoney>> {
  return loadAccountMoney(idKey(list.map((account) => account.id)));
}

export function groupAccounts(list: Account[]) {
  const groups: { label: string; accounts: Account[] }[] = [
    { label: 'Quick log', accounts: [] },
    { label: 'Active', accounts: [] },
    { label: 'Funded', accounts: [] },
    { label: 'Evals', accounts: [] },
    { label: 'Personal', accounts: [] },
    { label: 'Blown / archived', accounts: [] },
  ];
  const byLabel = (label: string) => groups.find((g) => g.label === label)!;
  for (const a of list) {
    if (a.isQuickLog) byLabel('Quick log').accounts.push(a);
    else if (a.status === 'ARCHIVED' || a.stage === 'BLOWN') byLabel('Blown / archived').accounts.push(a);
    else if (a.type === 'PERSONAL') byLabel('Personal').accounts.push(a);
    else if (a.stage === 'FUNDED') byLabel('Funded').accounts.push(a);
    else if (a.stage === 'EVAL') byLabel('Evals').accounts.push(a);
    else byLabel('Active').accounts.push(a);
  }
  return groups.filter((g) => g.accounts.length);
}
