import Link from 'next/link';
import { Badge, Card, Empty, MoneyText } from '@/components/ui';
import { setAccountStage, setAccountStatus } from '@/lib/actions/accounts';
import { getAccountMoney, getAccounts, groupAccounts } from '@/lib/queries';
import { fmtMoney } from '@/lib/format';

export const metadata = { title: 'Accounts — Trade Journal' };

export default async function AccountsPage() {
  const accounts = await getAccounts();
  const money = await getAccountMoney(accounts);
  const groups = groupAccounts(accounts);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-fg-strong">Accounts</h1>
        <Link href="/accounts/new" className="btn btn-primary">
          + New account
        </Link>
      </div>

      {accounts.length === 0 ? (
        <Empty
          title="Add your first account"
          body="An account is one book — a Topstep eval, a funded account, or your own money. Trades, rules, calendar and stats all hang off it."
          action={{ href: '/accounts/new', label: 'Add your first account' }}
        />
      ) : (
        groups.map((group) => (
          <Card key={group.label} title={group.label}>
            <div className="space-y-2">
              {group.accounts.map((account) => {
                const m = money.get(account.id)!;
                return (
                  <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-ink-850/50 px-4 py-3">
                    <div className="min-w-[12rem] flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/accounts/${account.id}`} className="text-sm font-medium text-fg-strong hover:underline">
                          {account.name}
                        </Link>
                        {account.type === 'PROP' ? (
                          <Badge tone={account.stage === 'FUNDED' ? 'up' : account.stage === 'BLOWN' ? 'down' : 'neutral'}>
                            {account.firm} · {account.stage}
                          </Badge>
                        ) : (
                          <Badge>Personal</Badge>
                        )}
                        {account.status === 'ARCHIVED' && <Badge tone="warn">Archived</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-dim">
                        Since {account.startDate} · size {fmtMoney(account.type === 'PROP' ? (account.accountSize ?? 0) : account.startingBalance)}
                        {account.resetOfAccountId ? ` · reset of #${account.resetOfAccountId}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular text-sm font-semibold text-fg-strong">{fmtMoney(m.balance)}</div>
                      <div className="text-[11px]">
                        <MoneyText value={m.netPnl} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {account.type === 'PROP' && account.stage !== 'FUNDED' && (
                        <form action={setAccountStage}>
                          <input type="hidden" name="id" value={account.id} />
                          <input type="hidden" name="stage" value="FUNDED" />
                          <button className="btn btn-sm" type="submit">
                            Mark passed
                          </button>
                        </form>
                      )}
                      {account.type === 'PROP' && account.stage !== 'BLOWN' && (
                        <form action={setAccountStage}>
                          <input type="hidden" name="id" value={account.id} />
                          <input type="hidden" name="stage" value="BLOWN" />
                          <button className="btn btn-sm" type="submit">
                            Mark blown
                          </button>
                        </form>
                      )}
                      <form action={setAccountStatus}>
                        <input type="hidden" name="id" value={account.id} />
                        <input type="hidden" name="status" value={account.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'} />
                        <button className="btn btn-sm btn-ghost" type="submit">
                          {account.status === 'ACTIVE' ? 'Archive' : 'Unarchive'}
                        </button>
                      </form>
                      <Link className="btn btn-sm btn-ghost" href={`/accounts/${account.id}`}>
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      <p className="text-[11px] text-dim">
        Blown and archived accounts keep every trade, note and fee. Nothing is deleted when you mark an account blown.
      </p>
    </div>
  );
}
