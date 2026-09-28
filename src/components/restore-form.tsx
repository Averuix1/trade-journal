'use client';

import { useActionState } from 'react';
import { restoreBackup } from '@/lib/actions/import';
import type { FormState } from '@/lib/actions/shared';

const initial: FormState = {};

export function RestoreForm() {
  const [state, action, pending] = useActionState(restoreBackup, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[14rem] flex-1">
        <label className="label" htmlFor="backupFile">
          Backup .json file
        </label>
        <input id="backupFile" name="file" type="file" accept="application/json,.json" className="field" />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Restoring…' : 'Restore backup'}
      </button>
      {state.error && <p className="w-full text-sm text-[#ff9aa3]">{state.error}</p>}
      {state.message && <p className="w-full text-sm text-mint-300">{state.message}</p>}
      <p className="w-full text-[11px] text-dim">
        Restoring adds the accounts from the file alongside your current ones, each suffixed &ldquo;(restored)&rdquo;.
        Nothing is overwritten.
      </p>
    </form>
  );
}
