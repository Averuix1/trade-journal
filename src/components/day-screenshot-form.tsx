'use client';

import { useActionState } from 'react';
import { addDayScreenshot } from '@/lib/actions/trades';
import type { FormState } from '@/lib/actions/shared';

const initial: FormState = {};

export function DayScreenshotForm({ accountId, date }: { accountId: number; date: string }) {
  const [state, action, pending] = useActionState(addDayScreenshot, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="date" value={date} />
      <input type="file" name="screenshots" accept="image/*" multiple className="field max-w-xs text-xs" />
      <button className="btn btn-sm" type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Add shot'}
      </button>
      {state.error && <span className="text-xs text-loss-text">{state.error}</span>}
      {state.message && <span className="text-xs text-mint-300">{state.message}</span>}
    </form>
  );
}
