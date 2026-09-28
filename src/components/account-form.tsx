'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { Account, SessionDef } from '@/lib/db/schema';
import { createAccount, updateAccount } from '@/lib/actions/accounts';
import type { FormState } from '@/lib/actions/shared';
import { PROP_FIRMS } from '@/lib/defaults';
import { minutesToClock } from '@/lib/time';

const initial: FormState = {};

export function AccountForm({
  account,
  sessions,
  today,
}: {
  account?: Account;
  sessions: SessionDef[];
  today: string;
}) {
  const [state, action, pending] = useActionState(account ? updateAccount : createAccount, initial);
  const [type, setType] = useState<'PROP' | 'PERSONAL'>(account?.type ?? 'PROP');
  const active = account?.activeSessions?.length ? account.activeSessions : sessions.map((s) => s.key);

  return (
    <form action={action} className="space-y-6">
      {account && <input type="hidden" name="id" value={account.id} />}

      <div>
        <span className="label">Account type</span>
        <div className="flex gap-2">
          {(
            [
              { value: 'PROP', label: 'Prop / evaluation', hint: 'Topstep, Apex, funded accounts' },
              { value: 'PERSONAL', label: 'Personal', hint: 'Your own money' },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex-1 cursor-pointer rounded-xl border p-3 transition ${
                type === option.value ? 'border-mint-400/70 bg-mint-500/10' : 'border-line bg-ink-850/50'
              }`}
            >
              <input type="radio" name="type" value={option.value} checked={type === option.value} onChange={() => setType(option.value)} className="sr-only" />
              <div className="text-sm font-medium text-[#e6fff5]">{option.label}</div>
              <div className="text-[11px] text-dim">{option.hint}</div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            Account name
          </label>
          <input id="name" name="name" defaultValue={account?.name ?? ''} className="field" placeholder="50k Topstep combine" required />
        </div>
        <div>
          <label className="label" htmlFor="startDate">
            Start date
          </label>
          <input id="startDate" name="startDate" type="date" defaultValue={account?.startDate ?? today} className="field" />
        </div>
        {type === 'PROP' ? (
          <div>
            <label className="label" htmlFor="firm">
              Firm
            </label>
            <select id="firm" name="firm" defaultValue={account?.firm ?? 'Topstep'} className="field">
              {PROP_FIRMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="startingBalance">
              Starting balance ($)
            </label>
            <input id="startingBalance" name="startingBalance" type="number" step="0.01" defaultValue={account?.startingBalance ?? 0} className="field" />
          </div>
        )}
      </div>

      {type === 'PROP' && (
        <div className="space-y-4 rounded-xl border border-line bg-ink-850/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="stage">
                Stage
              </label>
              <select id="stage" name="stage" defaultValue={account?.stage ?? 'EVAL'} className="field">
                <option value="EVAL">Evaluation</option>
                <option value="FUNDED">Funded</option>
                <option value="BLOWN">Blown</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="program">
                Program (optional)
              </label>
              <input id="program" name="program" defaultValue={account?.program ?? ''} className="field" placeholder="Combine, Express Funded…" />
            </div>
            <div>
              <label className="label" htmlFor="accountSize">
                Account size ($)
              </label>
              <input id="accountSize" name="accountSize" type="number" step="1" defaultValue={account?.accountSize ?? 50000} className="field" />
            </div>
            {!account && (
              <div>
                <label className="label" htmlFor="evalFee">
                  Eval fee paid ($)
                </label>
                <input id="evalFee" name="evalFee" type="number" step="0.01" className="field" placeholder="Optional" />
              </div>
            )}
          </div>

          <div>
            <div className="label">Your firm&rsquo;s rules — type them in, nothing is assumed</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label" htmlFor="profitTarget">
                  Profit target ($)
                </label>
                <input id="profitTarget" name="profitTarget" type="number" step="1" defaultValue={account?.profitTarget ?? ''} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="maxDrawdown">
                  Max drawdown ($)
                </label>
                <input id="maxDrawdown" name="maxDrawdown" type="number" step="1" defaultValue={account?.maxDrawdown ?? ''} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="drawdownType">
                  Drawdown type
                </label>
                <select id="drawdownType" name="drawdownType" defaultValue={account?.drawdownType ?? 'TRAILING'} className="field">
                  <option value="TRAILING">Trailing (intraday peak)</option>
                  <option value="EOD">End of day</option>
                  <option value="STATIC">Static</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="dailyLossLimit">
                  Daily loss limit ($)
                </label>
                <input id="dailyLossLimit" name="dailyLossLimit" type="number" step="1" defaultValue={account?.dailyLossLimit ?? ''} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="consistencyPct">
                  Consistency — best day max %
                </label>
                <input id="consistencyPct" name="consistencyPct" type="number" step="1" defaultValue={account?.consistencyPct ?? ''} className="field" placeholder="e.g. 50" />
              </div>
              <div>
                <label className="label" htmlFor="minTradingDays">
                  Minimum trading days
                </label>
                <input id="minTradingDays" name="minTradingDays" type="number" step="1" defaultValue={account?.minTradingDays ?? ''} className="field" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-dim">
              Trailing and end-of-day drawdown lines stop trailing once they reach your starting balance. Check the
              numbers against your firm&rsquo;s dashboard.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="targetBalance">
            Target balance ($)
          </label>
          <input id="targetBalance" name="targetBalance" type="number" step="1" defaultValue={account?.targetBalance ?? ''} className="field" placeholder="Optional — drives Desk pace" />
        </div>
        <div>
          <label className="label" htmlFor="targetDate">
            Target date
          </label>
          <input id="targetDate" name="targetDate" type="date" defaultValue={account?.targetDate ?? ''} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="maxTradesPerSession">
            Max trades per session
          </label>
          <input id="maxTradesPerSession" name="maxTradesPerSession" type="number" min={1} max={10} defaultValue={account?.maxTradesPerSession ?? 3} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="riskPerTrade">
            Risk per trade ($)
          </label>
          <input id="riskPerTrade" name="riskPerTrade" type="number" step="1" defaultValue={account?.riskPerTrade ?? 300} className="field" />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="riskPresets">
            Risk presets ($)
          </label>
          <input
            id="riskPresets"
            name="riskPresets"
            defaultValue={(account?.riskPresets ?? [200, 250, 300, 400, 500]).join(', ')}
            className="field"
            placeholder="200, 250, 300, 400, 500"
          />
          <p className="mt-1 text-[11px] text-dim">Quick picks on the add-trade form. The default risk above is used when none of these is chosen.</p>
        </div>
      </div>

      <div>
        <div className="label">Sessions traded &amp; entry window</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {sessions.map((session) => (
            <div key={session.key} className="flex items-center gap-3 rounded-lg border border-line-soft bg-ink-850/50 px-3 py-2">
              <label className="flex flex-1 items-center gap-2 text-sm text-[#cdefe2]">
                <input type="checkbox" name="sessions" value={session.key} defaultChecked={active.includes(session.key)} />
                {session.name}
                <span className="text-[11px] text-dim">
                  {minutesToClock(session.startMinute)}–{minutesToClock(session.endMinute)} NY
                </span>
              </label>
              <label className="flex items-center gap-1 text-[11px] text-dim">
                <input name={`entryWindow_${session.key}`} type="number" min={0} max={480} defaultValue={account?.entryWindows?.[session.key] ?? session.entryWindowMins} className="w-16" />
                min
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea id="notes" name="notes" rows={2} defaultValue={account?.notes ?? ''} className="field" />
      </div>

      {state.error && <p className="rounded-lg border border-[#7a2331] bg-[#3a1119] px-3 py-2 text-sm text-[#ff9aa3]">{state.error}</p>}

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : account ? 'Save account' : 'Create account'}
        </button>
        <Link className="btn btn-ghost" href="/accounts">
          Cancel
        </Link>
      </div>
    </form>
  );
}
