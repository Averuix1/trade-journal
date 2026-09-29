'use client';

import { useActionState } from 'react';
import type { Instrument, MistakeTag, SessionDef, Settings } from '@/lib/db/schema';
import {
  addMistakeTag,
  saveChecklist,
  saveGeneralSettings,
  saveInstruments,
  saveSessions,
} from '@/lib/actions/settings';
import { reapplyCommissions } from '@/lib/actions/trades';
import type { FormState } from '@/lib/actions/shared';
import { TIMEZONES, minutesToClock } from '@/lib/time';

const initial: FormState = {};

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-loss-text">{state.error}</p>;
  if (state.message) return <p className="text-sm text-mint-300">{state.message}</p>;
  return null;
}

export function GeneralSettingsForm({ config }: { config: Settings }) {
  const [state, action, pending] = useActionState(saveGeneralSettings, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <div>
        <label className="label" htmlFor="timezone">
          Display timezone
        </label>
        <select id="timezone" name="timezone" defaultValue={config.timezone} className="text-sm">
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="beBandR">
          Breakeven band (R)
        </label>
        <input id="beBandR" name="beBandR" type="number" step="0.01" min="0" defaultValue={config.beBandR} className="w-28 text-sm" />
      </div>
      <div>
        <label className="label" htmlFor="rRounding">
          R display rounding
        </label>
        <input id="rRounding" name="rRounding" type="number" step="0.05" min="0" defaultValue={config.rRounding} className="w-28 text-sm" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <Feedback state={state} />
      <p className="w-full text-[11px] text-dim">
        Times are entered and shown in this zone. Sessions and the trading day always use New York time, so a NY
        session never gets split across two calendar days. R is stored unrounded; a display step of 0.25 shows it to
        the nearest quarter, and 0 leaves two decimals.
      </p>
    </form>
  );
}

