'use client';

import { useActionState } from 'react';
import { moveTradesToAccount } from '@/lib/actions/trades';
import type { FormState } from '@/lib/actions/shared';

const initial: FormState = {};

export function TradeBulkForm({ accounts }: { accounts: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(moveTradesToAccount, initial);

  return (
    <form id="trade-bulk-move" action={action} className="mb-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="bulkAccount">
            Move selected to
          </label>
          <select id="bulkAccount" name="accountId" className="text-sm">
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Moving…' : 'Move'}
        </button>
      </div>
      <p className="text-[11px] text-dim">
        Moving a trade takes its chart screenshots with it. The day’s journal and day screenshots stay on the original
        account. If the destination already has the same external id, nothing is moved.
      </p>
      {state.error && <p className="text-sm text-loss-text">{state.error}</p>}
      {state.message && <p className="text-sm text-mint-200">{state.message}</p>}
    </form>
  );
}
