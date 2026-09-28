'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { accounts, instruments, screenshots, settings, trades } from '@/lib/db/schema';
import { autoFees, autoPnl, autoR, rFromRisk, round2 } from '@/lib/calc';
import { tradingDay, zonedInputToUtc } from '@/lib/time';
import { getSettings } from '@/lib/queries';
import { saveScreenshot } from '@/lib/blob';
import { bool, num, numList, recomputeAccountDays, str, strList, type FormState } from '@/lib/actions/shared';

async function buildTradeValues(formData: FormData) {
  const config = await getSettings();
  const accountId = Number(formData.get('accountId'));
  if (!accountId) throw new Error('Pick an account.');
  const symbol = (str(formData.get('symbol')) ?? 'NQ').toUpperCase();
  const [instrument] = await db.select().from(instruments).where(eq(instruments.symbol, symbol));
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error('Pick an account.');
  const pointValue = instrument?.pointValue ?? null;

  const side = (str(formData.get('side')) ?? 'LONG') as 'LONG' | 'SHORT';
  const contracts = num(formData.get('contracts'));
  const plannedRisk = num(formData.get('plannedRisk'));
  const entryPrice = num(formData.get('entryPrice'));
  const stopPrice = num(formData.get('stopPrice'));
  const exitPrice = num(formData.get('exitPrice'));

  const openedInput = str(formData.get('openedAt'));
  if (!openedInput) throw new Error('Set the open time.');
  const openedAt = zonedInputToUtc(openedInput, config.timezone);
  const closedInput = str(formData.get('closedAt'));
  const closedAt = closedInput ? zonedInputToUtc(closedInput, config.timezone) : null;

  const feesOverridden = bool(formData.get('feesOverridden'));
  const canPrice = pointValue != null && contracts != null;
  const fees = feesOverridden
    ? (num(formData.get('fees')) ?? 0)
    : canPrice
      ? autoFees(contracts, instrument?.commissionPerContract ?? 0)
      : 0;

  const pnlOverridden = bool(formData.get('pnlOverridden'));
  const computedPnl = canPrice ? autoPnl(side, entryPrice, exitPrice, contracts, pointValue, fees) : null;
  const pnl = pnlOverridden ? (num(formData.get('pnl')) ?? 0) : (computedPnl ?? num(formData.get('pnl')) ?? 0);

  const priceR = canPrice ? autoR(side, entryPrice, stopPrice, contracts, pointValue, pnl) : null;
  const rMultiple = priceR ?? rFromRisk(pnl, plannedRisk ?? account.riskPerTrade);

  return {
    accountId,
    openedAt,
    closedAt,
    tradeDate: tradingDay(openedAt),
    symbol,
    side,
    contracts,
    plannedRisk,
    timeKnown: true,
    entryPrice,
    stopPrice,
    exitPrice,
    fees: round2(fees),
    feesOverridden,
    pnl: round2(pnl),
    pnlOverridden,
    rMultiple,
    playbookId: num(formData.get('playbookId')),
    brokenRuleIds: numList(formData, 'brokenRuleIds'),
    followedRuleIds: numList(formData, 'followedRuleIds'),
    mistakeTags: strList(formData, 'mistakeTags'),
    hidden: bool(formData.get('hidden')),
    notes: str(formData.get('notes')),
  };
}

async function attachScreenshots(formData: FormData, tradeId: number, accountId: number, tradeDate: string) {
  const files = formData.getAll('screenshots').filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const saved = await saveScreenshot(file);
    await db.insert(screenshots).values({
      tradeId,
      accountId,
      tradeDate,
      url: saved.url,
      blobPath: saved.blobPath,
      data: saved.data,
      contentType: saved.contentType,
    });
  }
}

