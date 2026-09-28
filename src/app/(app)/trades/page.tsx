import Link from 'next/link';
import { Badge, Card, Empty, MoneyText, Stat, StatGrid } from '@/components/ui';
import { NoAccounts } from '@/components/no-accounts';
import { TradeForm } from '@/components/trade-form';
import { deleteTrade, toggleTradeHidden } from '@/lib/actions/trades';
import {
  getHiddenDays,
  getInstruments,
  getMistakeTags,
  getPlaybookRules,
  getPlaybooks,
  getScope,
  getSessionDefs,
  getSettings,
  getTrades,
} from '@/lib/queries';
import { computeStats } from '@/lib/stats';
import { fmtHold, fmtNum, fmtPct, fmtR, fmtSigned } from '@/lib/format';
import { formatTime, utcToZonedInput } from '@/lib/time';
import { BREAK_LABELS } from '@/lib/defaults';

export const metadata = { title: 'Trades — Trade Journal' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TradesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const [config, sessions, instruments, playbooks, playbookRules, mistakeTags] = await Promise.all([
    getSettings(),
    getSessionDefs(),
    getInstruments(),
    getPlaybooks(),
    getPlaybookRules(),
    getMistakeTags(),
  ]);

  const from = one(params.from);
  const to = one(params.to);
  const sessionFilter = one(params.session) ?? 'all';
  const symbolFilter = one(params.symbol) ?? 'all';
  const systemFilter = one(params.system) ?? 'all';
  const showNew = one(params.new) === '1';
  const editId = Number(one(params.edit) ?? 0);

  const all = await getTrades({ accountIds: scope.accountIds, from, to, includeHidden: true });
  const trades = all
    .filter((t) => {
      if (sessionFilter !== 'all' && t.sessionKey !== sessionFilter) return false;
      if (symbolFilter !== 'all' && t.symbol !== symbolFilter) return false;
      if (systemFilter === 'in' && !t.inSystem) return false;
      if (systemFilter === 'out' && t.inSystem) return false;
      return true;
    })
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());

  // The table lists everything; the summary cards match the rest of the app and skip hidden days.
  const hiddenDays = await getHiddenDays(scope.accountIds);
  const isHidden = (t: (typeof trades)[number]) => t.hidden || hiddenDays.has(`${t.accountId}|${t.tradeDate}`);
  const stats = computeStats(trades.filter((t) => !isHidden(t)), config.beBandR);
  const editing = editId ? all.find((t) => t.id === editId) : undefined;

  const now = new Date();
  const defaultOpenedAt = utcToZonedInput(now, config.timezone);
  const defaultAccountId = scope.account?.id ?? config.lastAccountId ?? scope.accounts[0].id;
  const defaultSymbol = config.lastSymbol ?? instruments[0]?.symbol ?? 'NQ';

  return (
    <div className="space-y-5">
      {(showNew || editing) && (
        <Card title={editing ? `Edit trade #${editing.id}` : 'Log a trade'}>
          <TradeForm
            accounts={scope.accounts}
            instruments={instruments}
            playbooks={playbooks}
            playbookRules={playbookRules}
            mistakeTags={mistakeTags}
            trade={editing}
            openedAtLocal={editing ? utcToZonedInput(editing.openedAt, config.timezone) : undefined}
            closedAtLocal={editing?.closedAt ? utcToZonedInput(editing.closedAt, config.timezone) : undefined}
            defaultAccountId={defaultAccountId}
            defaultSymbol={defaultSymbol}
            defaultOpenedAt={defaultOpenedAt}
            cancelHref="/trades"
          />
        </Card>
      )}

      <Card bodyClassName="px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end gap-3">
          <form className="flex flex-wrap items-end gap-3">
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
            <div>
              <label className="label" htmlFor="session">
                Session
              </label>
              <select id="session" name="session" defaultValue={sessionFilter} className="text-sm">
                <option value="all">All</option>
                {sessions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="symbol">
                Instrument
              </label>
              <select id="symbol" name="symbol" defaultValue={symbolFilter} className="text-sm">
                <option value="all">All</option>
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="system">
                System
              </label>
              <select id="system" name="system" defaultValue={systemFilter} className="text-sm">
                <option value="all">All</option>
                <option value="in">In system</option>
                <option value="out">Outside</option>
              </select>
            </div>
            <button className="btn" type="submit">
              Filter
            </button>
            <Link className="btn btn-ghost" href="/trades">
              Reset
            </Link>
          </form>
          {!showNew && !editing && (
            <Link className="btn btn-primary ml-auto" href="/trades?new=1">
              + Log a trade
            </Link>
          )}
        </div>
      </Card>

      <StatGrid cols={5}>
        <Card bodyClassName="card-pad">
          <Stat label="Trades" value={stats.trades} size="sm" />
        </Card>
        <Card bodyClassName="card-pad">
          <Stat label="Net P&L" value={fmtSigned(stats.totalPnl)} size="sm" tone={stats.totalPnl >= 0 ? 'up' : 'down'} />
        </Card>
        <Card bodyClassName="card-pad">
          <Stat label="Win rate" value={fmtPct(stats.winRate)} size="sm" />
        </Card>
        <Card bodyClassName="card-pad">
          <Stat label="Profit factor" value={fmtNum(stats.profitFactor)} size="sm" />
        </Card>
        <Card bodyClassName="card-pad">
          <Stat label="Total R" value={fmtR(stats.totalR)} size="sm" tone={stats.totalR >= 0 ? 'up' : 'down'} />
        </Card>
      </StatGrid>

      <Card title={`${trades.length} trade${trades.length === 1 ? '' : 's'}`}>
        {trades.length === 0 ? (
          <Empty
            title="No trades yet"
            body="Log your first trade with the button above, or bring in a CSV from TopstepX or Tradovate."
            action={{ href: '/trades?new=1', label: 'Log a trade' }}
          />
        ) : (
          <div className="scroll-x">
            <table className="tabular">
              <thead>
                <tr>
                  <th className="py-1.5">Date</th>
                  <th>Time</th>
                  <th>Account</th>
                  <th>Session</th>
                  <th>Slot</th>
                  <th>Instr.</th>
                  <th>Side</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Exit</th>
                  <th className="text-right">Hold</th>
                  <th className="text-right">Fees</th>
                  <th className="text-right">P&L</th>
                  <th className="text-right">R</th>
                  <th>Flag</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-rows">
                {trades.map((t) => (
                  <tr key={t.id} className={isHidden(t) ? 'opacity-45' : ''}>
                    <td className="py-1.5 whitespace-nowrap">{t.tradeDate}</td>
                    <td className="whitespace-nowrap text-dim">{formatTime(t.openedAt, config.timezone)}</td>
                    <td className="max-w-[9rem] truncate text-dim">{scope.accounts.find((a) => a.id === t.accountId)?.name}</td>
                    <td className="text-dim">{sessions.find((s) => s.key === t.sessionKey)?.shortName ?? '—'}</td>
                    <td>{t.slot ?? '—'}</td>
                    <td>{t.symbol}</td>
                    <td className="text-dim">{t.side === 'LONG' ? 'Long' : 'Short'}</td>
                    <td className="text-right text-dim">{t.contracts}</td>
                    <td className="text-right text-dim">{t.entryPrice ?? '—'}</td>
                    <td className="text-right text-dim">{t.exitPrice ?? '—'}</td>
                    <td className="text-right text-dim">
                      {fmtHold(t.closedAt ? (t.closedAt.getTime() - t.openedAt.getTime()) / 60000 : null)}
                    </td>
                    <td className="text-right text-dim">{t.fees.toFixed(2)}</td>
                    <td className="text-right">
                      <MoneyText value={t.pnl} decimals />
                    </td>
                    <td className="text-right text-dim">{fmtR(t.rMultiple)}</td>
                    <td className="whitespace-nowrap">
                      {t.hidden ? (
                        <Badge tone="warn">Hidden</Badge>
                      ) : hiddenDays.has(`${t.accountId}|${t.tradeDate}`) ? (
                        <Badge tone="warn">Hidden day</Badge>
                      ) : t.inSystem ? (
                        <Badge tone="up">In</Badge>
                      ) : (
                        <Badge tone="down">{BREAK_LABELS[t.breaks[0]] ?? 'Out'}</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Link href={`/trades?edit=${t.id}`} className="btn btn-sm btn-ghost">
                        Edit
                      </Link>
                      <form action={toggleTradeHidden} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn btn-sm btn-ghost" type="submit">
                          {t.hidden ? 'Show' : 'Hide'}
                        </button>
                      </form>
                      <form action={deleteTrade} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn btn-sm btn-ghost text-[#ff9aa3]" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
