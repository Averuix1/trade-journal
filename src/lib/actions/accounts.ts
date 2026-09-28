'use server';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { accounts, dayJournals, imports, ledgerEntries, screenshots, sessionDefs, trades } from '@/lib/db/schema';
import { DEFAULT_RISK_PRESETS } from '@/lib/defaults';
import { ACCOUNT_COOKIE } from '@/lib/queries';
import { bool, num, recomputeAccount, str, strList, type FormState } from '@/lib/actions/shared';

function parseRiskPresets(raw: string | null): number[] {
  const values = (raw ?? '')
    .split(/[^0-9.]+/)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? values : [...DEFAULT_RISK_PRESETS];
}

export async function selectAccount(formData: FormData) {
  const value = String(formData.get('accountId') ?? 'all');
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, value, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

async function accountValuesFromForm(formData: FormData) {
  const type = (str(formData.get('type')) ?? 'PROP') as 'PROP' | 'PERSONAL';
  const defs = await db.select().from(sessionDefs);
  const chosenSessions = strList(formData, 'sessions');
  const entryWindows: Record<string, number> = {};
  for (const def of defs) {
    const value = num(formData.get(`entryWindow_${def.key}`));
    if (value != null) entryWindows[def.key] = value;
  }
  return {
    name: str(formData.get('name')) ?? 'Untitled account',
    type,
    stage: type === 'PROP' ? ((str(formData.get('stage')) ?? 'EVAL') as 'EVAL' | 'FUNDED' | 'BLOWN') : null,
    firm: type === 'PROP' ? (str(formData.get('firm')) ?? 'Topstep') : null,
    program: type === 'PROP' ? str(formData.get('program')) : null,
    accountSize: type === 'PROP' ? (num(formData.get('accountSize')) ?? 50000) : null,
    startingBalance: type === 'PERSONAL' ? (num(formData.get('startingBalance')) ?? 0) : (num(formData.get('accountSize')) ?? 0),
    targetBalance: num(formData.get('targetBalance')),
    targetDate: str(formData.get('targetDate')),
    startDate: str(formData.get('startDate')) ?? new Date().toISOString().slice(0, 10),
    profitTarget: type === 'PROP' ? num(formData.get('profitTarget')) : null,
    maxDrawdown: type === 'PROP' ? num(formData.get('maxDrawdown')) : null,
    drawdownType: type === 'PROP' ? ((str(formData.get('drawdownType')) ?? 'TRAILING') as 'TRAILING' | 'EOD' | 'STATIC') : null,
    dailyLossLimit: type === 'PROP' ? num(formData.get('dailyLossLimit')) : null,
    consistencyPct: type === 'PROP' ? num(formData.get('consistencyPct')) : null,
    minTradingDays: type === 'PROP' ? num(formData.get('minTradingDays')) : null,
    maxTradesPerSession: num(formData.get('maxTradesPerSession')) ?? 3,
    riskPerTrade: num(formData.get('riskPerTrade')) ?? 300,
    riskPresets: parseRiskPresets(str(formData.get('riskPresets'))),
    activeSessions: chosenSessions.length ? chosenSessions : defs.map((d) => d.key),
    entryWindows,
    notes: str(formData.get('notes')),
  };
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = await accountValuesFromForm(formData);
  if (!values.name) return { error: 'Give the account a name.' };
  const [created] = await db.insert(accounts).values(values).returning({ id: accounts.id });

  const evalFee = num(formData.get('evalFee'));
  if (evalFee) {
    await db.insert(ledgerEntries).values({
      accountId: created.id,
      date: values.startDate,
      kind: 'EVAL_FEE',
      amount: evalFee,
      note: 'Eval fee',
    });
  }
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, String(created.id), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  redirect('/');
}

export async function updateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing account.' };
  const values = await accountValuesFromForm(formData);
  await db.update(accounts).set(values).where(eq(accounts.id, id));
  await recomputeAccount(id);
  redirect('/accounts');
}

export async function updateAccountRules(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing account.' };
  const defs = await db.select().from(sessionDefs);
  const entryWindows: Record<string, number> = {};
  for (const def of defs) {
    const value = num(formData.get(`entryWindow_${def.key}`));
    if (value != null) entryWindows[def.key] = value;
  }
  const chosen = strList(formData, 'sessions');
  await db
    .update(accounts)
    .set({
      maxTradesPerSession: num(formData.get('maxTradesPerSession')) ?? 3,
      riskPerTrade: num(formData.get('riskPerTrade')) ?? 300,
      activeSessions: chosen.length ? chosen : defs.map((d) => d.key),
      entryWindows,
    })
    .where(eq(accounts.id, id));
  await recomputeAccount(id);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Rules saved. Trades re-checked.' };
}

export async function setAccountStage(formData: FormData) {
  const id = Number(formData.get('id'));
  const stage = String(formData.get('stage')) as 'EVAL' | 'FUNDED' | 'BLOWN';
  if (!id) return;
  await db
    .update(accounts)
    .set({ stage, status: stage === 'BLOWN' ? 'ARCHIVED' : 'ACTIVE' })
    .where(eq(accounts.id, id));
  revalidatePath('/', 'layout');
}

export async function setAccountStatus(formData: FormData) {
  const id = Number(formData.get('id'));
  const status = String(formData.get('status')) as 'ACTIVE' | 'ARCHIVED';
  if (!id) return;
  await db.update(accounts).set({ status }).where(eq(accounts.id, id));
  revalidatePath('/', 'layout');
}

/** A reset keeps the blown book and opens a fresh eval that carries the same rules. */
export async function resetAccount(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  const [source] = await db.select().from(accounts).where(eq(accounts.id, id));
  if (!source) return;
  const fee = num(formData.get('resetFee'));
  const startDate = str(formData.get('startDate')) ?? new Date().toISOString().slice(0, 10);
  const nextName = /#(\d+)$/.test(source.name)
    ? source.name.replace(/#(\d+)$/, (_m, n) => `#${Number(n) + 1}`)
    : `${source.name} #2`;

  const [created] = await db
    .insert(accounts)
    .values({
      ...source,
      id: undefined,
      name: nextName,
      stage: 'EVAL',
      status: 'ACTIVE',
      startDate,
      resetOfAccountId: source.id,
      createdAt: undefined,
    })
    .returning({ id: accounts.id });

  if (fee) {
    await db
      .insert(ledgerEntries)
      .values({ accountId: created.id, date: startDate, kind: 'RESET_FEE', amount: fee, note: 'Reset fee' });
  }
  if (bool(formData.get('markBlown'))) {
    await db.update(accounts).set({ stage: 'BLOWN', status: 'ARCHIVED' }).where(eq(accounts.id, source.id));
  }
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, String(created.id), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  redirect('/');
}

export async function deleteAccount(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.delete(screenshots).where(eq(screenshots.accountId, id));
  await db.delete(trades).where(eq(trades.accountId, id));
  await db.delete(dayJournals).where(eq(dayJournals.accountId, id));
  await db.delete(ledgerEntries).where(eq(ledgerEntries.accountId, id));
  await db.delete(imports).where(eq(imports.accountId, id));
  await db.delete(accounts).where(eq(accounts.id, id));
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, 'all', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  redirect('/accounts');
}
