import type { Trade } from '@/lib/db/schema';
import { round2 } from '@/lib/calc';
import { isoWeekKey, weekdayOf } from '@/lib/time';

export type Outcome = 'WIN' | 'LOSS' | 'BE';

export function outcomeOf(trade: Pick<Trade, 'pnl' | 'rMultiple'>, beBandR: number): Outcome {
  if (trade.rMultiple != null) {
    if (Math.abs(trade.rMultiple) <= beBandR) return 'BE';
    return trade.rMultiple > 0 ? 'WIN' : 'LOSS';
  }
  if (trade.pnl === 0) return 'BE';
  return trade.pnl > 0 ? 'WIN' : 'LOSS';
}

export type TradeStats = {
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  totalPnl: number;
  totalR: number;
  avgR: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number;
  beRate: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number | null;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldMins: number | null;
  winHoldMins: number | null;
  lossHoldMins: number | null;
};

export const EMPTY_STATS: TradeStats = {
  trades: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  totalPnl: 0,
  totalR: 0,
  avgR: 0,
  grossProfit: 0,
  grossLoss: 0,
  winRate: 0,
  beRate: 0,
  profitFactor: null,
  avgWin: 0,
  avgLoss: 0,
  winLossRatio: null,
  expectancy: 0,
  bestTrade: 0,
  worstTrade: 0,
  avgHoldMins: null,
  winHoldMins: null,
  lossHoldMins: null,
};

function holdMinutes(t: Pick<Trade, 'openedAt' | 'closedAt'>): number | null {
  if (!t.closedAt) return null;
  return Math.max(0, (t.closedAt.getTime() - t.openedAt.getTime()) / 60000);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeStats(trades: Trade[], beBandR: number): TradeStats {
  if (!trades.length) return { ...EMPTY_STATS };
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalPnl = 0;
  let totalR = 0;
  let rCount = 0;
  let best = -Infinity;
  let worst = Infinity;
  const holds: number[] = [];
  const winHolds: number[] = [];
  const lossHolds: number[] = [];

  for (const t of trades) {
    totalPnl += t.pnl;
    if (t.rMultiple != null) {
      totalR += t.rMultiple;
      rCount += 1;
    }
    best = Math.max(best, t.pnl);
    worst = Math.min(worst, t.pnl);
    const outcome = outcomeOf(t, beBandR);
    const hold = holdMinutes(t);
    if (hold != null) holds.push(hold);
    if (outcome === 'WIN') {
      wins += 1;
      grossProfit += t.pnl;
      if (hold != null) winHolds.push(hold);
    } else if (outcome === 'LOSS') {
      losses += 1;
      grossLoss += Math.abs(t.pnl);
      if (hold != null) lossHolds.push(hold);
    } else {
      breakevens += 1;
      if (t.pnl > 0) grossProfit += t.pnl;
      else grossLoss += Math.abs(t.pnl);
    }
  }

  const decisive = wins + losses;
  const winRate = decisive ? (wins / decisive) * 100 : 0;
  const avgWin = wins ? grossProfit / wins : 0;
  const avgLoss = losses ? grossLoss / losses : 0;

  return {
    trades: trades.length,
    wins,
    losses,
    breakevens,
    totalPnl: round2(totalPnl),
    totalR: round2(totalR),
    avgR: rCount ? round2(totalR / rCount) : 0,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    winRate: round2(winRate),
    beRate: round2((breakevens / trades.length) * 100),
    profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : grossProfit > 0 ? null : 0,
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    winLossRatio: avgLoss > 0 ? round2(avgWin / avgLoss) : null,
    expectancy: round2(totalPnl / trades.length),
    bestTrade: round2(best === -Infinity ? 0 : best),
    worstTrade: round2(worst === Infinity ? 0 : worst),
    avgHoldMins: mean(holds),
    winHoldMins: mean(winHolds),
    lossHoldMins: mean(lossHolds),
  };
}

export type DaySummary = {
  date: string;
  pnl: number;
  r: number;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  breaks: number;
  hidden: boolean;
};

export function groupByDay(trades: Trade[], beBandR: number): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const t of trades) {
    let day = map.get(t.tradeDate);
    if (!day) {
      day = { date: t.tradeDate, pnl: 0, r: 0, trades: 0, wins: 0, losses: 0, breakevens: 0, breaks: 0, hidden: false };
      map.set(t.tradeDate, day);
    }
    day.pnl = round2(day.pnl + t.pnl);
    day.r = round2(day.r + (t.rMultiple ?? 0));
    day.trades += 1;
    day.breaks += t.breaks.length ? 1 : 0;
    const outcome = outcomeOf(t, beBandR);
    if (outcome === 'WIN') day.wins += 1;
    else if (outcome === 'LOSS') day.losses += 1;
    else day.breakevens += 1;
  }
  return map;
}

export type DayStats = {
  days: number;
  winningDays: number;
  losingDays: number;
  breakevenDays: number;
  dayWinRate: number;
  avgDaily: number;
  bestDay: DaySummary | null;
  worstDay: DaySummary | null;
};

