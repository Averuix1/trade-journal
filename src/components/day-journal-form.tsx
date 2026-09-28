'use client';

import { useActionState } from 'react';
import type { DayJournal } from '@/lib/db/schema';
import { saveDayJournal } from '@/lib/actions/journal';
import type { FormState } from '@/lib/actions/shared';
import { GRADES } from '@/lib/defaults';

const initial: FormState = {};

export function DayJournalForm({
  accountId,
  date,
  journal,
}: {
  accountId: number;
  date: string;
  journal: DayJournal | undefined;
}) {
  const [state, action, pending] = useActionState(saveDayJournal, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="date" value={date} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="grade">
            Grade
          </label>
          <select id="grade" name="grade" defaultValue={journal?.grade ?? ''} className="field">
            <option value="">—</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mood">
            Mood 1–5
          </label>
          <input id="mood" name="mood" type="number" min={1} max={5} defaultValue={journal?.mood ?? ''} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="sleepHours">
            Sleep (h)
          </label>
          <input
            id="sleepHours"
            name="sleepHours"
            type="number"
            step="0.5"
            min={0}
            max={16}
            defaultValue={journal?.sleepHours ?? ''}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="followedPlan">
            Followed plan
          </label>
          <select
            id="followedPlan"
            name="followedPlan"
            defaultValue={journal?.followedPlan == null ? '' : journal.followedPlan ? 'true' : 'false'}
            className="field"
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="lesson">
          Lesson
        </label>
        <input id="lesson" name="lesson" defaultValue={journal?.lesson ?? ''} className="field" placeholder="One line you want to remember" />
      </div>
      <div>
        <label className="label" htmlFor="notes">
          Journal
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={journal?.notes ?? ''}
          className="field"
          placeholder="What you saw, what you did, what you would repeat."
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-[#cdefe2]">
        <input type="checkbox" name="satOut" defaultChecked={journal?.satOut ?? false} />
        Sat out / no-trade day
      </label>
      {state.error && <p className="text-sm text-[#ff9aa3]">{state.error}</p>}
      {state.message && <p className="text-sm text-mint-300">{state.message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save journal'}
      </button>
    </form>
  );
}
