import { Badge, Card, KeyValue, MoneyText, Stat, StatGrid } from '@/components/ui';
import { LedgerForm } from '@/components/ledger-form';
import { NoAccounts } from '@/components/no-accounts';
import { deleteLedgerEntry } from '@/lib/actions/money';
import { getAccountMoney, getLedger, getScope, getSettings, getTrades } from '@/lib/queries';
import { FEE_KINDS, LEDGER_KINDS } from '@/lib/defaults';
import { fmtMoney, fmtPct, fmtSigned } from '@/lib/format';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Money — Trade Journal' };

export default async function MoneyPage() {
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const config = await getSettings();
  const money = await getAccountMoney(scope.accounts);
  const ledgerAccountIds = scope.account ? [scope.account.id] : scope.accountIds;
  const ledger = await getLedger(ledgerAccountIds);
  const trades = await getTrades({ accountIds: scope.accountIds });

  const propAccounts = scope.accounts.filter((a) => a.type === 'PROP');
  const propIds = new Set(propAccounts.map((a) => a.id));
  const allLedger = await getLedger(scope.accounts.map((a) => a.id));
  const propLedger = allLedger.filter((l) => propIds.has(l.accountId));

  const totalFees = propLedger.filter((l) => FEE_KINDS.includes(l.kind)).reduce((s, l) => s + l.amount, 0);
  const evalSpend = propLedger.filter((l) => l.kind === 'EVAL_FEE' || l.kind === 'RESET_FEE').reduce((s, l) => s + l.amount, 0);
  const totalPayouts = propLedger.filter((l) => l.kind === 'PAYOUT').reduce((s, l) => s + l.amount, 0);
  const netOnSpend = totalPayouts - totalFees;
  const payoutCount = propLedger.filter((l) => l.kind === 'PAYOUT').length;
  const passedCount = propAccounts.filter((a) => a.stage === 'FUNDED').length;
  const evalsBought = propLedger.filter((l) => l.kind === 'EVAL_FEE' || l.kind === 'RESET_FEE').length;

  const stageOf = new Map(scope.accounts.map((a) => [a.id, a.stage]));
  const evalPnl = trades.filter((t) => stageOf.get(t.accountId) === 'EVAL').reduce((s, t) => s + t.pnl, 0);
  const fundedPnl = trades.filter((t) => stageOf.get(t.accountId) === 'FUNDED').reduce((s, t) => s + t.pnl, 0);

  const today = todayKey(config.timezone);
  const kindLabel = (kind: string) => LEDGER_KINDS.find((k) => k.value === kind)?.label ?? kind;
  const kindSign = (kind: string) => LEDGER_KINDS.find((k) => k.value === kind)?.sign ?? 1;

  return (
    <div className="space-y-5">
      {propAccounts.length > 0 && (
        <Card title="Prop house · all prop accounts" action={<span className="text-[11px] text-dim">{propAccounts.length} accounts</span>}>
          <StatGrid cols={6}>
            <Stat label="Total fees" value={fmtMoney(-totalFees)} tone="down" size="sm" sub={`${evalsBought} evals/resets`} />
            <Stat label="Total payouts" value={fmtMoney(totalPayouts)} tone="up" size="sm" sub={`${payoutCount} payouts`} />
            <Stat label="Net on spend" value={fmtSigned(netOnSpend)} tone={netOnSpend >= 0 ? 'up' : 'down'} size="sm" />
            <Stat
              label="Return on spend"
              value={totalFees > 0 ? fmtPct((netOnSpend / totalFees) * 100) : '—'}
              tone={netOnSpend >= 0 ? 'up' : 'down'}
              size="sm"
            />
            <Stat
              label="Cost per pass"
              value={passedCount > 0 ? fmtMoney(evalSpend / passedCount) : '—'}
              size="sm"
              sub={`${passedCount} passed`}
            />
            <Stat
              label="Cost per payout"
              value={payoutCount > 0 ? fmtMoney(totalFees / payoutCount) : '—'}
              size="sm"
            />
          </StatGrid>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-ink-850/60 p-3">
              <div className="card-title">Eval tape</div>
              <div className="tabular mt-1 text-xl font-semibold">
                <MoneyText value={evalPnl} />
              </div>
            </div>
            <div className="rounded-xl border border-line bg-ink-850/60 p-3">
              <div className="card-title">Funded tape</div>
              <div className="tabular mt-1 text-xl font-semibold">
                <MoneyText value={fundedPnl} />
              </div>
            </div>
            <div className="rounded-xl border border-line bg-ink-850/60 p-3">
              <div className="card-title">Eval spend</div>
              <div className="tabular mt-1 text-xl font-semibold text-[#ff9aa3]">{fmtMoney(-evalSpend)}</div>
            </div>
          </div>
        </Card>
      )}

      <Card title="Accounts">
        <div className="scroll-x">
          <table className="tabular">
            <thead>
              <tr>
                <th className="py-1.5">Account</th>
                <th>Type</th>
                <th className="text-right">Start / size</th>
                <th className="text-right">Trading P&L</th>
                <th className="text-right">Fees</th>
                <th className="text-right">Payouts</th>
                <th className="text-right">Deposits</th>
                <th className="text-right">Withdrawn</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Net on spend</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {scope.accounts.map((a) => {
                const m = money.get(a.id)!;
                return (
                  <tr key={a.id}>
                    <td className="py-1.5 text-[#cdefe2]">{a.name}</td>
                    <td>
                      {a.type === 'PROP' ? (
                        <Badge tone={a.stage === 'FUNDED' ? 'up' : a.stage === 'BLOWN' ? 'down' : 'neutral'}>
                          {a.firm} · {a.stage}
                        </Badge>
                      ) : (
                        <Badge>Personal</Badge>
                      )}
                    </td>
                    <td className="text-right text-dim">{fmtMoney(a.type === 'PROP' ? (a.accountSize ?? 0) : a.startingBalance)}</td>
                    <td className="text-right">
                      <MoneyText value={m.netPnl} />
                    </td>
                    <td className="text-right text-dim">{m.fees ? fmtMoney(-m.fees) : '—'}</td>
                    <td className="text-right text-dim">{m.payouts ? fmtMoney(m.payouts) : '—'}</td>
                    <td className="text-right text-dim">{m.deposits ? fmtMoney(m.deposits) : '—'}</td>
                    <td className="text-right text-dim">{m.withdrawals ? fmtMoney(-m.withdrawals) : '—'}</td>
                    <td className="text-right font-medium text-[#e6fff5]">{fmtMoney(m.balance)}</td>
                    <td className="text-right">
                      <MoneyText value={m.netOnSpend} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a money entry">
        <LedgerForm accounts={scope.accounts} defaultAccountId={scope.account?.id ?? scope.accounts[0].id} today={today} />
        <p className="mt-3 text-[11px] text-dim">
          Fees, resets, activations and data charges come out. Payouts, deposits go in. Withdrawals leave a personal
          account.
        </p>
      </Card>

      <Card title={scope.account ? `Ledger · ${scope.account.name}` : 'Ledger · all accounts'}>
        {ledger.length === 0 ? (
          <p className="text-sm text-dim">
            No entries yet. Start balance is the opening deposit; log your eval fee so cost-per-pass stays honest.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="tabular">
              <thead>
                <tr>
                  <th className="py-1.5">Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-rows">
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-1.5">{entry.date}</td>
                    <td className="text-dim">{scope.accounts.find((a) => a.id === entry.accountId)?.name}</td>
                    <td className="text-[#cdefe2]">{kindLabel(entry.kind)}</td>
                    <td className="text-right">
                      <MoneyText value={kindSign(entry.kind) * entry.amount} decimals />
                    </td>
                    <td className="text-dim">{entry.note ?? '—'}</td>
                    <td className="text-right">
                      <form action={deleteLedgerEntry}>
                        <input type="hidden" name="id" value={entry.id} />
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

      {scope.account && (
        <Card title={`${scope.account.name} summary`}>
          <div className="divide-rows">
            <KeyValue label="Trading P&L" value={fmtSigned(money.get(scope.account.id)?.netPnl ?? 0)} />
            <KeyValue label="Fees paid" value={fmtMoney(-(money.get(scope.account.id)?.fees ?? 0))} tone="down" />
            <KeyValue label="Payouts received" value={fmtMoney(money.get(scope.account.id)?.payouts ?? 0)} tone="up" />
            <KeyValue label="Balance" value={fmtMoney(money.get(scope.account.id)?.balance ?? 0)} />
          </div>
        </Card>
      )}
    </div>
  );
}
