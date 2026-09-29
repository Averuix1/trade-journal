import type { Trade } from '@/lib/db/schema';
import { inWindow, minutesSinceOpen, round2 } from '@/lib/calc';
import { formatMonthLabel, isoWeekKey, minuteOfDay, monthKeyOf, NY_TZ, weekdayOf } from '@/lib/time';

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
  /** Mean of stored planned reward:risk. Null when no trade in the set has one. */
  avgPlannedRr: number | null;
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
  avgPlannedRr: null,
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
  let plannedSum = 0;
  let plannedCount = 0;
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
    if (t.plannedRr != null) {
      plannedSum += t.plannedRr;
      plannedCount += 1;
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
    avgPlannedRr: plannedCount ? round2(plannedSum / plannedCount) : null,
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

/**
 * One row per calendar month of the trading day (US Eastern, stored on `tradeDate`).
 * Newest month first.
 */
export function monthBreakdown(trades: Trade[], beBandR: number): Breakdown[] {
  return breakdown(trades, beBandR, (t) => monthKeyOf(t.tradeDate), formatMonthLabel).sort((a, b) =>
    b.key.localeCompare(a.key),
  );
}

/**
 * Width of the open and close buckets, in minutes. The second bucket is the
 * following block of the same length. Change this to resize every label and cut.
 */
export const ENTRY_EDGE_MINS = 30;

export type SessionWindow = { key: string; startMinute: number; endMinute: number };

export type TimingBucket = 'open-0' | 'open-1' | 'middle' | 'close' | 'after' | 'none';

export function sessionLengthMinutes(startMinute: number, endMinute: number): number {
  if (endMinute > startMinute) return endMinute - startMinute;
  return 1440 - startMinute + endMinute;
}

export function entryTimingLabel(key: TimingBucket, edge = ENTRY_EDGE_MINS): string {
  switch (key) {
    case 'open-0':
      return `First ${edge} minutes after the open`;
    case 'open-1':
      return `${edge} to ${edge * 2} minutes after the open`;
    case 'middle':
      return 'Middle of the session';
    case 'close':
      return `Last ${edge} minutes before the close`;
    case 'after':
      return 'After the close';
    case 'none':
      return 'No time entered';
  }
}

const TIMING_ORDER: TimingBucket[] = ['open-0', 'open-1', 'middle', 'close', 'after', 'none'];

/**
 * Where the entry sits inside its own session window.
 * Open-side buckets win until the close bucket; a short session can leave a bucket empty.
 * Unknown clocks stay in "No time entered" even when the stored time is a placeholder at the open.
 */
export function entryTimingKey(
  trade: Pick<Trade, 'openedAt' | 'timeKnown' | 'sessionKey'>,
  sessions: SessionWindow[],
  edge = ENTRY_EDGE_MINS,
): TimingBucket {
  if (trade.timeKnown === false) return 'none';
  const session = sessions.find((s) => s.key === trade.sessionKey);
  if (!session) return 'after';
  const minute = minuteOfDay(trade.openedAt, NY_TZ);
  if (!inWindow(minute, session.startMinute, session.endMinute)) return 'after';
  const since = minutesSinceOpen(minute, session.startMinute);
  const length = sessionLengthMinutes(session.startMinute, session.endMinute);
  if (since < edge) return 'open-0';
  if (length - since <= edge) return 'close';
  if (since < edge * 2) return 'open-1';
  return 'middle';
}

/** Every bucket, in window order, including ones with no trades. */
export function entryTimingBreakdown(
  trades: Trade[],
  sessions: SessionWindow[],
  beBandR: number,
  edge = ENTRY_EDGE_MINS,
): Breakdown[] {
  const groups = groupBy(trades, (t) => entryTimingKey(t, sessions, edge));
  return TIMING_ORDER.map((key) => ({
    key,
    label: entryTimingLabel(key, edge),
    stats: computeStats(groups.get(key) ?? [], beBandR),
  }));
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

/** Profit factor from daily totals: green days divided by the size of red days. */
export function dayProfitFactor(days: DaySummary[]): number | null {
  let green = 0;
  let red = 0;
  for (const day of days) {
    if (day.pnl > 0) green += day.pnl;
    else if (day.pnl < 0) red += Math.abs(day.pnl);
  }
  if (red === 0) return green > 0 ? null : 0;
  return round2(green / red);
}

/** Consecutive winning and losing trades, breakevens skipped. Day streaks live in `streaks`. */
export function tradeStreaks(trades: Trade[], beBandR: number): { current: number; best: number; worst: number } {
  const sorted = [...trades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  let current = 0;
  let best = 0;
  let worst = 0;
  for (const trade of sorted) {
    const outcome = outcomeOf(trade, beBandR);
    if (outcome === 'BE') continue;
    if (outcome === 'WIN') current = current > 0 ? current + 1 : 1;
    else current = current < 0 ? current - 1 : -1;
    best = Math.max(best, current);
    worst = Math.min(worst, current);
  }
  return { current, best, worst };
}

/** Passed when every filled session has No-answers at or under the skip line. */
export function checklistVerdict(
  checklist: Record<string, { answers: (boolean | null)[] | null }> | null | undefined,
  skipIfNo: number,
): 'passed' | 'failed' | 'blank' {
  const filled = Object.values(checklist ?? {}).filter((run) => (run?.answers ?? []).some((answer) => answer != null));
  if (!filled.length) return 'blank';
  const failed = filled.some((run) => (run.answers ?? []).filter((answer) => answer === false).length > skipIfNo);
  return failed ? 'failed' : 'passed';
}

export type ProcessSlice = { label: string; days: number; pnl: number; r: number; winRate: number };

/** Day win % is green days divided by green + red days. Flat days stay in the count but not the rate. */
export function processSlice(label: string, days: { pnl: number; r: number }[]): ProcessSlice {
  let green = 0;
  let red = 0;
  let pnl = 0;
  let r = 0;
  for (const day of days) {
    pnl += day.pnl;
    r += day.r;
    if (day.pnl > 0) green += 1;
    else if (day.pnl < 0) red += 1;
  }
  const decided = green + red;
  return {
    label,
    days: days.length,
    pnl: round2(pnl),
    r: round2(r),
    winRate: decided ? round2((green / decided) * 100) : 0,
  };
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ruleBreakDaysByWeekday(
  dates: { date: string; broke: boolean }[],
): { weekday: string; days: number; breakDays: number }[] {
  const rows = WEEKDAY_NAMES.map((weekday) => ({ weekday, days: 0, breakDays: 0 }));
  for (const entry of dates) {
    const row = rows[weekdayOf(entry.date)];
    row.days += 1;
    if (entry.broke) row.breakDays += 1;
  }
  return rows.filter((row) => row.days > 0);
}
