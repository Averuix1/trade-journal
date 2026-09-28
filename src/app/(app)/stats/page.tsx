import { Card, MoneyText, Stat, StatGrid } from '@/components/ui';
import { BarChart, Gauge, LineChart, SplitBar } from '@/components/charts';
import { BreakdownTable } from '@/components/breakdown-table';
import { NoAccounts } from '@/components/no-accounts';
import {
  getMistakeTags,
  getPlaybooks,
  getScope,
  getSessionDefs,
  getSettings,
  getTrades,
} from '@/lib/queries';
import {
  breakdown,
  computeDayStats,
  computeStats,
  dailyEquityCurve,
  groupByDay,
  maxDrawdown,
  streaks,
  triggerRates,
  weekdayBreakdown,
} from '@/lib/stats';
import { fmtHold, fmtMoney, fmtNum, fmtPct, fmtR, fmtSigned } from '@/lib/format';
import { minuteOfDay, NY_TZ } from '@/lib/time';

export const metadata = { title: 'Stats — Trade Journal' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const [config, sessions, playbooks, tags] = await Promise.all([
    getSettings(),
    getSessionDefs(),
    getPlaybooks(),
    getMistakeTags(),
  ]);

  const from = one(params.from);
  const to = one(params.to);
  const stage = one(params.stage) ?? 'all';
  const sessionFilter = one(params.session) ?? 'all';
  const direction = one(params.direction) ?? 'all';
  const systemFilter = one(params.system) ?? 'all';

  const accountById = new Map(scope.accounts.map((a) => [a.id, a]));
  const raw = await getTrades({ accountIds: scope.accountIds, from, to });
  const trades = raw.filter((t) => {
    const account = accountById.get(t.accountId);
    if (stage === 'eval' && account?.stage !== 'EVAL') return false;
    if (stage === 'funded' && account?.stage !== 'FUNDED') return false;
    if (sessionFilter !== 'all' && t.sessionKey !== sessionFilter) return false;
    if (direction !== 'all' && t.side !== direction.toUpperCase()) return false;
    if (systemFilter === 'in' && !t.inSystem) return false;
    if (systemFilter === 'out' && t.inSystem) return false;
    return true;
  });

  const stats = computeStats(trades, config.beBandR);
  const days = [...groupByDay(trades, config.beBandR).values()];
  const dayStats = computeDayStats(days);
  const curve = dailyEquityCurve(days, 0);
  const dd = maxDrawdown(curve);
  const streak = streaks(days);

  const bestDayShare = stats.totalPnl > 0 && dayStats.bestDay ? (dayStats.bestDay.pnl / stats.totalPnl) * 100 : 0;

  const sessionRows = breakdown(
    trades,
    config.beBandR,
    (t) => t.sessionKey ?? 'none',
    (k) => sessions.find((s) => s.key === k)?.name ?? 'Outside sessions',
  );
  const weekdayRows = weekdayBreakdown(trades, config.beBandR);
  const hourRows = breakdown(
    trades,
    config.beBandR,
    (t) => String(Math.floor(minuteOfDay(t.openedAt, NY_TZ) / 60)).padStart(2, '0'),
    (k) => `${k}:00 NY`,
  ).sort((a, b) => a.key.localeCompare(b.key));
  const instrumentRows = breakdown(trades, config.beBandR, (t) => t.symbol);
  const slotRows = breakdown(trades, config.beBandR, (t) => t.slot ?? 'None').sort((a, b) => a.key.localeCompare(b.key));
  const playbookRows = breakdown(
    trades,
    config.beBandR,
    (t) => (t.playbookId ? String(t.playbookId) : 'none'),
    (k) => playbooks.find((p) => String(p.id) === k)?.name ?? 'No playbook',
  );
  const mistakeRows = breakdown(
    trades.flatMap((t) => t.mistakeTags.map((tag) => ({ ...t, mistakeTags: [tag] }))),
    config.beBandR,
    (t) => t.mistakeTags[0] ?? null,
  );
  const ruleRows = breakdown(
    trades,
    config.beBandR,
    (t) => (t.brokenRuleIds.length ? 'broken' : 'followed'),
    (k) => (k === 'broken' ? 'Playbook rule broken' : 'Playbook rules kept'),
  );
  const stageRows = breakdown(
    trades,
    config.beBandR,
    (t) => accountById.get(t.accountId)?.stage ?? (accountById.get(t.accountId)?.type === 'PERSONAL' ? 'PERSONAL' : 'none'),
    (k) => (k === 'EVAL' ? 'Evaluation' : k === 'FUNDED' ? 'Funded' : k === 'BLOWN' ? 'Blown' : 'Personal'),
  );

  const mostActive = [...weekdayRows].sort((a, b) => b.stats.trades - a.stats.trades)[0];
  const mostProfitable = [...weekdayRows].sort((a, b) => b.stats.totalPnl - a.stats.totalPnl)[0];
  const worstWeekday = [...weekdayRows].sort((a, b) => a.stats.totalPnl - b.stats.totalPnl)[0];
  const triggers = triggerRates(trades);
  const longs = trades.filter((t) => t.side === 'LONG');
  const shorts = trades.filter((t) => t.side === 'SHORT');

  return (
    <div className="space-y-5">
      <Card bodyClassName="px-4 py-3 sm:px-5">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="stage">
              Stage
            </label>
            <select id="stage" name="stage" defaultValue={stage} className="text-sm">
              <option value="all">All stages</option>
              <option value="eval">Evaluation</option>
              <option value="funded">Funded</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="session">
              Session
            </label>
            <select id="session" name="session" defaultValue={sessionFilter} className="text-sm">
              <option value="all">All sessions</option>
              {sessions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="direction">
              Direction
            </label>
            <select id="direction" name="direction" defaultValue={direction} className="text-sm">
              <option value="all">Long &amp; short</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="system">
              System
            </label>
            <select id="system" name="system" defaultValue={systemFilter} className="text-sm">
              <option value="all">All trades</option>
              <option value="in">In system</option>
              <option value="out">Outside</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={from ?? ''} className="text-sm" />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={to ?? ''} className="text-sm" />
          </div>
          <button className="btn btn-primary" type="submit">
            Apply
          </button>
          <a className="btn btn-ghost" href="/stats">
            Reset
          </a>
          <span className="ml-auto text-xs text-dim">Account filter is the header dropdown.</span>
        </form>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title="Trade win %">
          <Gauge pct={stats.winRate} label="Wins vs losses" sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`} />
        </Card>
        <Card title="Headline">
          <StatGrid cols={4}>
            <Stat label="Total P&L" value={fmtSigned(stats.totalPnl)} tone={stats.totalPnl >= 0 ? 'up' : 'down'} />
            <Stat label="Avg win / avg loss" value={fmtNum(stats.winLossRatio)} sub={`${fmtMoney(stats.avgWin)} / ${fmtMoney(-stats.avgLoss)}`} />
            <Stat label="Day win %" value={fmtPct(dayStats.dayWinRate)} sub={`${dayStats.winningDays}/${dayStats.days} days`} />
            <Stat label="Profit factor" value={fmtNum(stats.profitFactor)} />
            <Stat label="Expectancy" value={fmtSigned(stats.expectancy)} sub="per trade" tone={stats.expectancy >= 0 ? 'up' : 'down'} />
            <Stat label="Avg R" value={fmtR(stats.avgR)} sub={`${fmtR(stats.totalR)} total`} />
            <Stat label="Max drawdown" value={fmtMoney(-dd.amount)} sub={dd.at ? `at ${dd.at}` : undefined} tone="down" />
            <Stat label="Best day % of profit" value={fmtPct(bestDayShare)} sub="consistency check" />
          </StatGrid>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <Card title="Most active day">
          <Stat label={mostActive?.label ?? '—'} value={mostActive ? `${mostActive.stats.trades} trades` : '—'} size="sm" />
        </Card>
        <Card title="Most profitable day">
          <Stat label={mostProfitable?.label ?? '—'} value={fmtSigned(mostProfitable?.stats.totalPnl ?? 0)} size="sm" tone="up" />
        </Card>
        <Card title="Worst day">
          <Stat label={worstWeekday?.label ?? '—'} value={fmtSigned(worstWeekday?.stats.totalPnl ?? 0)} size="sm" tone="down" />
        </Card>
        <Card title="Streaks">
          <StatGrid cols={3}>
            <Stat label="Now" value={streak.current} size="sm" />
            <Stat label="Best" value={streak.best} size="sm" tone="up" />
            <Stat label="Worst" value={streak.worst} size="sm" tone="down" />
          </StatGrid>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Equity curve" action={<span className="text-[11px] text-dim">Cumulative P&L</span>}>
          <LineChart series={[{ points: curve, colour: '#22d39a', label: 'Cumulative' }]} />
        </Card>
        <Card title="Net daily P&L">
          <BarChart bars={days.sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ label: d.date.slice(5), value: d.pnl }))} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Sessions" action={<span className="text-[11px] text-dim">Size and time in the trade</span>}>
          <BreakdownTable rows={sessionRows} columns={['trades', 'winRate', 'avgWin', 'avgLoss', 'hold', 'winHold', 'lossHold']} />
        </Card>
        <Card title="Entries · slot">
          <BreakdownTable rows={slotRows} columns={['trades', 'winRate', 'avgR', 'pf']} />
          <div className="mt-4 space-y-2">
            <div className="card-title">Trigger rate</div>
            {triggers.map((t) => (
              <div key={t.slot} className="flex items-center justify-between text-sm">
                <span className="text-dim">{t.slot}</span>
                <span className="tabular text-[#cdefe2]">
                  {fmtPct(t.rate)} <span className="text-dim">of {t.of} sessions</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Weekdays">
          <BreakdownTable rows={weekdayRows} columns={['trades', 'winRate', 'avgR', 'bar']} />
        </Card>
        <Card title="Hour of day (New York)">
          <BreakdownTable rows={hourRows} columns={['trades', 'winRate', 'avgR', 'bar']} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Instruments">
          <BreakdownTable rows={instrumentRows} columns={['trades', 'winRate', 'avgWin', 'avgLoss', 'bar']} />
        </Card>
        <Card title="Direction">
          <SplitBar
            left={longs.length}
            right={shorts.length}
            leftLabel={`Long ${longs.length} · ${fmtSigned(computeStats(longs, config.beBandR).totalPnl)}`}
            rightLabel={`Short ${shorts.length} · ${fmtSigned(computeStats(shorts, config.beBandR).totalPnl)}`}
          />
          <div className="mt-4">
            <BreakdownTable
              rows={breakdown(trades, config.beBandR, (t) => t.side, (k) => (k === 'LONG' ? 'Long' : 'Short'))}
              columns={['trades', 'winRate', 'avgR', 'pf']}
            />
          </div>
          <div className="mt-4 text-xs text-dim">
            Avg hold {fmtHold(stats.avgHoldMins)} · winners {fmtHold(stats.winHoldMins)} · losers {fmtHold(stats.lossHoldMins)}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Playbooks">
          <BreakdownTable rows={playbookRows} columns={['trades', 'winRate', 'avgR', 'pf']} emptyLabel="Attach a playbook to trades to see this." />
        </Card>
        <Card title="Rules followed vs broken">
          <BreakdownTable rows={ruleRows} columns={['trades', 'winRate', 'avgR', 'pf']} emptyLabel="Tick playbook rules on a trade to see this." />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Mistake tags" action={<span className="text-[11px] text-dim">{tags.length} tags configured</span>}>
          <BreakdownTable rows={mistakeRows} columns={['trades', 'winRate', 'avgR', 'bar']} emptyLabel="No mistakes tagged. Good." />
        </Card>
        <Card title="Eval vs funded">
          <BreakdownTable rows={stageRows} columns={['trades', 'winRate', 'avgR', 'pf']} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-dim">
            {stageRows.map((row) => (
              <span key={row.key}>
                {row.label}: <MoneyText value={row.stats.totalPnl} />
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
