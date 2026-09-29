'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import type { ChecklistRun, DayJournal, SessionDef } from '@/lib/db/schema';
import { saveDayJournal } from '@/lib/actions/journal';
import type { FormState } from '@/lib/actions/shared';
import { GRADES } from '@/lib/defaults';

const initial: FormState = {};

function triValue(value: boolean | null | undefined): string {
  if (value == null) return '';
  return value ? 'true' : 'false';
}

export function DayJournalForm({
  accountId,
  date,
  journal,
  mistakeTags,
  sessions,
  activeSessionKeys,
  checklistItems,
  checklistSkipIfNo,
}: {
  accountId: number;
  date: string;
  journal: DayJournal | undefined;
  mistakeTags: string[];
  sessions: SessionDef[];
  activeSessionKeys: string[];
  checklistItems: string[];
  checklistSkipIfNo: number;
}) {
  const [state, action, pending] = useActionState(saveDayJournal, initial);
  const active = sessions.filter((session) => activeSessionKeys.includes(session.key));
  const saved = journal?.checklist ?? {};
  const [answers, setAnswers] = useState<Record<string, ChecklistRun>>(saved);
  const firstLink = journal?.screenshotLinks?.[0];

  const warnings = useMemo(() => {
    return active
      .map((session) => {
        const run = answers[session.key];
        const nos = (run?.answers ?? []).filter((answer) => answer === false).length;
        return nos > checklistSkipIfNo ? { name: session.name, nos } : null;
      })
      .filter((row): row is { name: string; nos: number } => row != null);
  }, [active, answers, checklistSkipIfNo]);

  const setAnswer = (sessionKey: string, index: number, value: string) => {
    setAnswers((current) => {
      const previous = current[sessionKey] ?? { answers: [], note: null };
      const next = [...previous.answers];
      next[index] = value === 'yes' ? true : value === 'no' ? false : null;
      return { ...current, [sessionKey]: { ...previous, answers: next } };
    });
  };

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
          <label className="label" htmlFor="sleptWell">
            Slept well
          </label>
          <select id="sleptWell" name="sleptWell" defaultValue={triValue(journal?.sleptWell)} className="field">
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="followedPlan">
            Followed plan
          </label>
          <select id="followedPlan" name="followedPlan" defaultValue={triValue(journal?.followedPlan)} className="field">
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rulesFollowed">
            Rules followed?
          </label>
          <select id="rulesFollowed" name="rulesFollowed" defaultValue={triValue(journal?.rulesFollowed)} className="field">
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ruleBreakReason">
          Rule-break reason
        </label>
        <select id="ruleBreakReason" name="ruleBreakReason" defaultValue={journal?.ruleBreakReason ?? ''} className="field">
          <option value="">—</option>
          {mistakeTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-dim">Separate from the yes/no above. You can mark the day as followed and still log a reason.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="screenshotUrl">
            Chart link
          </label>
          <input type="hidden" name="previousScreenshotUrl" value={firstLink?.url ?? ''} />
          <input
            id="screenshotUrl"
            name="screenshotUrl"
            defaultValue={firstLink?.url ?? ''}
            className="field"
            placeholder="https://www.tradingview.com/..."
          />
        </div>
        <div>
          <label className="label" htmlFor="screenshotComment">
            Link note
          </label>
          <input id="screenshotComment" name="screenshotComment" defaultValue={firstLink?.comment ?? ''} className="field" />
        </div>
      </div>
      {checklistItems.length > 0 && (
        <div className="space-y-3">
          <div className="label">Pre-trade checklist</div>
          {warnings.map((warning) => (
            <p key={warning.name} className="rounded-lg border border-warn-line bg-warn-soft/70 px-3 py-2 text-xs text-warn">
              {warning.name}: {warning.nos} answers are No. More than {checklistSkipIfNo} means consider skipping this session.
            </p>
          ))}
          {active.map((session) => (
            <div key={session.key} className="rounded-lg border border-line-soft bg-ink-850/40 p-3">
              <div className="mb-2 text-xs font-medium text-fg">{session.name}</div>
              <div className="space-y-1.5">
                {checklistItems.map((item, index) => {
                  const current = answers[session.key]?.answers?.[index];
                  const value = current == null ? '' : current ? 'yes' : 'no';
                  return (
                    <label key={item} className="flex items-center justify-between gap-3 text-xs text-fg">
                      <span>{item}</span>
                      <select
                        name={`check_${session.key}_${index}`}
                        value={value}
                        onChange={(event) => setAnswer(session.key, index, event.target.value)}
                        className="w-20 text-xs"
                      >
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  );
                })}
              </div>
              <input
                name={`checkNote_${session.key}`}
                defaultValue={saved[session.key]?.note ?? ''}
                className="field mt-2 text-xs"
                placeholder="Checklist note"
              />
            </div>
          ))}
        </div>
      )}
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
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" name="satOut" defaultChecked={journal?.satOut ?? false} />
        Sat out / no-trade day
      </label>
      {state.error && <p className="text-sm text-loss-text">{state.error}</p>}
      {state.message && <p className="text-sm text-mint-300">{state.message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save journal'}
      </button>
    </form>
  );
}
