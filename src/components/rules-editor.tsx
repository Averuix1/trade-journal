'use client';

import { useActionState } from 'react';
import type { Account, SessionDef } from '@/lib/db/schema';
import { updateAccountRules } from '@/lib/actions/accounts';
import type { FormState } from '@/lib/actions/shared';
import { minutesToClock } from '@/lib/time';

const initial: FormState = {};

export function RulesEditor({ account, sessions }: { account: Account; sessions: SessionDef[] }) {
  const [state, action, pending] = useActionState(updateAccountRules, initial);
  const active = account.activeSessions?.length ? account.activeSessions : sessions.map((s) => s.key);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={account.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="maxTradesPerSession">
            Max trades per session
          </label>
          <input
            id="maxTradesPerSession"
            name="maxTradesPerSession"
            type="number"
            min={1}
            max={10}
            defaultValue={account.maxTradesPerSession}
            className="field"
          />
          <p className="mt-1 text-[11px] text-dim">Anything past this is a Dump and counts as outside the system.</p>
        </div>
        <div>
          <label className="label" htmlFor="riskPerTrade">
            Risk per trade ($)
          </label>
          <input
            id="riskPerTrade"
            name="riskPerTrade"
            type="number"
            step="1"
            defaultValue={account.riskPerTrade}
            className="field"
          />
          <p className="mt-1 text-[11px] text-dim">Used by the Tank sizing calculator.</p>
        </div>
      </div>

      <div>
        <div className="label">Sessions you trade &amp; entry window from the open</div>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft bg-ink-850/50 px-3 py-2">
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm text-fg">
                <input type="checkbox" name="sessions" value={session.key} defaultChecked={active.includes(session.key)} />
                {session.name}
                <span className="text-[11px] text-dim">
                  {minutesToClock(session.startMinute)}–{minutesToClock(session.endMinute)} NY
                </span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-dim">
                window
                <input
                  name={`entryWindow_${session.key}`}
                  type="number"
                  min={0}
                  max={480}
                  defaultValue={account.entryWindows?.[session.key] ?? session.entryWindowMins}
                  className="w-20"
                />
                min
              </label>
            </div>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-loss-text">{state.error}</p>}
      {state.message && <p className="text-sm text-mint-300">{state.message}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save rules'}
      </button>
    </form>
  );
}
