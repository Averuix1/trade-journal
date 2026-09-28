import Link from 'next/link';
import { Badge, Card, KeyValue, MoneyText, ProgressBar, Stat, StatGrid } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { MiniCalendar } from '@/components/mini-calendar';
import { NoAccounts } from '@/components/no-accounts';
import { PropRulesCard } from '@/components/prop-rules-card';
import {
  getAccountMoney,
  getHiddenDays,
  getLedger,
  getScope,
  getSessionDefs,
  getSettings,
  getTrades,
} from '@/lib/queries';
import { computeDayStats, computeStats, dailyEquityCurve, groupByDay } from '@/lib/stats';
import { challengePace, propStatus } from '@/lib/prop';
import { fmtMoney, fmtNum, fmtPct, fmtR, fmtSigned } from '@/lib/format';
import { formatDayLong, formatTime, minutesToClock, startOfWeek, todayKey } from '@/lib/time';
import { BREAK_LABELS } from '@/lib/defaults';

export const metadata = { title: 'Desk — Trade Journal' };

export default async function DeskPage() {
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const [config, sessions] = await Promise.all([getSettings(), getSessionDefs()]);
  const trades = await getTrades({ accountIds: scope.accountIds });
  const money = await getAccountMoney(scope.accounts);
  const ledger = await getLedger(scope.accountIds);
  const hidden = await getHiddenDays(scope.accountIds);

  const days = groupByDay(trades, config.beBandR);
  const dayList = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const stats = computeStats(trades, config.beBandR);
  const dayStats = computeDayStats(dayList);

  const today = todayKey('America/New_York');
  const todayTrades = trades.filter((t) => t.tradeDate === today);
  const todayPnl = todayTrades.reduce((sum, t) => sum + t.pnl, 0);
  const todayR = todayTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);

  const weekStart = startOfWeek(today);
  const thisWeekPnl = dayList.filter((d) => d.date >= weekStart).reduce((sum, d) => sum + d.pnl, 0);

  const balance = scope.account
    ? (money.get(scope.account.id)?.balance ?? 0)
    : [...money.values()].reduce((sum, m) => sum + m.balance, 0);
  const startBalance = scope.account
    ? (scope.account.type === 'PROP' ? (scope.account.accountSize ?? 0) : scope.account.startingBalance)
    : scope.accounts.reduce((sum, a) => sum + (a.type === 'PROP' ? (a.accountSize ?? 0) : a.startingBalance), 0);
  const change = balance - startBalance;
  const roi = startBalance > 0 ? (change / startBalance) * 100 : 0;

  const cap = scope.account?.maxTradesPerSession ?? 3;
  const activeKeys = scope.account?.activeSessions?.length ? scope.account.activeSessions : sessions.map((s) => s.key);
  const activeSessions = sessions.filter((s) => activeKeys.includes(s.key));

  const payouts = scope.account
    ? ledger.filter((l) => l.accountId === scope.account!.id && l.kind === 'PAYOUT').reduce((s, l) => s + l.amount, 0)
    : 0;
  const prop = scope.account?.type === 'PROP' ? propStatus(scope.account, dayList, trades, payouts, today) : null;

  const target = scope.account?.targetBalance ?? null;
  const pace =
    scope.account && target
      ? challengePace(startBalance, target, balance, scope.account.startDate, thisWeekPnl, scope.account.targetDate)
      : null;

  const equity = dailyEquityCurve(dayList, startBalance);
  const recent = [...trades].sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime()).slice(0, 8);
  const breaks = trades.filter((t) => !t.inSystem);
  const breakReasons = new Map<string, { count: number; pnl: number }>();
  for (const t of breaks) {
    for (const reason of t.breaks) {
      const entry = breakReasons.get(reason) ?? { count: 0, pnl: 0 };
      entry.count += 1;
      entry.pnl += t.pnl;
      breakReasons.set(reason, entry);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-[#eafff7]">
                {scope.account?.name ?? 'All accounts'}
              </h1>
              {scope.account?.type === 'PROP' && (
                <Badge tone={scope.account.stage === 'FUNDED' ? 'up' : scope.account.stage === 'BLOWN' ? 'down' : 'neutral'}>
                  {scope.account.firm ?? 'Prop'} · {scope.account.stage ?? 'EVAL'}
                </Badge>
              )}
              {scope.account?.type === 'PERSONAL' && <Badge>Personal</Badge>}
            </div>
            <div className="tabular mt-1 text-4xl font-semibold tracking-tight text-[#eafff7]">{fmtMoney(balance)}</div>
            <div className="mt-1 text-sm text-dim">
              <MoneyText value={change} /> from {fmtMoney(startBalance)} · ROI {fmtPct(roi)}
              {prop && ` · payouts ${fmtMoney(payouts)}`}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <Stat label="Trades" value={stats.trades} size="sm" />
            <Stat label="Win rate" value={fmtPct(stats.winRate)} size="sm" sub="ex BE" />
            <Stat label="Profit factor" value={fmtNum(stats.profitFactor)} size="sm" />
            <Stat label="Total R" value={fmtR(stats.totalR)} size="sm" tone={stats.totalR >= 0 ? 'up' : 'down'} />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card
            title={`Today · ${formatDayLong(today)}`}
            action={
              <Link href="/trades?new=1" className="btn btn-sm btn-primary">
                + Log a trade
              </Link>
            }
          >
            <StatGrid cols={4}>
              <Stat label="Trades" value={todayTrades.length} size="sm" />
              <Stat
                label="Day P&L"
                value={fmtSigned(todayPnl)}
                size="sm"
                tone={todayPnl > 0 ? 'up' : todayPnl < 0 ? 'down' : 'neutral'}
              />
              <Stat label="Day R" value={fmtR(todayR)} size="sm" tone={todayR >= 0 ? 'up' : 'down'} />
              <Stat
                label="In system"
                value={`${todayTrades.filter((t) => t.inSystem).length}/${todayTrades.length}`}
                size="sm"
              />
            </StatGrid>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activeSessions.map((session) => {
                const taken = todayTrades
                  .filter((t) => t.sessionKey === session.key)
                  .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
                const slots = Array.from({ length: cap }, (_, i) => taken[i] ?? null);
                const extras = taken.slice(cap);
                return (
                  <div key={session.key} className="rounded-xl border border-line bg-ink-850/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#e6fff5]">{session.name}</span>
                      <span className="pill">
                        {taken.length}/{cap} trades
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-dim">
                      {minutesToClock(session.startMinute)}–{minutesToClock(session.endMinute)} NY · window{' '}
                      {session.entryWindowMins}m
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {slots.map((trade, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                            trade ? 'bg-ink-800' : 'border border-dashed border-line-soft'
                          }`}
                        >
                          <span className="font-medium text-dim">T{i + 1}</span>
                          {trade ? (
                            <span className="flex items-center gap-2">
                              <span className="text-[#cdefe2]">{trade.symbol}</span>
                              <MoneyText value={trade.pnl} />
                              <span className="tabular text-dim">{fmtR(trade.rMultiple)}</span>
                            </span>
                          ) : (
                            <span className="text-dim/70">Open</span>
                          )}
                        </div>
                      ))}
                      {extras.map((trade) => (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between rounded-lg bg-[#3a1119] px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-medium text-[#ff9aa3]">DUMP</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[#ffd8dc]">{trade.symbol}</span>
                            <MoneyText value={trade.pnl} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {pace && (
            <Card title="Challenge pace · target vs plan">
              <div className="mb-3">
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="text-dim">
                    {fmtMoney(pace.start)} → {fmtMoney(pace.target)}
                  </span>
                  <span className="tabular font-medium text-[#e6fff5]">{fmtPct(pace.pct, 0)}</span>
                </div>
                <ProgressBar pct={pace.pct} />
              </div>
              <StatGrid cols={6}>
                <Stat label="Made" value={fmtSigned(pace.made)} size="sm" tone={pace.made >= 0 ? 'up' : 'down'} />
                <Stat label="Left" value={fmtMoney(pace.left)} size="sm" />
                <Stat label="Need / week" value={pace.needPerWeek == null ? '—' : fmtMoney(pace.needPerWeek)} size="sm" />
                <Stat
                  label="This week"
                  value={fmtSigned(pace.thisWeek)}
                  size="sm"
                  tone={pace.thisWeek >= 0 ? 'up' : 'down'}
                />
                <Stat
                  label="vs plan"
                  value={pace.vsPlan == null ? '—' : fmtSigned(pace.vsPlan)}
                  size="sm"
                  tone={pace.vsPlan != null && pace.vsPlan >= 0 ? 'up' : 'down'}
                />
                <Stat label="Status" value={pace.status} size="sm" sub={pace.projectedFinish ? `finish ~${pace.projectedFinish}` : 'no pace yet'} />
              </StatGrid>
            </Card>
          )}

          <Card title="Equity" action={<span className="text-[11px] text-dim">Daily, from account start</span>}>
            <LineChart series={[{ points: equity, colour: '#22d39a', label: 'Balance' }]} baseline={prop?.drawdownLine ?? undefined} showZero={false} />
            {prop?.drawdownLine != null && (
              <p className="mt-2 text-[11px] text-dim">Red line is your drawdown cut-off at {fmtMoney(prop.drawdownLine)}.</p>
            )}
          </Card>

          <Card title="Recent trades" action={<Link href="/trades" className="text-[11px] text-mint-300 hover:underline">All trades</Link>}>
            {recent.length === 0 ? (
              <p className="text-sm text-dim">No trades yet. Log one from the Trades tab, or import a CSV.</p>
            ) : (
              <div className="scroll-x">
                <table className="tabular">
                  <thead>
                    <tr>
                      <th className="py-1.5">Date</th>
                      <th>Time</th>
                      <th>Session</th>
                      <th>Slot</th>
                      <th>Instrument</th>
                      <th>Side</th>
                      <th className="text-right">P&L</th>
                      <th className="text-right">R</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-rows">
                    {recent.map((trade) => (
                      <tr key={trade.id} className="text-[#cdefe2]">
                        <td className="py-1.5">{trade.tradeDate}</td>
                        <td className="text-dim">{formatTime(trade.openedAt, config.timezone)}</td>
                        <td className="text-dim">{sessions.find((s) => s.key === trade.sessionKey)?.shortName ?? '—'}</td>
                        <td>{trade.slot ?? '—'}</td>
                        <td>{trade.symbol}</td>
                        <td className="text-dim">{trade.side}</td>
                        <td className="text-right">
                          <MoneyText value={trade.pnl} />
                        </td>
                        <td className="text-right text-dim">{fmtR(trade.rMultiple)}</td>
                        <td>
                          {trade.inSystem ? (
                            <Badge tone="up">In</Badge>
                          ) : (
                            <Badge tone="down">{BREAK_LABELS[trade.breaks[0]] ?? 'Out'}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {prop && scope.account && <PropRulesCard status={prop} name={scope.account.name} />}

          <Card title="This month">
            <MiniCalendar month={today.slice(0, 7)} days={days} hiddenDays={new Set([...hidden].map((k) => k.split('|')[1]))} />
          </Card>

          <Card title="Days">
            <div className="divide-rows">
              <KeyValue label="Trading days" value={dayStats.days} />
              <KeyValue label="Winning days" value={dayStats.winningDays} tone="up" />
              <KeyValue label="Losing days" value={dayStats.losingDays} tone="down" />
              <KeyValue label="Day win rate" value={fmtPct(dayStats.dayWinRate)} />
              <KeyValue label="Avg daily" value={fmtSigned(dayStats.avgDaily)} tone={dayStats.avgDaily >= 0 ? 'up' : 'down'} />
              <KeyValue label="Best day" value={fmtSigned(dayStats.bestDay?.pnl ?? 0)} tone="up" />
              <KeyValue label="Worst day" value={fmtSigned(dayStats.worstDay?.pnl ?? 0)} tone="down" />
            </div>
          </Card>

          <Card title="Rule breaks" action={<Link href="/system" className="text-[11px] text-mint-300 hover:underline">System</Link>}>
            {breakReasons.size === 0 ? (
              <p className="text-sm text-dim">Clean book. Every trade is inside the rules.</p>
            ) : (
              <div className="divide-rows">
                {[...breakReasons.entries()].map(([reason, entry]) => (
                  <KeyValue
                    key={reason}
                    label={`${BREAK_LABELS[reason] ?? reason} · ${entry.count}`}
                    value={fmtSigned(entry.pnl)}
                    tone={entry.pnl >= 0 ? 'up' : 'down'}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
