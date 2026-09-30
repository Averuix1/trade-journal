import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { AccountForm } from '@/components/account-form';
import { DeleteAccountPanel } from '@/components/delete-account-panel';
import { resetAccount } from '@/lib/actions/accounts';
import { getAccount, getSessionDefs, getSettings } from '@/lib/queries';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Edit account — Super-Journal' };

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, sessions, config] = await Promise.all([getAccount(Number(id)), getSessionDefs(), getSettings()]);
  if (!account) notFound();
  const today = todayKey(config.timezone);

  if (account.isQuickLog) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-lg font-semibold tracking-tight text-fg-strong">Quick log</h1>
        <Card title="Built-in trade space">
          <p className="text-sm text-dim">
            Quick log holds trades that are not tied to a prop or personal account. It needs only the date, instrument,
            direction, risk and result. Balance, drawdown, fees and prop rules do not apply. It cannot be deleted,
            archived or marked blown. Trades you keep when deleting another account land here, labelled with that
            account’s name.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold tracking-tight text-fg-strong">{account.name}</h1>

      <Card>
        <AccountForm account={account} sessions={sessions} today={today} />
      </Card>

      {account.type === 'PROP' && (
        <Card title="Reset · buy the next eval">
          <p className="mb-3 text-sm text-dim">
            A reset keeps this book exactly as it is and opens a fresh eval with the same size and rules.
          </p>
          <form action={resetAccount} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={account.id} />
            <div>
              <label className="label" htmlFor="resetFee">
                Reset fee paid ($)
              </label>
              <input id="resetFee" name="resetFee" type="number" step="0.01" className="text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="resetStart">
                New eval start
              </label>
              <input id="resetStart" name="startDate" type="date" defaultValue={today} className="text-sm" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-fg">
              <input type="checkbox" name="markBlown" defaultChecked />
              Mark this one blown
            </label>
            <button className="btn btn-primary" type="submit">
              Log reset
            </button>
          </form>
        </Card>
      )}

      <Card title="Danger zone">
        <DeleteAccountPanel id={account.id} name={account.name} />
      </Card>
    </div>
  );
}
