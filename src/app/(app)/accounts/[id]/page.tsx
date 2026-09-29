import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { AccountForm } from '@/components/account-form';
import { deleteAccount, resetAccount } from '@/lib/actions/accounts';
import { getAccount, getSessionDefs, getSettings } from '@/lib/queries';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Edit account — Trade Journal' };

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, sessions, config] = await Promise.all([getAccount(Number(id)), getSessionDefs(), getSettings()]);
  if (!account) notFound();
  const today = todayKey(config.timezone);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold tracking-tight text-[#eafff7]">{account.name}</h1>

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
            <label className="flex items-center gap-2 pb-2 text-sm text-[#cdefe2]">
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
        <form action={deleteAccount} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={account.id} />
          <p className="flex-1 text-sm text-dim">
            Deleting removes this account and every trade, note, screenshot and money entry on it. Archiving is almost
            always what you want instead.
          </p>
          <button className="btn btn-danger" type="submit">
            Delete account and all its data
          </button>
        </form>
      </Card>
    </div>
  );
}
