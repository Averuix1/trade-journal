import Link from 'next/link';
import { Card, KeyValue, Stat, StatGrid } from '@/components/ui';
import { NoAccounts } from '@/components/no-accounts';
import { getAccountMoney, getInstruments, getLedger, getScope, getSettings, getTrades } from '@/lib/queries';
import { groupByDay } from '@/lib/stats';
import { propStatus } from '@/lib/prop';
import { fmtMoney, fmtPct } from '@/lib/format';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Tank — Trade Journal' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STOP_PRESETS = [20, 25, 30, 35];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TankPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const account = scope.account ?? scope.accounts.find((item) => !item.isQuickLog) ?? scope.accounts[0];
  if (account.isQuickLog) {
    return (
      <Card title="Tank">
        <p className="text-sm text-dim">
          Not applicable for Quick log. Tank needs a balance and drawdown rules, and Quick log does not keep either.
          Switch to a prop or personal account.
        </p>
      </Card>
    );
  }
  const [config, instruments, money, trades, ledger] = await Promise.all([
    getSettings(),
    getInstruments(),
    getAccountMoney(scope.accounts),
    getTrades({ accountIds: [account.id] }),
    getLedger([account.id]),
  ]);
  const today = todayKey('America/New_York');

  const risk = Number(one(params.risk) ?? account.riskPerTrade) || account.riskPerTrade;
  const customStop = Number(one(params.stop) ?? 0) || null;
  const stops = customStop && !STOP_PRESETS.includes(customStop) ? [...STOP_PRESETS, customStop].sort((a, b) => a - b) : STOP_PRESETS;
  const activeStop = customStop ?? STOP_PRESETS[0];

  const balance = money.get(account.id)?.balance ?? 0;
  const payouts = ledger.filter((l) => l.kind === 'PAYOUT').reduce((s, l) => s + l.amount, 0);
  const days = [...groupByDay(trades, config.beBandR).values()];
  const prop = account.type === 'PROP' ? propStatus(account, days, trades, payouts, today) : null;

  const drawdownRoom = prop?.drawdownLeft ?? balance;
  const dailyRoom = prop?.dailyLossLeft ?? null;
  const lossesToBlow = risk > 0 ? Math.floor(Math.max(0, drawdownRoom) / risk) : 0;
  const lossesToday = dailyRoom != null && risk > 0 ? Math.floor(Math.max(0, dailyRoom) / risk) : null;
  const riskPctOfBalance = balance > 0 ? (risk / balance) * 100 : 0;

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | undefined> = { risk, stop: customStop ?? undefined, ...overrides };
    for (const [k, v] of Object.entries(base)) if (v) next.set(k, String(v));
    return `/tank?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <Card title={`Tank · ${account.name}`}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <form className="space-y-3">
            <div>
              <label className="label" htmlFor="risk">
                Risk per trade ($)
              </label>
              <input id="risk" name="risk" type="number" step="10" defaultValue={risk} className="field" />
              <p className="mt-1 text-[11px] text-dim">
                {fmtMoney(risk)} is {fmtPct(riskPctOfBalance)} of the {fmtMoney(balance)} balance.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="stop">
                Custom stop (points)
              </label>
              <input id="stop" name="stop" type="number" step="1" defaultValue={customStop ?? ''} className="field" placeholder="e.g. 42" />
            </div>
            <button className="btn btn-primary" type="submit">
              Recalculate
            </button>
          </form>

          <div>
            <StatGrid cols={3}>
              <Stat label="Balance" value={fmtMoney(balance)} size="sm" />
              <Stat
                label={prop ? 'Room to the cut-off' : 'Room to zero'}
                value={fmtMoney(drawdownRoom)}
                size="sm"
                sub={prop?.drawdownLine != null ? `cut-off ${fmtMoney(prop.drawdownLine)}` : undefined}
              />
              <Stat
                label="Full-risk losses left"
                value={lossesToBlow}
                size="sm"
                tone={lossesToBlow <= 2 ? 'down' : 'up'}
                sub={`at ${fmtMoney(risk)} each`}
              />
            </StatGrid>
            <div className="mt-4 divide-rows">
              {dailyRoom != null && (
                <KeyValue
                  label="Daily loss room left today"
                  value={`${fmtMoney(dailyRoom)} · ${lossesToday} full-risk loss${lossesToday === 1 ? '' : 'es'}`}
                  tone={dailyRoom <= risk ? 'down' : undefined}
                />
              )}
              {prop && <KeyValue label="Drawdown type" value={prop.drawdownType ?? 'not set'} />}
              <KeyValue label="Max trades per session" value={account.maxTradesPerSession} />
              <KeyValue
                label="Worst case if you take the full cap"
                value={fmtMoney(-risk * account.maxTradesPerSession)}
                tone="down"
              />
            </div>
            {prop && prop.drawdownLimit == null && (
              <p className="mt-3 text-[11px] text-warn">
                No max drawdown entered for this account —{' '}
                <Link href={`/accounts/${account.id}`} className="underline">
                  add it
                </Link>{' '}
                so the tank can count your losses left.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Contracts per stop size"
        action={
          <div className="flex flex-wrap gap-1">
            {stops.map((s) => (
              <Link
                key={s}
                href={qs({ stop: s })}
                className={`rounded-md px-2 py-1 text-xs ${activeStop === s ? 'chip-on' : 'bg-ink-850 text-dim'}`}
              >
                {s} pt
              </Link>
            ))}
          </div>
        }
      >
        <div className="scroll-x">
          <table className="tabular">
            <thead>
              <tr>
                <th className="py-1.5">Instrument</th>
                <th className="text-right">$ / point</th>
                {stops.map((s) => (
                  <th key={s} className="text-right">
                    {s} pt stop
                  </th>
                ))}
                <th className="text-right">$ risk at {activeStop} pt</th>
                <th className="text-right">Losses left</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {instruments.map((inst) => {
                if (inst.pointValue == null) {
                  return (
                    <tr key={inst.symbol}>
                      <td className="py-1.5">
                        <span className="font-medium text-fg-strong">{inst.symbol}</span>
                        <span className="ml-2 text-xs text-dim">{inst.name}</span>
                      </td>
                      <td className="text-right text-dim">$ / R only</td>
                      <td colSpan={stops.length + 2} className="text-dim">
                        Dollar results only
                      </td>
                    </tr>
                  );
                }
                const pointValue = inst.pointValue;
                const contractsAt = (stop: number) => Math.floor(risk / (stop * pointValue));
                const chosen = Math.max(0, contractsAt(activeStop));
                const actualRisk = chosen * activeStop * pointValue;
                const left = actualRisk > 0 ? Math.floor(Math.max(0, drawdownRoom) / actualRisk) : 0;
                return (
                  <tr key={inst.symbol}>
                    <td className="py-1.5">
                      <span className="font-medium text-fg-strong">{inst.symbol}</span>
                      <span className="ml-2 text-xs text-dim">{inst.name}</span>
                    </td>
                    <td className="text-right text-dim">{fmtMoney(pointValue)}</td>
                    {stops.map((s) => {
                      const n = contractsAt(s);
                      return (
                        <td key={s} className={`text-right ${s === activeStop ? 'text-mint-200' : 'text-fg'}`}>
                          {n > 0 ? `${n}x` : <span className="text-dim/60">—</span>}
                        </td>
                      );
                    })}
                    <td className="text-right text-dim">{chosen > 0 ? fmtMoney(actualRisk) : '—'}</td>
                    <td className="text-right font-medium text-fg-strong">
                      {chosen > 0 ? left : <span className="text-dim/60">too big for this risk</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-dim">
          Contracts are rounded down so a full stop never costs more than your risk. &ldquo;Losses left&rdquo; counts
          full-risk losses before {prop ? 'the drawdown cut-off' : 'a zero balance'} — it does not include fees or
          slippage.
        </p>
      </Card>
    </div>
  );
}
