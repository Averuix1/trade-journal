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
import { fmtMoney, fmtPct, fmtR, fmtRShort, fmtSigned, fmtSignedCompact } from '@/lib/format';
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

  const today = todayKey('America/New_York');
  const month = one(params.month) ?? today.slice(0, 7);
  const view = one(params.view) === 'week' ? 'week' : 'month';
  const sessionFilter = one(params.session) ?? 'all';
  const systemFilter = one(params.system) ?? 'all';
  const selectedDay = one(params.day);
  const weekAnchor = one(params.week) ?? startOfWeek(today);

  const [year, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(year, m)).padStart(2, '0')}`;
  const rangeFrom = view === 'week' ? weekAnchor : monthStart;
  const rangeTo = view === 'week' ? addDays(weekAnchor, 6) : monthEnd;

  const panelAccountId = scope.account?.id ?? scope.accountIds[0];
  const dayInRange = Boolean(selectedDay && selectedDay >= rangeFrom && selectedDay <= rangeTo);
  const [config, sessions, tags, allTrades, hiddenDayKeys, journals, shots] = await Promise.all([
    getSettings(),
    getSessionDefs(),
    getMistakeTags(),
    getTrades({ accountIds: scope.accountIds, from: rangeFrom, to: rangeTo, includeHidden: true }),
    getHiddenDays(scope.accountIds),
    getJournals(scope.accountIds, rangeFrom, rangeTo),
    selectedDay ? getScreenshots(scope.accountIds, selectedDay) : Promise.resolve([]),
  ]);
  const hiddenDates = new Set([...hiddenDayKeys].map((k) => k.split('|')[1]));
  const selectedJournal = !selectedDay
    ? undefined
    : dayInRange
      ? journals.find((journal) => journal.accountId === panelAccountId && journal.date === selectedDay)
      : await getJournal(panelAccountId, selectedDay);

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
  const monthR = dayList.reduce((sum, d) => sum + d.r, 0);

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

  const qs = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      month,
      view: view === 'week' ? 'week' : undefined,
      session: sessionFilter === 'all' ? undefined : sessionFilter,
      system: systemFilter === 'all' ? undefined : systemFilter,
      week: view === 'week' ? weekAnchor : undefined,
      day: selectedDay,
      ...overrides,
    };
    for (const [k, v] of Object.entries(base)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/calendar?${s}` : '/calendar';
  };

  const panelData = selectedDay
    ? {
        date: selectedDay,
        accountId: panelAccountId,
        trades: allTrades
          .filter((t) => t.tradeDate === selectedDay && !t.hidden)
          .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime()),
        journal: selectedJournal,
        screenshots: shots,
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
            <Link href={qs({ view: undefined })} className={`rounded-md px-3 py-1 text-xs ${view === 'month' ? 'chip-on' : 'text-dim'}`}>
              Month
            </Link>
            <Link href={qs({ view: 'week', week: startOfWeek(today) })} className={`rounded-md px-3 py-1 text-xs ${view === 'week' ? 'chip-on' : 'text-dim'}`}>
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
              <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-fg-strong">
                {view === 'week' ? `Week of ${weekAnchor}` : `${monthName(m)} ${year}`}
                <span
                  className={`tabular rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    monthTotal > 0 ? 'bg-profit/15 text-profit-text' : monthTotal < 0 ? 'bg-loss/15 text-loss-text' : 'bg-ink-800 text-dim'
                  }`}
                >
                  {fmtSigned(monthTotal)}
                  <span className="ml-1.5 text-xs font-medium opacity-80">{fmtR(monthR)}</span>
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
                  className={`rounded-md px-2.5 py-1 text-xs ${systemFilter === option.key ? 'chip-on' : 'text-dim'}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <form>
              {view === 'week' && <input type="hidden" name="week" value={weekAnchor} />}
              {view === 'week' && <input type="hidden" name="view" value="week" />}
              <input type="hidden" name="month" value={month} />
              {systemFilter !== 'all' && <input type="hidden" name="system" value={systemFilter} />}
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
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(64px,0.75fr)] gap-1 sm:grid-cols-[repeat(5,minmax(0,1fr))_minmax(90px,0.75fr)] sm:gap-2">
          {DOW.map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] uppercase tracking-[0.16em] text-dim">
              {d}
            </div>
          ))}
          <div className="pb-1 text-center text-[10px] uppercase tracking-[0.14em] text-dim">
            Week
            <div className="text-[9px] normal-case tracking-normal text-dim">total</div>
          </div>

          {weeks.map((week) => {
            const weekKeys = [...week.days.filter(Boolean), ...week.weekendKeys] as string[];
            const weekDays = weekKeys.map((k) => days.get(k)).filter(Boolean) as DaySummary[];
            const weekTotal = weekDays.reduce((sum, d) => sum + d.pnl, 0);
            const weekR = weekDays.reduce((sum, d) => sum + d.r, 0);
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
                        ? 'bg-profit/15 text-profit-text'
                        : summary.pnl < 0
                          ? 'bg-loss/15 text-loss-text'
                          : 'bg-ink-700 text-fg';
                  return (
                    // Same-page client navigations are cancelled while the route skeleton is showing.
                    <a
                      key={key}
                      href={qs({ day: key })}
                      className={`relative flex min-h-[86px] min-w-0 flex-col rounded-lg px-1 py-1 transition sm:rounded-xl sm:px-2 sm:py-1.5 hover:ring-2 hover:ring-mint-400/50 ${tone} ${
                        selectedDay === key ? 'ring-2 ring-mint-300' : ''
                      } ${isToday ? 'ring-1 ring-mint-400/40' : ''}`}
                    >
                      <span className="text-[10px] font-medium opacity-70">{Number(key.slice(8))}</span>
                      {summary && !isHidden && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: summary.breaks ? 'rgb(var(--loss-text))' : 'rgb(var(--mint-300))' }} />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
                        {isHidden ? (
                          <span className="text-[9px] uppercase tracking-widest text-dim sm:text-[10px]">Hidden</span>
                        ) : summary ? (
                          <>
                            <span className="tabular whitespace-nowrap text-[11px] font-semibold leading-tight sm:text-sm">
                              <span className="sm:hidden">{fmtSignedCompact(summary.pnl)}</span>
                              <span className="hidden sm:inline">{fmtSigned(summary.pnl)}</span>
                            </span>
                            <span className="tabular whitespace-nowrap text-[9px] font-medium leading-tight opacity-80 max-[299px]:hidden sm:text-[11px]">
                              <span className="min-[360px]:hidden">{fmtRShort(summary.r)}</span>
                              <span className="max-[359px]:hidden">{fmtR(summary.r)}</span>
                            </span>
                            <span className="mt-0.5 hidden text-[10px] opacity-70 sm:block">
                              {summary.trades} trade{summary.trades === 1 ? '' : 's'}
                            </span>
                          </>
                        ) : journal?.satOut ? (
                          <span className="text-[9px] uppercase tracking-widest text-dim sm:text-[10px]">Sat out</span>
                        ) : null}
                      </div>
                    </a>
                  );
                })}
                <div className="flex min-h-[86px] min-w-0 flex-col items-center justify-center rounded-lg bg-ink-850/80 px-1 py-1 text-center sm:rounded-xl sm:px-2 sm:py-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-dim">{week.key.split('-')[1]}</span>
                  {weekDays.length ? (
                    <>
                      <span
                        className={`tabular mt-1 flex flex-col leading-tight ${weekTotal > 0 ? 'text-profit-text' : weekTotal < 0 ? 'text-loss-text' : 'text-dim'}`}
                      >
                        <span className="whitespace-nowrap text-[11px] font-semibold sm:text-sm">
                          <span className="sm:hidden">{fmtSignedCompact(weekTotal)}</span>
                          <span className="hidden sm:inline">{fmtSigned(weekTotal)}</span>
                        </span>
                        <span className="whitespace-nowrap text-[9px] font-medium opacity-80 sm:text-[11px]">{fmtR(weekR)}</span>
                      </span>
                      <span className="text-[9px] text-dim sm:text-[10px]">{weekTrades} trades</span>
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
            <Stat label="Total" value={fmtSigned(monthTotal)} size="sm" tone={monthTotal >= 0 ? 'up' : 'down'} sub={fmtR(monthR)} />
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
                          <a href={qs({ day: day.date })} className="text-mint-300 hover:underline">
                            {day.date}
                          </a>
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
