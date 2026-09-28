import { round2 } from '@/lib/calc';
import type { Account, Trade } from '@/lib/db/schema';
import type { DaySummary } from '@/lib/stats';

export type PropStatus = {
  accountSize: number;
  balance: number;
  profit: number;
  profitTarget: number | null;
  targetLeft: number | null;
  targetPct: number;
  drawdownLimit: number | null;
  drawdownLine: number | null;
  drawdownLeft: number | null;
  drawdownType: string | null;
  drawdownLocked: boolean;
  dailyLossLimit: number | null;
  dailyLossUsed: number;
  dailyLossLeft: number | null;
  consistencyPct: number | null;
  bestDay: number;
  consistencyActual: number | null;
  consistencyOk: boolean;
  consistencyGap: number | null;
  tradingDays: number;
  minTradingDays: number | null;
  payoutReady: boolean;
  blockers: string[];
};

/**
 * Everything the prop rules card shows, derived purely from user-entered rules.
 * Trailing/EOD drawdown lines are assumed to stop trailing at the starting balance.
 */
export function propStatus(
  account: Account,
  days: DaySummary[],
  trades: Trade[],
  payouts: number,
  todayKeyValue: string,
): PropStatus {
  const accountSize = account.accountSize ?? account.startingBalance ?? 0;
  const netPnl = round2(trades.reduce((sum, t) => sum + t.pnl, 0));
  const balance = round2(accountSize + netPnl - payouts);
  const profit = round2(balance - accountSize);

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let eodBalance = accountSize;
  let eodPeak = accountSize;
  for (const d of sortedDays) {
    eodBalance = round2(eodBalance + d.pnl);
    eodPeak = Math.max(eodPeak, eodBalance);
  }

  let intradayPeak = accountSize;
  let running = accountSize;
  for (const t of [...trades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())) {
    running = round2(running + t.pnl);
    intradayPeak = Math.max(intradayPeak, running);
  }

  let drawdownLine: number | null = null;
  let drawdownLocked = false;
  if (account.maxDrawdown != null) {
    if (account.drawdownType === 'STATIC') {
      drawdownLine = round2(accountSize - account.maxDrawdown);
    } else {
      const peak = account.drawdownType === 'EOD' ? eodPeak : intradayPeak;
      const raw = round2(peak - account.maxDrawdown);
      drawdownLine = Math.min(raw, accountSize);
      drawdownLocked = raw >= accountSize;
    }
  }

  const todayPnl = sortedDays.find((d) => d.date === todayKeyValue)?.pnl ?? 0;
  const dailyLossUsed = todayPnl < 0 ? round2(-todayPnl) : 0;

  const bestDay = sortedDays.reduce((best, d) => Math.max(best, d.pnl), 0);
  const consistencyActual = profit > 0 && bestDay > 0 ? round2((bestDay / profit) * 100) : null;
  const consistencyOk =
    account.consistencyPct == null || consistencyActual == null || consistencyActual <= account.consistencyPct;
  const consistencyGap =
    account.consistencyPct && bestDay > 0 && !consistencyOk
      ? round2(bestDay / (account.consistencyPct / 100) - profit)
      : null;

  const tradingDays = sortedDays.filter((d) => d.trades > 0).length;
  const blockers: string[] = [];
  if (account.profitTarget != null && profit < account.profitTarget) blockers.push('profit target');
  if (account.minTradingDays != null && tradingDays < account.minTradingDays) blockers.push('minimum days');
  if (!consistencyOk) blockers.push('consistency');

  return {
    accountSize,
    balance,
    profit,
    profitTarget: account.profitTarget ?? null,
    targetLeft: account.profitTarget != null ? round2(Math.max(0, account.profitTarget - profit)) : null,
    targetPct: account.profitTarget ? Math.max(0, Math.min(100, (profit / account.profitTarget) * 100)) : 0,
    drawdownLimit: account.maxDrawdown ?? null,
    drawdownLine,
    drawdownLeft: drawdownLine != null ? round2(balance - drawdownLine) : null,
    drawdownType: account.drawdownType ?? null,
    drawdownLocked,
    dailyLossLimit: account.dailyLossLimit ?? null,
    dailyLossUsed,
    dailyLossLeft: account.dailyLossLimit != null ? round2(Math.max(0, account.dailyLossLimit - dailyLossUsed)) : null,
    consistencyPct: account.consistencyPct ?? null,
    bestDay: round2(bestDay),
    consistencyActual,
    consistencyOk,
    consistencyGap,
    tradingDays,
    minTradingDays: account.minTradingDays ?? null,
    payoutReady: blockers.length === 0 && (account.profitTarget != null || account.minTradingDays != null),
    blockers,
  };
}

export type Pace = {
  target: number;
  start: number;
  current: number;
  made: number;
  left: number;
  pct: number;
  weeksElapsed: number;
  weeksTotal: number | null;
  needPerWeek: number | null;
  thisWeek: number;
  vsPlan: number | null;
  status: 'AHEAD' | 'BEHIND' | 'ON PACE' | 'DONE';
  projectedFinish: string | null;
};

export function challengePace(
  startBalance: number,
  target: number,
  currentBalance: number,
  startDate: string,
  thisWeekPnl: number,
  targetDate: string | null,
): Pace {
  const made = round2(currentBalance - startBalance);
  const goal = round2(target - startBalance);
  const left = round2(Math.max(0, target - currentBalance));
  const pct = goal > 0 ? Math.max(0, Math.min(100, (made / goal) * 100)) : 0;

  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const weeksElapsed = Math.max(1, (Date.now() - startMs) / (7 * 86400000));
  const weeksTotal = targetDate ? Math.max(1, (Date.parse(`${targetDate}T00:00:00Z`) - startMs) / (7 * 86400000)) : null;
  const weeksLeft = weeksTotal ? Math.max(0.2, weeksTotal - weeksElapsed) : null;
  const needPerWeek = weeksLeft ? round2(left / weeksLeft) : null;

  const perWeek = made / weeksElapsed;
  const projectedWeeks = perWeek > 0 ? left / perWeek : null;
  const projectedFinish =
    projectedWeeks != null && Number.isFinite(projectedWeeks)
      ? new Date(Date.now() + projectedWeeks * 7 * 86400000).toISOString().slice(0, 10)
      : null;

  let status: Pace['status'] = 'ON PACE';
  let vsPlan: number | null = null;
  if (left <= 0) status = 'DONE';
  else if (needPerWeek != null) {
    vsPlan = round2(thisWeekPnl - needPerWeek);
    status = vsPlan >= 0 ? 'AHEAD' : 'BEHIND';
  } else if (perWeek > 0) {
    status = 'ON PACE';
  }

  return {
    target,
    start: startBalance,
    current: currentBalance,
    made,
    left,
    pct,
    weeksElapsed: round2(weeksElapsed),
    weeksTotal: weeksTotal ? round2(weeksTotal) : null,
    needPerWeek,
    thisWeek: round2(thisWeekPnl),
    vsPlan,
    status,
    projectedFinish,
  };
}
