import Link from 'next/link';
import { Badge, Card, MoneyText, Stat, StatGrid } from '@/components/ui';
import { DayPanel } from '@/components/day-panel';
import { NoAccounts } from '@/components/no-accounts';
import {
  getHiddenDays,
  getJournal,
  getJournals,
  getMistakeTags,
  getScope,
  getScreenshots,
  getSessionDefs,
  getSettings,
  getTrades,
} from '@/lib/queries';
import { computeDayStats, computeStats, groupByDay, type DaySummary } from '@/lib/stats';
import { fmtMoney, fmtPct, fmtR, fmtSigned } from '@/lib/format';
import { addDays, daysInMonth, isoWeekKey, monthName, startOfWeek, todayKey } from '@/lib/time';
import { BREAK_LABELS } from '@/lib/defaults';

export const metadata = { title: 'Calendar — Trade Journal' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function monthShift(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const [config, sessions, tags] = await Promise.all([getSettings(), getSessionDefs(), getMistakeTags()]);
  const today = todayKey('America/New_York');
  const month = one(params.month) ?? today.slice(0, 7);
  const view = one(params.view) === 'week' ? 'week' : 'month';
  const sessionFilter = one(params.session) ?? 'all';
  const systemFilter = one(params.system) ?? 'all';
  const show = one(params.show) === 'r' ? 'r' : 'dollars';
  const selectedDay = one(params.day);
  const weekAnchor = one(params.week) ?? startOfWeek(today);

  const [year, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(year, m)).padStart(2, '0')}`;
  const rangeFrom = view === 'week' ? weekAnchor : monthStart;
  const rangeTo = view === 'week' ? addDays(weekAnchor, 6) : monthEnd;

  const allTrades = await getTrades({ accountIds: scope.accountIds, from: rangeFrom, to: rangeTo, includeHidden: true });
  const hiddenDayKeys = await getHiddenDays(scope.accountIds);
  const hiddenDates = new Set([...hiddenDayKeys].map((k) => k.split('|')[1]));
  const journals = await getJournals(scope.accountIds, rangeFrom, rangeTo);

  const filtered = allTrades.filter((t) => {
    if (t.hidden) return false;
    if (hiddenDates.has(t.tradeDate)) return false;
    if (sessionFilter !== 'all' && t.sessionKey !== sessionFilter) return false;
    if (systemFilter === 'in' && !t.inSystem) return false;
    if (systemFilter === 'out' && t.inSystem) return false;
    return true;
  });

  const days = groupByDay(filtered, config.beBandR);
  const dayList = [...days.values()];
  const stats = computeStats(filtered, config.beBandR);
  const dayStats = computeDayStats(dayList);
  const monthTotal = stats.totalPnl;

  const gridStart = view === 'week' ? weekAnchor : startOfWeek(monthStart);
  const weeksToRender = view === 'week' ? 1 : 6;
  const weeks: { key: string; days: (string | null)[]; weekendKeys: string[] }[] = [];
  for (let w = 0; w < weeksToRender; w += 1) {
    const rowStart = addDays(gridStart, w * 7);
    const rowDays: (string | null)[] = [];
    const weekendKeys: string[] = [];
    for (let d = 0; d < 5; d += 1) {
      const key = addDays(rowStart, d);
      rowDays.push(view === 'week' || key.slice(0, 7) === month ? key : null);
    }
    for (const d of [5, 6]) {
      const key = addDays(rowStart, d);
      if ((view === 'week' || key.slice(0, 7) === month) && days.get(key)) weekendKeys.push(key);
    }
    if (view === 'month' && rowDays.every((k) => k == null) && !weekendKeys.length && w >= 4) continue;
    weeks.push({ key: isoWeekKey(rowStart), days: rowDays, weekendKeys });
  }

  const displayValue = (summary: DaySummary | undefined) =>
    !summary ? '' : show === 'r' ? fmtR(summary.r) : fmtSigned(summary.pnl);

  const qs = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      month,
      view: view === 'week' ? 'week' : undefined,
      session: sessionFilter === 'all' ? undefined : sessionFilter,
      system: systemFilter === 'all' ? undefined : systemFilter,
      show: show === 'r' ? 'r' : undefined,
      week: view === 'week' ? weekAnchor : undefined,
      day: selectedDay,
      ...overrides,
    };
    for (const [k, v] of Object.entries(base)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/calendar?${s}` : '/calendar';
  };

  const panelAccountId = scope.account?.id ?? scope.accountIds[0];
  const panelData = selectedDay
    ? {
        date: selectedDay,
        accountId: panelAccountId,
        trades: allTrades
          .filter((t) => t.tradeDate === selectedDay && !t.hidden)
          .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime()),
        journal: await getJournal(panelAccountId, selectedDay),
        screenshots: await getScreenshots(scope.accountIds, selectedDay),
        sessions,
        timezone: config.timezone,
        closeHref: qs({ day: undefined }),
        mistakeTags: tags.map((tag) => tag.name),
        activeSessionKeys: scope.account?.activeSessions?.length
          ? scope.account.activeSessions
          : sessions.map((session) => session.key),
        checklistItems: config.checklistItems ?? [],
        checklistSkipIfNo: config.checklistSkipIfNo ?? 2,
      }
    : null;

  return (
    <div className="space-y-5">
      <Card bodyClassName="px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-850 p-0.5">
            <Link href={qs({ view: undefined })} className={`rounded-md px-3 py-1 text-xs ${view === 'month' ? 'bg-mint-500/20 text-mint-200' : 'text-dim'}`}>
              Month
            </Link>
            <Link href={qs({ view: 'week', week: startOfWeek(today) })} className={`rounded-md px-3 py-1 text-xs ${view === 'week' ? 'bg-mint-500/20 text-mint-200' : 'text-dim'}`}>
              Week
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={view === 'week' ? qs({ week: addDays(weekAnchor, -7) }) : qs({ month: monthShift(month, -1) })}
              className="btn btn-sm btn-ghost"
              aria-label="Previous"
            >
              ‹
            </Link>
            <div className="text-center">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#eafff7]">
                {view === 'week' ? `Week of ${weekAnchor}` : `${monthName(m)} ${year}`}
                <span
                  className={`tabular rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    monthTotal > 0 ? 'bg-mint-500/20 text-mint-200' : monthTotal < 0 ? 'bg-[#3a1119] text-[#ff9aa3]' : 'bg-ink-800 text-dim'
                  }`}
                >
                  {fmtSigned(monthTotal)}
                </span>
              </div>
              <div className="text-[11px] text-dim">
                {stats.trades} trades · {dayStats.days} days
              </div>
            </div>
            <Link
              href={view === 'week' ? qs({ week: addDays(weekAnchor, 7) }) : qs({ month: monthShift(month, 1) })}
              className="btn btn-sm btn-ghost"
              aria-label="Next"
            >
              ›
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-850 p-0.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'in', label: 'In system' },
                { key: 'out', label: 'Outside' },
              ].map((option) => (
                <Link
                  key={option.key}
                  href={qs({ system: option.key === 'all' ? undefined : option.key })}
                  className={`rounded-md px-2.5 py-1 text-xs ${systemFilter === option.key ? 'bg-mint-500/20 text-mint-200' : 'text-dim'}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-850 p-0.5">
              <Link href={qs({ show: undefined })} className={`rounded-md px-2.5 py-1 text-xs ${show === 'dollars' ? 'bg-mint-500/20 text-mint-200' : 'text-dim'}`}>
                $
              </Link>
              <Link href={qs({ show: 'r' })} className={`rounded-md px-2.5 py-1 text-xs ${show === 'r' ? 'bg-mint-500/20 text-mint-200' : 'text-dim'}`}>
                R
              </Link>
            </div>
            <form>
              {view === 'week' && <input type="hidden" name="week" value={weekAnchor} />}
              {view === 'week' && <input type="hidden" name="view" value="week" />}
              <input type="hidden" name="month" value={month} />
              {systemFilter !== 'all' && <input type="hidden" name="system" value={systemFilter} />}
              {show === 'r' && <input type="hidden" name="show" value="r" />}
              <select name="session" defaultValue={sessionFilter} className="text-xs" aria-label="Session filter">
                <option value="all">All sessions</option>
                {sessions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-sm ml-1">
                Go
              </button>
            </form>
          </div>
        </div>
      </Card>

      <Card bodyClassName="p-3 sm:p-4">
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(90px,0.75fr)] gap-2">
          {DOW.map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] uppercase tracking-[0.16em] text-dim">
              {d}
            </div>
          ))}
          <div className="pb-1 text-center text-[10px] uppercase tracking-[0.16em] text-[#9fd3c2]">
            Week
            <div className="text-[9px] normal-case tracking-normal text-dim">total</div>
          </div>

          {weeks.map((week) => {
            const weekKeys = [...week.days.filter(Boolean), ...week.weekendKeys] as string[];
            const weekDays = weekKeys.map((k) => days.get(k)).filter(Boolean) as DaySummary[];
            const weekTotal = weekDays.reduce((sum, d) => sum + d.pnl, 0);
            const weekTrades = weekDays.reduce((sum, d) => sum + d.trades, 0);
            return (
              <div key={week.key} className="contents">
                {week.days.map((key, i) => {
                  if (!key) return <div key={`${week.key}-${i}`} className="min-h-[86px] rounded-xl bg-ink-900/30" />;
                  const summary = days.get(key);
                  const isHidden = hiddenDates.has(key);
                  const journal = journals.find((j) => j.date === key);
                  const isToday = key === today;
                  const tone = isHidden
                    ? 'bg-ink-800/80 text-dim'
                    : !summary
                      ? 'bg-ink-900/60 text-dim/60'
                      : summary.pnl > 0
                        ? 'bg-profit text-[#e6fff3]'
                        : summary.pnl < 0
                          ? 'bg-loss text-[#ffe7ea]'
                          : 'bg-ink-700 text-[#cdefe2]';
                  return (
                    <Link
                      key={key}
                      href={qs({ day: key })}
                      className={`relative flex min-h-[86px] flex-col rounded-xl px-2 py-1.5 transition hover:ring-2 hover:ring-mint-400/50 ${tone} ${
                        selectedDay === key ? 'ring-2 ring-mint-300' : ''
                      } ${isToday ? 'ring-1 ring-mint-400/40' : ''}`}
                    >
                      <span className="text-[10px] font-medium opacity-70">{Number(key.slice(8))}</span>
                      {summary && !isHidden && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: summary.breaks ? '#ff6b7a' : '#4fe8b1' }} />
                      )}
                      <div className="flex flex-1 flex-col items-center justify-center">
                        {isHidden ? (
                          <span className="text-[10px] uppercase tracking-widest text-dim">Hidden</span>
                        ) : summary ? (
                          <>
                            <span className="tabular text-sm font-semibold">{displayValue(summary)}</span>
                            <span className="text-[10px] opacity-70">
                              {summary.trades} trade{summary.trades === 1 ? '' : 's'}
                            </span>
                          </>
                        ) : journal?.satOut ? (
                          <span className="text-[10px] uppercase tracking-widest text-dim">Sat out</span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
                <div className="flex min-h-[86px] flex-col items-center justify-center rounded-xl bg-ink-850/80 px-2 py-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-dim">{week.key.split('-')[1]}</span>
                  {weekDays.length ? (
                    <>
                      <span className={`tabular mt-1 text-sm font-semibold ${weekTotal > 0 ? 'text-[#7df3bd]' : weekTotal < 0 ? 'text-[#ff8c96]' : 'text-dim'}`}>
                        {show === 'r' ? fmtR(weekDays.reduce((s, d) => s + d.r, 0)) : fmtSigned(weekTotal)}
                      </span>
                      <span className="text-[10px] text-dim">{weekTrades} trades</span>
                      {week.weekendKeys.length > 0 && <span className="text-[9px] text-dim">incl. weekend</span>}
                    </>
                  ) : (
                    <span className="mt-1 text-sm text-dim">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Trades">
          <StatGrid cols={4}>
            <Stat label="Taken" value={stats.trades} size="sm" sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`} />
            <Stat label="Winning" value={stats.wins} size="sm" tone="up" />
            <Stat label="Losing" value={stats.losses} size="sm" tone="down" />
            <Stat label="Breakeven" value={stats.breakevens} size="sm" />
          </StatGrid>
          <div className="mt-3 flex gap-6 text-xs text-dim">
            <span>Win rate {fmtPct(stats.winRate)}</span>
            <span>BE rate {fmtPct(stats.beRate)}</span>
          </div>
        </Card>
        <Card title="Days">
          <StatGrid cols={3}>
            <Stat label="Winning" value={dayStats.winningDays} size="sm" tone="up" />
            <Stat label="Losing" value={dayStats.losingDays} size="sm" tone="down" />
            <Stat label="Day win rate" value={fmtPct(dayStats.dayWinRate)} size="sm" />
          </StatGrid>
        </Card>
        <Card title="P&L">
          <StatGrid cols={4}>
            <Stat label="Total" value={fmtSigned(monthTotal)} size="sm" tone={monthTotal >= 0 ? 'up' : 'down'} />
            <Stat label="Avg daily" value={fmtSigned(dayStats.avgDaily)} size="sm" tone={dayStats.avgDaily >= 0 ? 'up' : 'down'} />
            <Stat label="Best" value={fmtMoney(dayStats.bestDay?.pnl ?? 0)} size="sm" tone="up" />
            <Stat label="Worst" value={fmtMoney(dayStats.worstDay?.pnl ?? 0)} size="sm" tone="down" />
          </StatGrid>
        </Card>
      </div>

      <Card title="Daily log">
        {dayList.length === 0 ? (
          <p className="text-sm text-dim">No trades in this range.</p>
        ) : (
          <div className="scroll-x">
            <table className="tabular">
              <thead>
                <tr>
                  <th className="py-1.5">Date</th>
                  <th>Session</th>
                  <th>T1</th>
                  <th>T2</th>
                  <th>T3</th>
                  <th>Dump</th>
                  <th className="text-right">P&L</th>
                  <th className="text-right">R</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody className="divide-rows">
                {dayList
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((day) => {
                    const dayTrades = filtered.filter((t) => t.tradeDate === day.date);
                    const slotOf = (slot: string) => dayTrades.find((t) => t.slot === slot);
                    const dumps = dayTrades.filter((t) => t.breaks.includes('DUMP'));
                    const sessionNames = [
                      ...new Set(dayTrades.map((t) => sessions.find((s) => s.key === t.sessionKey)?.shortName ?? '—')),
                    ];
                    return (
                      <tr key={day.date}>
                        <td className="py-1.5">
                          <Link href={qs({ day: day.date })} className="text-mint-300 hover:underline">
                            {day.date}
                          </Link>
                        </td>
                        <td className="text-dim">{sessionNames.join(', ')}</td>
                        {['T1', 'T2', 'T3'].map((slot) => {
                          const trade = slotOf(slot);
                          return (
                            <td key={slot}>{trade ? <MoneyText value={trade.pnl} /> : <span className="text-dim/60">—</span>}</td>
                          );
                        })}
                        <td>{dumps.length ? <MoneyText value={dumps.reduce((s, t) => s + t.pnl, 0)} /> : <span className="text-dim/60">—</span>}</td>
                        <td className="text-right">
                          <MoneyText value={day.pnl} />
                        </td>
                        <td className="text-right text-dim">{fmtR(day.r)}</td>
                        <td>
                          {day.breaks ? (
                            <Badge tone="down">
                              {BREAK_LABELS[dayTrades.find((t) => !t.inSystem)?.breaks[0] ?? ''] ?? 'Break'}
                            </Badge>
                          ) : (
                            <Badge tone="up">Kept</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {panelData && <DayPanel data={panelData} />}
      {panelData && <Link href={panelData.closeHref} className="fixed inset-0 z-30 bg-black/50" aria-label="Close" />}
    </div>
  );
}
