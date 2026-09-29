import { Card, MoneyText, Stat, StatGrid } from '@/components/ui';
import { BarChart, Gauge, LineChart, SplitBar } from '@/components/charts';
import { BreakdownTable } from '@/components/breakdown-table';
import { NoAccounts } from '@/components/no-accounts';
import {
  getJournals,
  getMistakeTags,
  getPlaybooks,
  getScope,
  getSessionDefs,
  getSettings,
  getTrades,
} from '@/lib/queries';
import {
  breakdown,
  checklistVerdict,
  computeDayStats,
  computeStats,
  dailyEquityCurve,
  dayProfitFactor,
  groupByDay,
  maxDrawdown,
  processSlice,
  ruleBreakDaysByWeekday,
  streaks,
  tradeStreaks,
  triggerRates,
  weekdayBreakdown,
  type ProcessSlice,
} from '@/lib/stats';
import { fmtHold, fmtMoney, fmtNum, fmtPct, fmtR, fmtSigned } from '@/lib/format';
import { minuteOfDay, NY_TZ } from '@/lib/time';

export const metadata = { title: 'Stats — Trade Journal' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}


function ProcessTable({ rows, empty }: { rows: ProcessSlice[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-dim">{empty}</p>;
  return (
    <table className="tabular text-sm">
      <thead>
        <tr>
          <th className="py-1.5"> </th>
          <th className="text-right">Days</th>
          <th className="text-right">P&L</th>
          <th className="text-right">R</th>
          <th className="text-right">Day win %</th>
        </tr>
      </thead>
      <tbody className="divide-rows">
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="py-1.5">{row.label}</td>
            <td className="text-right">{row.days}</td>
            <td className="text-right">
              <MoneyText value={row.pnl} />
            </td>
            <td className="text-right text-dim">{fmtR(row.r)}</td>
            <td className="text-right">{fmtPct(row.winRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const from = one(params.from);
  const to = one(params.to);
  const [config, sessions, playbooks, tags, raw, journals] = await Promise.all([
    getSettings(),
    getSessionDefs(),
    getPlaybooks(),
    getMistakeTags(),
    getTrades({ accountIds: scope.accountIds, from, to }),
    getJournals(scope.accountIds, from, to),
  ]);

  const stage = one(params.stage) ?? 'all';
  const sessionFilter = one(params.session) ?? 'all';
  const direction = one(params.direction) ?? 'all';
  const systemFilter = one(params.system) ?? 'all';

  const accountById = new Map(scope.accounts.map((a) => [a.id, a]));
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
  const dayStreak = streaks(days);
  const tradeStreak = tradeStreaks(trades, config.beBandR);
  const dayPf = dayProfitFactor(days);
  type ProcessDay = {
    date: string;
    pnl: number;
    r: number;
    rulesFollowed: boolean | null;
    reason: string | null;
    mood: number | null;
    sleptWell: boolean | null;
    grade: string | null;
    checklist: 'passed' | 'failed' | 'blank';
  };
  const processDays = new Map<string, ProcessDay>();
  for (const trade of trades) {
    const key = `${trade.accountId}|${trade.tradeDate}`;
    const row = processDays.get(key) ?? {
      date: trade.tradeDate,
      pnl: 0,
      r: 0,
      rulesFollowed: null,
      reason: null,
      mood: null,
      sleptWell: null,
      grade: null,
      checklist: 'blank' as const,
    };
    row.pnl += trade.pnl;
    row.r += trade.rMultiple ?? 0;
    processDays.set(key, row);
  }
  for (const journal of journals) {
    const key = `${journal.accountId}|${journal.date}`;
    const row = processDays.get(key) ?? {
      date: journal.date,
      pnl: 0,
      r: 0,
      rulesFollowed: null,
      reason: null,
      mood: null,
      sleptWell: null,
      grade: null,
      checklist: 'blank' as const,
    };
    row.rulesFollowed = journal.rulesFollowed;
    row.reason = journal.ruleBreakReason;
    row.mood = journal.mood;
    row.sleptWell = journal.sleptWell;
    row.grade = journal.grade;
    row.checklist = checklistVerdict(journal.checklist, config.checklistSkipIfNo);
    processDays.set(key, row);
  }
  const processList = [...processDays.values()];
  const followedSlice = processSlice('Rules followed', processList.filter((day) => day.rulesFollowed === true));
  const brokenSlice = processSlice('Rules broken', processList.filter((day) => day.rulesFollowed === false));
  const reasonMap = new Map<string, ProcessDay[]>();
  for (const day of processList) {
    if (!day.reason) continue;
    const list = reasonMap.get(day.reason) ?? [];
    list.push(day);
    reasonMap.set(day.reason, list);
  }
  const reasonRows = [...reasonMap.entries()]
    .map(([label, list]) => processSlice(label, list))
    .sort((a, b) => a.pnl - b.pnl);
  const moodRows = [1, 2, 3, 4, 5]
    .map((mood) => processSlice(String(mood), processList.filter((day) => day.mood === mood)))
    .filter((row) => row.days > 0);
  const sleepRows = [
    processSlice('Slept well', processList.filter((day) => day.sleptWell === true)),
    processSlice('Slept poorly', processList.filter((day) => day.sleptWell === false)),
  ].filter((row) => row.days > 0);
  const gradeRows = ['A', 'B', 'C', 'D', 'F']
    .map((grade) => processSlice(grade, processList.filter((day) => day.grade === grade)))
    .filter((row) => row.days > 0);
  const checklistRows = [
    processSlice('Checklist passed', processList.filter((day) => day.checklist === 'passed')),
    processSlice('Checklist failed', processList.filter((day) => day.checklist === 'failed')),
  ].filter((row) => row.days > 0);
  const breakWeekdays = ruleBreakDaysByWeekday(
    processList.map((day) => ({ date: day.date, broke: day.rulesFollowed === false })),
  );

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
            <Stat label="Trade profit factor" value={fmtNum(stats.profitFactor)} sub="per trade" />
            <Stat label="Day profit factor" value={dayPf == null ? '∞' : fmtNum(dayPf)} sub="green days / red days" />
            <Stat label="Expectancy" value={fmtSigned(stats.expectancy)} sub="per trade" tone={stats.expectancy >= 0 ? 'up' : 'down'} />
            <Stat label="Avg achieved R" value={fmtR(stats.avgR)} sub={`${fmtR(stats.totalR)} total`} />
            <Stat
              label="Avg planned RR"
              value={stats.avgPlannedRr == null ? '—' : fmtR(stats.avgPlannedRr)}
              sub="take profit ÷ risk"
            />
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
          <div className="space-y-3">
            <div>
              <div className="card-title mb-1">Day streaks</div>
              <StatGrid cols={3}>
                <Stat label="Now" value={dayStreak.current} size="sm" />
                <Stat label="Best" value={dayStreak.best} size="sm" tone="up" />
                <Stat label="Worst" value={dayStreak.worst} size="sm" tone="down" />
              </StatGrid>
            </div>
            <div>
              <div className="card-title mb-1">Trade streaks</div>
              <StatGrid cols={3}>
                <Stat label="Now" value={tradeStreak.current} size="sm" />
                <Stat label="Best" value={tradeStreak.best} size="sm" tone="up" />
                <Stat label="Worst" value={tradeStreak.worst} size="sm" tone="down" />
              </StatGrid>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Equity curve" action={<span className="text-[11px] text-dim">Cumulative P&L</span>}>
          <LineChart series={[{ points: curve, colour: 'rgb(var(--mint-400))', label: 'Cumulative' }]} />
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
                <span className="tabular text-fg">
                  {fmtPct(t.rate)} <span className="text-dim">of {t.of} sessions</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div id="process" className="space-y-5">
        <Card title="By day · rules followed vs broken">
          <ProcessTable
            rows={[followedSlice, brokenSlice].filter((row) => row.days > 0)}
            empty="Mark Rules followed? on a day to see this."
          />
          <p className="mt-2 text-[11px] text-dim">
            Day win % is green days over green and red days. A day can be marked followed and still carry a reason.
          </p>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Rule-break reasons by cost">
            <ProcessTable rows={reasonRows} empty="No reasons logged in this range." />
            <p className="mt-2 text-[11px] text-dim">Sorted by P&amp;L, most costly first. Cost is the day&rsquo;s result, not a single trade.</p>
          </Card>
          <Card title="Checklist passed vs failed">
            <ProcessTable rows={checklistRows} empty="Tick a pre-session checklist to see this." />
            <p className="mt-2 text-[11px] text-dim">
              Failed means a session had more than {config.checklistSkipIfNo} No answers. Days with no checklist are left out.
            </p>
          </Card>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="By mood">
            <ProcessTable rows={moodRows} empty="No mood logged." />
          </Card>
          <Card title="By sleep">
            <ProcessTable rows={sleepRows} empty="No sleep answer logged." />
          </Card>
          <Card title="By grade">
            <ProcessTable rows={gradeRows} empty="No grade logged." />
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Rule-break days by weekday">
          {breakWeekdays.length === 0 ? (
            <p className="text-sm text-dim">No days in this range.</p>
          ) : (
            <table className="tabular text-sm">
              <thead>
                <tr>
                  <th className="py-1.5">Weekday</th>
                  <th className="text-right">Days</th>
                  <th className="text-right">Rule-break days</th>
                </tr>
              </thead>
              <tbody className="divide-rows">
                {breakWeekdays.map((row) => (
                  <tr key={row.weekday}>
                    <td className="py-1.5">{row.weekday}</td>
                    <td className="text-right">{row.days}</td>
                    <td className="text-right">{row.breakDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] text-dim">
            A rule-break day is one where Rules followed? is No.
          </p>
        </Card>
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
        <Card title="By trade · rules followed vs broken">
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
