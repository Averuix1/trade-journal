'use client';

import { useActionState } from 'react';
import type { Account } from '@/lib/db/schema';
import { addLedgerEntry } from '@/lib/actions/money';
import type { FormState } from '@/lib/actions/shared';
import { LEDGER_KINDS } from '@/lib/defaults';

const initial: FormState = {};

export function LedgerForm({ accounts, defaultAccountId, today }: { accounts: Account[]; defaultAccountId: number; today: string }) {
  const [state, action, pending] = useActionState(addLedgerEntry, initial);
  const defaultAccount = accounts.find((a) => a.id === defaultAccountId) ?? accounts[0];
  const kinds = LEDGER_KINDS.filter((k) => !defaultAccount || k.scope === defaultAccount.type);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="ledgerAccount">
          Account
        </label>
        <select id="ledgerAccount" name="accountId" defaultValue={defaultAccountId} className="text-sm">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ledgerKind">
          Type
        </label>
        <select id="ledgerKind" name="kind" defaultValue={kinds[0]?.value} className="text-sm">
          {LEDGER_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ledgerDate">
          Date
        </label>
        <input id="ledgerDate" name="date" type="date" defaultValue={today} className="text-sm" />
      </div>
      <div>
        <label className="label" htmlFor="ledgerAmount">
          Amount ($)
        </label>
        <input id="ledgerAmount" name="amount" type="number" step="0.01" min="0" className="text-sm" placeholder="0.00" />
      </div>
      <div className="min-w-[12rem] flex-1">
        <label className="label" htmlFor="ledgerNote">
          Note
        </label>
        <input id="ledgerNote" name="note" className="field text-sm" placeholder="Optional" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add entry'}
      </button>
      {state.error && <p className="w-full text-sm text-[#ff9aa3]">{state.error}</p>}
      {state.message && <p className="w-full text-sm text-mint-300">{state.message}</p>}
    </form>
  );
}
