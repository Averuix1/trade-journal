import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, sessionDefs, trades } from '@/lib/db/schema';
import { classifyDay } from '@/lib/calc';

export type FormState = { error?: string; ok?: boolean; message?: string };

export function num(value: FormDataEntryValue | null): number | null {
  if (value == null) return null;
  const raw = String(value).replace(/[$,\s]/g, '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function str(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw ? raw : null;
}

export function bool(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1';
}

export function strList(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((v) => String(v)).filter(Boolean);
}

export function numList(formData: FormData, key: string): number[] {
  return formData
    .getAll(key)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
}

/** Re-derives session, slot and rule breaks for every trade on the given account days. */
export async function recomputeAccountDays(accountId: number, dates: string[]): Promise<void> {
  const unique = [...new Set(dates)].filter(Boolean);
  if (!unique.length) return;
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return;
  const defs = await db.select().from(sessionDefs).orderBy(sessionDefs.sortOrder);
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.accountId, accountId), inArray(trades.tradeDate, unique), eq(trades.hidden, false)));

  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byDate.get(row.tradeDate) ?? [];
    list.push(row);
    byDate.set(row.tradeDate, list);
  }

  for (const [, dayTrades] of byDate) {
    const classified = classifyDay(dayTrades, account, defs);
    for (const trade of dayTrades) {
      const c = classified.get(trade.id);
      if (!c) continue;
      const unchanged =
        trade.sessionKey === c.sessionKey &&
        trade.slot === c.slot &&
        trade.inSystem === c.inSystem &&
        JSON.stringify(trade.breaks) === JSON.stringify(c.breaks);
      if (unchanged) continue;
      await db
        .update(trades)
        .set({ sessionKey: c.sessionKey, slot: c.slot, breaks: c.breaks, inSystem: c.inSystem })
        .where(eq(trades.id, trade.id));
    }
  }
}

export async function recomputeAccount(accountId: number): Promise<void> {
  const rows = await db
    .select({ tradeDate: trades.tradeDate })
    .from(trades)
    .where(eq(trades.accountId, accountId));
  await recomputeAccountDays(
    accountId,
    rows.map((r) => r.tradeDate),
  );
}
