import type { Account, Instrument, SessionDef, Trade } from '@/lib/db/schema';
import { NY_TZ, minuteOfDay } from '@/lib/time';

export function pointsGained(side: 'LONG' | 'SHORT', entry: number, exit: number): number {
  return side === 'LONG' ? exit - entry : entry - exit;
}

export function grossPnl(
  side: 'LONG' | 'SHORT',
  entry: number,
  exit: number,
  contracts: number,
  pointValue: number,
): number {
  return pointsGained(side, entry, exit) * contracts * pointValue;
}

export function autoFees(contracts: number, commissionPerContract: number): number {
  return round2(contracts * commissionPerContract);
}

export function autoPnl(
  side: 'LONG' | 'SHORT',
  entry: number | null | undefined,
  exit: number | null | undefined,
  contracts: number,
  pointValue: number,
  fees: number,
): number | null {
  if (entry == null || exit == null) return null;
  return round2(grossPnl(side, entry, exit, contracts, pointValue) - fees);
}

/** Realised R from the planned stop distance; null when no stop was recorded. */
export function autoR(
  side: 'LONG' | 'SHORT',
  entry: number | null | undefined,
  stop: number | null | undefined,
  contracts: number,
  pointValue: number,
  netPnl: number,
): number | null {
  if (entry == null || stop == null) return null;
  const riskPoints = Math.abs(entry - stop);
  if (riskPoints <= 0) return null;
  const risk = riskPoints * contracts * pointValue;
  if (risk <= 0) return null;
  return round2(netPnl / risk);
}

/** R from a dollar risk when the trade has no prices. Null when risk wasn't recorded. */
export function rFromRisk(netPnl: number, plannedRisk: number | null | undefined): number | null {
  if (plannedRisk == null || plannedRisk <= 0) return null;
  return round2(netPnl / plannedRisk);
}

export type QuickOutcome = 'win' | 'loss' | 'be' | 'custom';

/** Planned reward:risk. 500 take profit on 250 risk is 2. */
export function plannedRewardRisk(takeProfit: number | null | undefined, risk: number | null | undefined): number | null {
  if (takeProfit == null || risk == null || risk <= 0 || takeProfit < 0) return null;
  return round2(takeProfit / risk);
}

/** Dollar result for a quick trade. Fees, when typed, come off that result. */
export function quickPnl(
  outcome: QuickOutcome,
  risk: number | null | undefined,
  takeProfit: number | null | undefined,
  custom: number | null | undefined,
  fees: number,
): number | null {
  if (risk == null || risk <= 0) return null;
  let gross: number | null = null;
  if (outcome === 'win') gross = takeProfit == null ? null : takeProfit;
  else if (outcome === 'loss') gross = -risk;
  else if (outcome === 'be') gross = 0;
  else gross = custom ?? null;
  if (gross == null || !Number.isFinite(gross)) return null;
  return round2(gross - (fees || 0));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** True when `minute` (NY minutes past midnight) falls inside a possibly midnight-wrapping window. */
export function inWindow(minute: number, start: number, end: number): boolean {
  if (end > start) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

export function minutesSinceOpen(minute: number, start: number): number {
  const delta = minute - start;
  return delta < 0 ? delta + 1440 : delta;
}

export function sessionForTime(date: Date, sessions: SessionDef[]): SessionDef | null {
  const minute = minuteOfDay(date, NY_TZ);
  for (const s of sessions) {
    if (inWindow(minute, s.startMinute, s.endMinute)) return s;
  }
  return null;
}

export type Classified = {
  sessionKey: string | null;
  slot: string | null;
  breaks: string[];
  inSystem: boolean;
};

type ClassifiableTrade = Pick<Trade, 'id' | 'openedAt' | 'brokenRuleIds' | 'mistakeTags' | 'timeKnown'>;

/**
 * Assigns each trade of a trading day its session, slot (T1..Tn / EXTRA) and rule breaks.
 * Trades must already be filtered to a single account + trading day.
 */
export function classifyDay(
  dayTrades: ClassifiableTrade[],
  account: Pick<Account, 'maxTradesPerSession' | 'activeSessions' | 'entryWindows'>,
  sessions: SessionDef[],
): Map<number, Classified> {
  const active = account.activeSessions?.length
    ? sessions.filter((s) => account.activeSessions.includes(s.key))
    : sessions;
  const ordered = [...dayTrades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  const counts = new Map<string, number>();
  const result = new Map<number, Classified>();
  const cap = Math.max(1, account.maxTradesPerSession || 3);

  for (const trade of ordered) {
    const session = sessionForTime(trade.openedAt, active);
    const breaks: string[] = [];
    let slot: string | null = null;

    if (session) {
      const index = counts.get(session.key) ?? 0;
      counts.set(session.key, index + 1);
      slot = index < cap ? `T${index + 1}` : 'EXTRA';
      if (index >= cap) breaks.push('DUMP');
      const since = minutesSinceOpen(minuteOfDay(trade.openedAt, NY_TZ), session.startMinute);
      const window = account.entryWindows?.[session.key] ?? session.entryWindowMins;
      // Placeholder times sit at the session open so they are not judged against the entry window.
      if (trade.timeKnown !== false && window > 0 && since > window) breaks.push('OUTSIDE');
    } else {
      const index = counts.get('__outside') ?? 0;
      counts.set('__outside', index + 1);
      slot = 'EXTRA';
      breaks.push('OUTSIDE');
    }

    if (trade.brokenRuleIds?.length) breaks.push('RULE');
    if (trade.mistakeTags?.length) breaks.push('MISTAKE');

    result.set(trade.id, {
      sessionKey: session?.key ?? null,
      slot,
      breaks,
      inSystem: breaks.length === 0,
    });
  }

  return result;
}

export function instrumentMap(instruments: Instrument[]): Map<string, Instrument> {
  return new Map(instruments.map((i) => [i.symbol.toUpperCase(), i]));
}

export function pointValueOf(symbol: string, instruments: Map<string, Instrument>): number {
  return instruments.get(symbol.toUpperCase())?.pointValue ?? 1;
}