export function InstrumentsForm({ instruments }: { instruments: Instrument[] }) {
  const [state, action, pending] = useActionState(saveInstruments, initial);
  const [commissionState, commissionAction, commissionPending] = useActionState(
    async () => reapplyCommissions(),
    initial,
  );

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div className="scroll-x">
          <table className="tabular">
            <thead>
              <tr>
                <th className="py-1.5">Symbol</th>
                <th>Name</th>
                <th className="text-right">$ / point</th>
                <th className="text-right">Tick size</th>
                <th className="text-right">Commission / contract</th>
                <th>Aliases</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {instruments.map((i) => (
                <tr key={i.symbol}>
                  <td className="py-1.5">
                    <input name="symbol" defaultValue={i.symbol} readOnly className="w-20 text-xs" />
                  </td>
                  <td>
                    <input name="name" defaultValue={i.name} className="w-full min-w-[10rem] text-xs" />
                  </td>
                  <td className="text-right">
                    <input name="pointValue" type="number" step="0.01" defaultValue={i.pointValue ?? ''} placeholder="$ / R" className="w-24 text-right text-xs" />
                  </td>
                  <td className="text-right">
                    <input name="tickSize" type="number" step="0.01" defaultValue={i.tickSize} className="w-24 text-right text-xs" />
                  </td>
                  <td className="text-right">
                    <input name="commissionPerContract" type="number" step="0.01" defaultValue={i.commissionPerContract} className="w-28 text-right text-xs" />
                  </td>
                  <td>
                    <input name="aliases" defaultValue={(i.aliases ?? []).join(', ')} className="w-40 text-xs" placeholder="NASDAQ, NAS100" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line-soft bg-ink-850/50 p-3">
          <div>
            <label className="label" htmlFor="newSymbol">
              Add symbol
            </label>
            <input id="newSymbol" name="newSymbol" className="w-24 text-xs" placeholder="YM" />
          </div>
          <div>
            <label className="label" htmlFor="newName">
              Name
            </label>
            <input id="newName" name="newName" className="text-xs" placeholder="E-mini Dow" />
          </div>
          <div>
            <label className="label" htmlFor="newPointValue">
              $ / point
            </label>
            <input id="newPointValue" name="newPointValue" type="number" step="0.01" className="w-24 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="newTickSize">
              Tick size
            </label>
            <input id="newTickSize" name="newTickSize" type="number" step="0.01" defaultValue="0.25" className="w-24 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="newCommission">
              Commission
            </label>
            <input id="newCommission" name="newCommission" type="number" step="0.01" className="w-24 text-xs" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save contract table'}
          </button>
          <Feedback state={state} />
        </div>
      </form>

      <form action={commissionAction} className="flex items-center gap-3 border-t border-line-soft pt-3">
        <button className="btn" type="submit" disabled={commissionPending}>
          {commissionPending ? 'Applying…' : 'Re-apply commissions to past trades'}
        </button>
        <span className="text-[11px] text-dim">Skips any trade where you ticked &ldquo;override fees&rdquo;.</span>
        <Feedback state={commissionState} />
      </form>
    </div>
  );
}

export function SessionsForm({ sessions }: { sessions: SessionDef[] }) {
  const [state, action, pending] = useActionState(saveSessions, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="scroll-x">
        <table className="tabular">
          <thead>
            <tr>
              <th className="py-1.5">Name</th>
              <th>Short</th>
              <th>Start (NY)</th>
              <th>End (NY)</th>
              <th className="text-right">Entry window (min)</th>
              <th>Aliases</th>
            </tr>
          </thead>
          <tbody className="divide-rows">
            {sessions.map((s) => (
              <tr key={s.key}>
                <td className="py-1.5">
                  <input type="hidden" name="key" value={s.key} />
                  <input name="sessionName" defaultValue={s.name} className="w-40 text-xs" />
                </td>
                <td>
                  <input name="shortName" defaultValue={s.shortName} className="w-20 text-xs" />
                </td>
                <td>
                  <input name="start" type="time" defaultValue={minutesToClock(s.startMinute)} className="text-xs" />
                </td>
                <td>
                  <input name="end" type="time" defaultValue={minutesToClock(s.endMinute)} className="text-xs" />
                </td>
                <td className="text-right">
                  <input name="entryWindow" type="number" min={0} max={480} defaultValue={s.entryWindowMins} className="w-24 text-right text-xs" />
                </td>
                <td>
                  <input name="sessionAliases" defaultValue={(s.aliases ?? []).join(', ')} className="w-56 text-xs" placeholder="New York, NY" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line-soft bg-ink-850/50 p-3">
        <div>
          <label className="label" htmlFor="newSessionName">
            Add session
          </label>
          <input id="newSessionName" name="newSessionName" className="text-xs" placeholder="Tokyo" />
        </div>
        <div>
          <label className="label" htmlFor="newShortName">
            Short
          </label>
          <input id="newShortName" name="newShortName" className="w-20 text-xs" placeholder="TYO" />
        </div>
        <div>
          <label className="label" htmlFor="newStart">
            Start (NY)
          </label>
          <input id="newStart" name="newStart" type="time" defaultValue="20:00" className="text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="newEnd">
            End (NY)
          </label>
          <input id="newEnd" name="newEnd" type="time" defaultValue="23:00" className="text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="newEntryWindow">
            Window
          </label>
          <input id="newEntryWindow" name="newEntryWindow" type="number" defaultValue={30} className="w-20 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save sessions'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ChecklistForm({ config }: { config: Settings }) {
  const [state, action, pending] = useActionState(saveChecklist, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="checklistItems">
          Checks, one per line
        </label>
        <textarea
          id="checklistItems"
          name="items"
          rows={8}
          defaultValue={(config.checklistItems ?? []).join('\n')}
          className="field"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="checklistSkipIfNo">
            Warn when No answers exceed
          </label>
          <input
            id="checklistSkipIfNo"
            name="checklistSkipIfNo"
            type="number"
            min={0}
            defaultValue={config.checklistSkipIfNo}
            className="w-24 text-sm"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save checklist'}
        </button>
        <Feedback state={state} />
      </div>
      <p className="text-[11px] text-dim">
        The day panel shows one copy of this list per session you trade. The warning is a reminder only — it does not
        mark a trade outside the system.
      </p>
    </form>
  );
}

export function MistakeTagForm({ tags }: { tags: MistakeTag[] }) {
  const [state, action, pending] = useActionState(addMistakeTag, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="tagName">
          New mistake tag
        </label>
        <input id="tagName" name="name" className="text-sm" placeholder="e.g. Traded the news" />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add tag'}
      </button>
      <Feedback state={state} />
      <span className="w-full text-[11px] text-dim">{tags.length} tags available on the trade form.</span>
    </form>
  );
}
