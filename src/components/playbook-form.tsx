'use client';

import { useActionState } from 'react';
import type { Playbook, PlaybookRule } from '@/lib/db/schema';
import { createPlaybook, updatePlaybook } from '@/lib/actions/playbooks';
import type { FormState } from '@/lib/actions/shared';

const initial: FormState = {};

export function PlaybookForm({ playbook, rules }: { playbook?: Playbook; rules?: PlaybookRule[] }) {
  const [state, action, pending] = useActionState(playbook ? updatePlaybook : createPlaybook, initial);

  return (
    <form action={action} className="space-y-3">
      {playbook && <input type="hidden" name="id" value={playbook.id} />}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
        <div>
          <label className="label" htmlFor={`name-${playbook?.id ?? 'new'}`}>
            Name
          </label>
          <input id={`name-${playbook?.id ?? 'new'}`} name="name" defaultValue={playbook?.name ?? ''} className="field" placeholder="e.g. Opening range break" />
        </div>
        <div>
          <label className="label" htmlFor={`description-${playbook?.id ?? 'new'}`}>
            Description
          </label>
          <input id={`description-${playbook?.id ?? 'new'}`} name="description" defaultValue={playbook?.description ?? ''} className="field" placeholder="When you take it" />
        </div>
        <div>
          <label className="label" htmlFor={`colour-${playbook?.id ?? 'new'}`}>
            Colour
          </label>
          <input id={`colour-${playbook?.id ?? 'new'}`} name="colour" type="color" defaultValue={playbook?.colour ?? '#4EAA6E'} className="h-[38px] w-16 p-1" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`rules-${playbook?.id ?? 'new'}`}>
          Rules checklist — one per line
        </label>
        <textarea
          id={`rules-${playbook?.id ?? 'new'}`}
          name="rules"
          rows={5}
          defaultValue={(rules ?? []).map((r) => r.text).join('\n')}
          className="field font-mono text-xs"
          placeholder={'Level marked before the open\nWaited for the retest\nStop behind structure\nRisk within plan'}
        />
      </div>
      {state.error && <p className="text-sm text-loss-text">{state.error}</p>}
      {state.message && <p className="text-sm text-mint-300">{state.message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : playbook ? 'Save playbook' : 'Create playbook'}
      </button>
    </form>
  );
}