export function computeDayStats(days: DaySummary[]): DayStats {
  if (!days.length) {
    return {
      days: 0,
      winningDays: 0,
      losingDays: 0,
      breakevenDays: 0,
      dayWinRate: 0,
      avgDaily: 0,
      bestDay: null,
      worstDay: null,
    };
  }
  let winning = 0;
  let losing = 0;
  let flat = 0;
  let total = 0;
  let best = days[0];
  let worst = days[0];
  for (const d of days) {
    total += d.pnl;
    if (d.pnl > 0) winning += 1;
    else if (d.pnl < 0) losing += 1;
    else flat += 1;
    if (d.pnl > best.pnl) best = d;
    if (d.pnl < worst.pnl) worst = d;
  }
  const decisive = winning + losing;
  return {
    days: days.length,
    winningDays: winning,
    losingDays: losing,
    breakevenDays: flat,
    dayWinRate: decisive ? round2((winning / decisive) * 100) : 0,
    avgDaily: round2(total / days.length),
    bestDay: best,
    worstDay: worst,
  };
}

export type EquityPoint = { label: string; value: number };

export function equityCurve(trades: Trade[], start = 0): EquityPoint[] {
  let running = start;
  const points: EquityPoint[] = [{ label: 'start', value: round2(start) }];
  const sorted = [...trades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  for (const t of sorted) {
    running += t.pnl;
    points.push({ label: t.tradeDate, value: round2(running) });
  }
  return points;
}

export function dailyEquityCurve(days: DaySummary[], start = 0): EquityPoint[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let running = start;
  const points: EquityPoint[] = [{ label: 'start', value: round2(start) }];
  for (const d of sorted) {
    running += d.pnl;
    points.push({ label: d.date, value: round2(running) });
  }
  return points;
}

export function maxDrawdown(points: EquityPoint[]): { amount: number; pct: number; at: string | null } {
  let peak = points.length ? points[0].value : 0;
  let maxDd = 0;
  let at: string | null = null;
  for (const p of points) {
    if (p.value > peak) peak = p.value;
    const dd = peak - p.value;
    if (dd > maxDd) {
      maxDd = dd;
      at = p.label;
    }
  }
  const pct = peak > 0 ? round2((maxDd / peak) * 100) : 0;
  return { amount: round2(maxDd), pct, at };
}

export function streaks(days: DaySummary[]): { current: number; best: number; worst: number } {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  let best = 0;
  let worst = 0;
  for (const d of sorted) {
    if (d.pnl > 0) current = current > 0 ? current + 1 : 1;
    else if (d.pnl < 0) current = current < 0 ? current - 1 : -1;
    else continue;
    best = Math.max(best, current);
    worst = Math.min(worst, current);
  }
  return { current, best, worst };
}

export function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k == null) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export type Breakdown = { key: string; label: string; stats: TradeStats };

export function breakdown(
  trades: Trade[],
  beBandR: number,
  keyOf: (t: Trade) => string | null,
  labelOf: (key: string) => string = (k) => k,
): Breakdown[] {
  const groups = groupBy(trades, keyOf);
  return [...groups.entries()]
    .map(([key, list]) => ({ key, label: labelOf(key), stats: computeStats(list, beBandR) }))
    .sort((a, b) => b.stats.totalPnl - a.stats.totalPnl);
}

export function weekdayBreakdown(trades: Trade[], beBandR: number): Breakdown[] {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return breakdown(
    trades,
    beBandR,
    (t) => String(weekdayOf(t.tradeDate)),
    (k) => names[Number(k)],
  ).sort((a, b) => Number(a.key) - Number(b.key));
}

export function weekBreakdown(trades: Trade[], beBandR: number): Breakdown[] {
  return breakdown(trades, beBandR, (t) => isoWeekKey(t.tradeDate)).sort((a, b) => a.key.localeCompare(b.key));
}

/** How often the next slot in a session actually fires after the previous one. */
export function triggerRates(trades: Trade[]): { slot: string; rate: number; of: number }[] {
  const bySessionDay = new Map<string, Set<string>>();
  for (const t of trades) {
    if (!t.sessionKey || !t.slot) continue;
    const key = `${t.tradeDate}|${t.sessionKey}`;
    const set = bySessionDay.get(key) ?? new Set<string>();
    set.add(t.slot);
    bySessionDay.set(key, set);
  }
  const result: { slot: string; rate: number; of: number }[] = [];
  for (const [from, to] of [
    ['T1', 'T2'],
    ['T2', 'T3'],
  ] as const) {
    let had = 0;
    let fired = 0;
    for (const set of bySessionDay.values()) {
      if (set.has(from)) {
        had += 1;
        if (set.has(to)) fired += 1;
      }
    }
    result.push({ slot: `${from} → ${to}`, rate: had ? round2((fired / had) * 100) : 0, of: had });
  }
  return result;
}