export async function createTrade(_prev: FormState, formData: FormData): Promise<FormState> {
  let values;
  try {
    values = await buildTradeValues(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save the trade.' };
  }
  const [created] = await db.insert(trades).values(values).returning({ id: trades.id });
  await attachScreenshots(formData, created.id, values.accountId, values.tradeDate);
  await recomputeAccountDays(values.accountId, [values.tradeDate]);
  await db.update(settings).set({ lastSymbol: values.symbol, lastAccountId: values.accountId }).where(eq(settings.id, 1));
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Trade logged.' };
}

export async function updateTrade(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing trade.' };
  const [existing] = await db.select().from(trades).where(eq(trades.id, id));
  if (!existing) return { error: 'Trade not found.' };
  let values;
  try {
    values = await buildTradeValues(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save the trade.' };
  }
  await db.update(trades).set(values).where(eq(trades.id, id));
  await attachScreenshots(formData, id, values.accountId, values.tradeDate);
  await recomputeAccountDays(values.accountId, [values.tradeDate, existing.tradeDate]);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Trade updated.' };
}

export async function deleteTrade(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  const [existing] = await db.select().from(trades).where(eq(trades.id, id));
  if (!existing) return;
  await db.delete(screenshots).where(eq(screenshots.tradeId, id));
  await db.delete(trades).where(eq(trades.id, id));
  await recomputeAccountDays(existing.accountId, [existing.tradeDate]);
  revalidatePath('/', 'layout');
}

export async function toggleTradeHidden(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  const [existing] = await db.select().from(trades).where(eq(trades.id, id));
  if (!existing) return;
  await db.update(trades).set({ hidden: !existing.hidden }).where(eq(trades.id, id));
  await recomputeAccountDays(existing.accountId, [existing.tradeDate]);
  revalidatePath('/', 'layout');
}

/** Re-applies the current commission table to every trade that has not been overridden. */
export async function reapplyCommissions(): Promise<FormState> {
  const specs = await db.select().from(instruments);
  const bySymbol = new Map(specs.map((s) => [s.symbol.toUpperCase(), s]));
  const rows = await db.select().from(trades).where(eq(trades.feesOverridden, false));
  let updated = 0;
  for (const row of rows) {
    const instrument = bySymbol.get(row.symbol.toUpperCase());
    if (!instrument) continue;
    if (row.contracts == null || instrument.pointValue == null) {
      const nextR = rFromRisk(row.pnl, row.plannedRisk);
      if (nextR != null && nextR !== row.rMultiple) {
        await db.update(trades).set({ rMultiple: nextR }).where(eq(trades.id, row.id));
        updated += 1;
      }
      continue;
    }
    const fees = autoFees(row.contracts, instrument.commissionPerContract);
    if (Math.abs(fees - row.fees) < 0.005) continue;
    const pnl = row.pnlOverridden
      ? row.pnl
      : (autoPnl(row.side, row.entryPrice, row.exitPrice, row.contracts, instrument.pointValue, fees) ?? row.pnl);
    const rMultiple =
      autoR(row.side, row.entryPrice, row.stopPrice, row.contracts, instrument.pointValue, pnl) ??
      rFromRisk(pnl, row.plannedRisk) ??
      row.rMultiple;
    await db.update(trades).set({ fees, pnl, rMultiple }).where(eq(trades.id, row.id));
    updated += 1;
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: `${updated} trade(s) updated.` };
}

export async function deleteScreenshot(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.delete(screenshots).where(eq(screenshots.id, id));
  revalidatePath('/', 'layout');
}

export async function addDayScreenshot(_prev: FormState, formData: FormData): Promise<FormState> {
  const accountId = Number(formData.get('accountId'));
  const tradeDate = String(formData.get('date') ?? '');
  if (!accountId || !tradeDate) return { error: 'Missing day.' };
  const files = formData.getAll('screenshots').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: 'Choose an image first.' };
  for (const file of files) {
    const saved = await saveScreenshot(file);
    await db.insert(screenshots).values({
      accountId,
      tradeDate,
      url: saved.url,
      blobPath: saved.blobPath,
      data: saved.data,
      contentType: saved.contentType,
    });
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Screenshot added.' };
}

export async function bulkDeleteTrades(formData: FormData) {
  const ids = numList(formData, 'ids');
  if (!ids.length) return;
  const rows = await db.select().from(trades).where(inArray(trades.id, ids));
  await db.delete(screenshots).where(inArray(screenshots.tradeId, ids));
  await db.delete(trades).where(inArray(trades.id, ids));
  const byAccount = new Map<number, string[]>();
  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push(row.tradeDate);
    byAccount.set(row.accountId, list);
  }
  for (const [accountId, dates] of byAccount) await recomputeAccountDays(accountId, dates);
  revalidatePath('/', 'layout');
}

export async function moveTradesToAccount(formData: FormData) {
  const ids = numList(formData, 'ids');
  const accountId = Number(formData.get('accountId'));
  if (!ids.length || !accountId) return;
  const [target] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!target) return;
  const rows = await db.select().from(trades).where(inArray(trades.id, ids));
  await db.update(trades).set({ accountId }).where(inArray(trades.id, ids));
  await db.update(screenshots).set({ accountId }).where(inArray(screenshots.tradeId, ids));
  for (const row of rows) await recomputeAccountDays(row.accountId, [row.tradeDate]);
  await recomputeAccountDays(
    accountId,
    rows.map((r) => r.tradeDate),
  );
  revalidatePath('/', 'layout');
}

export async function clearTradesForAccount(formData: FormData) {
  const accountId = Number(formData.get('accountId'));
  if (!accountId) return;
  await db.delete(screenshots).where(eq(screenshots.accountId, accountId));
  await db.delete(trades).where(eq(trades.accountId, accountId));
  revalidatePath('/', 'layout');
}

export async function setTradesHiddenForDay(formData: FormData) {
  const accountId = Number(formData.get('accountId'));
  const date = String(formData.get('date') ?? '');
  const hidden = bool(formData.get('hidden'));
  if (!accountId || !date) return;
  await db
    .update(trades)
    .set({ hidden })
    .where(and(eq(trades.accountId, accountId), eq(trades.tradeDate, date)));
  await recomputeAccountDays(accountId, [date]);
  revalidatePath('/', 'layout');
}
