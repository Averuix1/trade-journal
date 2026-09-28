import { Card } from '@/components/ui';
import { AccountForm } from '@/components/account-form';
import { getSessionDefs, getSettings } from '@/lib/queries';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'New account — Trade Journal' };

export default async function NewAccountPage() {
  const [sessions, config] = await Promise.all([getSessionDefs(), getSettings()]);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[#eafff7]">New account</h1>
        <p className="mt-1 text-sm text-dim">
          One account per book. A Topstep eval, the funded account it turns into, and your personal money are separate
          accounts.
        </p>
      </div>
      <Card>
        <AccountForm sessions={sessions} today={todayKey(config.timezone)} />
      </Card>
    </div>
  );
}
