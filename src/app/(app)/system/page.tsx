import { Badge, Card, MoneyText, Stat, StatGrid } from '@/components/ui';
import { HBar, LineChart } from '@/components/charts';
import { NoAccounts } from '@/components/no-accounts';
import { RulesEditor } from '@/components/rules-editor';
import { round2 } from '@/lib/calc';
import { getAccountMoney, getScope, getSessionDefs, getSettings, getTrades } from '@/lib/queries';
import { computeStats, dailyEquityCurve, groupByDay } from '@/lib/stats';
import { fmtMoney, fmtNum, fmtPct, fmtR, fmtSigned } from '@/lib/format';
import { BREAK_DESCRIPTIONS, BREAK_LABELS } from '@/lib/defaults';
import { formatTime } from '@/lib/time';

export const metadata = { title: 'System — Trade Journal' };

export default async function SystemPage() {
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const [config, sessions, trades, money] = await Promise.all([
    getSettings(),
    getSessionDefs(),
    getTrades({ accountIds: scope.accountIds }),
    getAccountMoney(scope.accounts),
  ]);

  const inSystem = trades.filter((t) => t.inSystem);
  const outside = trades.filter((t) => !t.inSystem);
  const inStats = computeStats(inSystem, config.beBandR);
  const outStats = computeStats(outside, config.beBandR);

  const startBalance = scope.account
    ? (scope.account.type === 'PROP' ? (scope.account.accountSize ?? 0) : scope.account.startingBalance)
    : scope.accounts.reduce((sum, a) => sum + (a.type === 'PROP' ? (a.accountSize ?? 0) : a.startingBalance), 0);
  const liveBalance = scope.account
    ? (money.get(scope.account.id)?.balance ?? 0)
    : [...money.values()].reduce((sum, m) => sum + m.balance, 0);
  // Live minus the outside-the-system trades, so the two cards always differ by exactly the leak.
  const cleanBalance = round2(liveBalance - outStats.totalPnl);
  const leak = outStats.totalPnl;

  const cleanCurve = dailyEquityCurve([...groupByDay(inSystem, config.beBandR).values()], startBalance);
  const liveCurve = dailyEquityCurve([...groupByDay(trades, config.beBandR).values()], startBalance);

  const reasons = new Map<string, { count: number; pnl: number }>();
  for (const t of outside) {
    for (const reason of t.breaks) {
      const entry = reasons.get(reason) ?? { count: 0, pnl: 0 };
      entry.count += 1;
      entry.pnl += t.pnl;
      reasons.set(reason, entry);
    }
  }

  const followed = inSystem.length;
  const total = trades.length;
  const followRate = total ? (followed / total) * 100 : 0;

  const headline =
    leak < 0
      ? `You gave ${fmtMoney(Math.abs(leak))} back.`
      : leak > 0
        ? `Outside the system added ${fmtMoney(leak)}. Still not the system.`
        : total === 0
          ? 'Log or import trades. This sheet is the whole point.'
          : 'No leak. Every dollar is inside the rules.';

  return (
    <div className="space-y-5">
      <Card>
        <h1 className="text-2xl font-semibold tracking-tight text-[#eafff7]">{headline}</h1>
        <p className="mt-1 text-sm text-dim">
          T1–T{scope.account?.maxTradesPerSession ?? 3} inside the session entry window is in. Dump, late and tagged
          mistakes are out.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-mint-500/30 bg-mint-500/5 p-4">
            <div className="card-title">If you stopped</div>
            <div className="tabular mt-1 text-2xl font-semibold text-mint-200">{fmtMoney(cleanBalance)}</div>
            <div className="mt-1 text-[11px] text-dim">In-system trades only</div>
          </div>
          <div className="rounded-xl border border-[#7a2331]/60 bg-[#3a1119]/40 p-4">
            <div className="card-title">Leak</div>
            <div className="tabular mt-1 text-2xl font-semibold text-[#ff9aa3]">{fmtSigned(leak)}</div>
            <div className="mt-1 text-[11px] text-dim">{outside.length} break(s)</div>
          </div>
          <div className="rounded-xl border border-line bg-ink-850 p-4">
            <div className="card-title">Live account</div>
            <div className="tabular mt-1 text-2xl font-semibold text-[#eafff7]">{fmtMoney(liveBalance)}</div>
            <div className="mt-1 text-[11px] text-dim">What you actually kept</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-[#cdefe2]">
              {followed} of {total} trades followed the plan
            </span>
            <span className="tabular text-dim">{fmtPct(followRate)}</span>
          </div>
          <HBar pct={followRate} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="In the system" action={<Badge tone="up">Clean</Badge>}>
          <StatGrid cols={2}>
            <Stat label="Total" value={fmtSigned(inStats.totalPnl)} tone={inStats.totalPnl >= 0 ? 'up' : 'down'} />
            <Stat label="Avg R" value={fmtR(inStats.avgR)} />
            <Stat label="Win rate" value={fmtPct(inStats.winRate)} />
            <Stat label="Profit factor" value={fmtNum(inStats.profitFactor)} />
          </StatGrid>
          <p className="mt-3 text-xs text-dim">{inStats.trades} trades inside the rules.</p>
        </Card>
        <Card title="Outside the system" action={<Badge tone="down">Leak</Badge>}>
          <StatGrid cols={2}>
            <Stat label="Total" value={fmtSigned(outStats.totalPnl)} tone={outStats.totalPnl >= 0 ? 'up' : 'down'} />
            <Stat label="Avg R" value={fmtR(outStats.avgR)} />
            <Stat label="Win rate" value={fmtPct(outStats.winRate)} />
            <Stat label="Profit factor" value={fmtNum(outStats.profitFactor)} />
          </StatGrid>
          <p className="mt-3 text-xs text-dim">
            {outStats.trades} trades over the cap, late, or tagged with a mistake. Never counted as clean.
          </p>
        </Card>
      </div>

      <Card title="Clean vs live" action={<span className="text-[11px] text-dim">Green if you had stopped. Grey is the account with the leak in.</span>}>
        <LineChart
          series={[
            { points: cleanCurve, colour: '#22d39a', label: 'If you stopped' },
            { points: liveCurve, colour: '#8fa8a1', label: 'Live account', dashed: true },
          ]}
          showZero={false}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Leak log · why it left">
          {reasons.size === 0 ? (
            <p className="text-sm text-dim">Clean book.</p>
          ) : (
            <div className="divide-rows">
              {[...reasons.entries()]
                .sort((a, b) => a[1].pnl - b[1].pnl)
                .map(([reason, entry]) => (
                  <div key={reason} className="py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-[#cdefe2]">{BREAK_LABELS[reason] ?? reason}</span>
                      <span className="tabular text-sm">
                        <MoneyText value={entry.pnl} /> <span className="text-dim">· {entry.count}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-dim">{BREAK_DESCRIPTIONS[reason] ?? ''}</div>
                  </div>
                ))}
            </div>
          )}
          {outside.length > 0 && (
            <div className="scroll-x mt-4">
              <table className="tabular">
                <thead>
                  <tr>
                    <th className="py-1.5">Date</th>
                    <th>Time</th>
                    <th>Slot</th>
                    <th>Instrument</th>
                    <th className="text-right">P&L</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody className="divide-rows">
                  {outside.slice(-12).reverse().map((t) => (
                    <tr key={t.id}>
                      <td className="py-1.5">{t.tradeDate}</td>
                      <td className="text-dim">{formatTime(t.openedAt, config.timezone)}</td>
                      <td>{t.slot ?? '—'}</td>
                      <td>{t.symbol}</td>
                      <td className="text-right">
                        <MoneyText value={t.pnl} />
                      </td>
                      <td className="text-dim">{t.breaks.map((b) => BREAK_LABELS[b] ?? b).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Rules">
          {scope.account ? (
            <RulesEditor account={scope.account} sessions={sessions} />
          ) : (
            <p className="text-sm text-dim">Pick a single account in the header to edit its rules.</p>
          )}
        </Card>
      </div>

      <Card title="Day sheet">
        <div className="scroll-x">
          <table className="tabular">
            <thead>
              <tr>
                <th className="py-1.5">Date</th>
                <th className="text-right">Clean</th>
                <th className="text-right">Live</th>
                <th className="text-right">Trades</th>
                <th className="text-right">$ in</th>
                <th className="text-right">$ out</th>
                <th>Kept</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {[...groupByDay(trades, config.beBandR).values()]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 20)
                .map((day) => {
                  const dayIn = inSystem.filter((t) => t.tradeDate === day.date).reduce((s, t) => s + t.pnl, 0);
                  const dayOut = outside.filter((t) => t.tradeDate === day.date).reduce((s, t) => s + t.pnl, 0);
                  return (
                    <tr key={day.date}>
                      <td className="py-1.5">{day.date}</td>
                      <td className="text-right">
                        <MoneyText value={dayIn} />
                      </td>
                      <td className="text-right">
                        <MoneyText value={day.pnl} />
                      </td>
                      <td className="text-right text-dim">{day.trades}</td>
                      <td className="text-right text-dim">{fmtSigned(dayIn)}</td>
                      <td className="text-right text-dim">{fmtSigned(dayOut)}</td>
                      <td>{day.breaks ? <Badge tone="down">Broke</Badge> : <Badge tone="up">Kept</Badge>}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
