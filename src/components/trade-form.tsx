'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Account, Instrument, MistakeTag, Playbook, PlaybookRule, Trade } from '@/lib/db/schema';
import { createTrade, updateTrade } from '@/lib/actions/trades';
import type { FormState } from '@/lib/actions/shared';
import { autoFees, autoPnl, autoR } from '@/lib/calc';
import { fmtMoney, fmtR } from '@/lib/format';

const initial: FormState = {};

export function TradeForm({
  accounts,
  instruments,
  playbooks,
  playbookRules,
  mistakeTags,
  trade,
  openedAtLocal,
  closedAtLocal,
  defaultAccountId,
  defaultSymbol,
  defaultOpenedAt,
  cancelHref,
}: {
  accounts: Account[];
  instruments: Instrument[];
  playbooks: Playbook[];
  playbookRules: PlaybookRule[];
  mistakeTags: MistakeTag[];
  trade?: Trade;
  openedAtLocal?: string;
  closedAtLocal?: string;
  defaultAccountId: number;
  defaultSymbol: string;
  defaultOpenedAt: string;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(trade ? updateTrade : createTrade, initial);

  const [symbol, setSymbol] = useState(trade?.symbol ?? defaultSymbol);
  const [side, setSide] = useState<'LONG' | 'SHORT'>(trade?.side ?? 'LONG');
  const [contracts, setContracts] = useState(String(trade?.contracts ?? 1));
  const [entry, setEntry] = useState(trade?.entryPrice != null ? String(trade.entryPrice) : '');
  const [stop, setStop] = useState(trade?.stopPrice != null ? String(trade.stopPrice) : '');
  const [exit, setExit] = useState(trade?.exitPrice != null ? String(trade.exitPrice) : '');
  const [feesOverridden, setFeesOverridden] = useState(trade?.feesOverridden ?? false);
  const [fees, setFees] = useState(trade?.fees != null ? String(trade.fees) : '');
  const [pnlOverridden, setPnlOverridden] = useState(trade?.pnlOverridden ?? false);
  const [pnl, setPnl] = useState(trade?.pnl != null ? String(trade.pnl) : '');
  const [playbookId, setPlaybookId] = useState(trade?.playbookId ? String(trade.playbookId) : '');

  const instrument = instruments.find((i) => i.symbol === symbol) ?? instruments[0];
  const numContracts = Number(contracts) || 0;
  const computedFees = instrument ? autoFees(numContracts, instrument.commissionPerContract) : 0;
  const effectiveFees = feesOverridden ? Number(fees) || 0 : computedFees;
  const computedPnl = instrument
    ? autoPnl(side, entry === '' ? null : Number(entry), exit === '' ? null : Number(exit), numContracts, instrument.pointValue, effectiveFees)
    : null;
  const effectivePnl = pnlOverridden ? Number(pnl) || 0 : (computedPnl ?? 0);
  const computedR = instrument
    ? autoR(side, entry === '' ? null : Number(entry), stop === '' ? null : Number(stop), numContracts, instrument.pointValue, effectivePnl)
    : null;

  const rules = useMemo(
    () => playbookRules.filter((r) => String(r.playbookId) === playbookId),
    [playbookRules, playbookId],
  );

  return (
    <form action={action} className="space-y-5">
      {trade && <input type="hidden" name="id" value={trade.id} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="accountId">
            Account
          </label>
          <select id="accountId" name="accountId" defaultValue={String(trade?.accountId ?? defaultAccountId)} className="field">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="symbol">
            Instrument
          </label>
          <select id="symbol" name="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="field">
            {instruments.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol} · {fmtMoney(i.pointValue)}/pt
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="openedAt">
            Opened
          </label>
          <input
            id="openedAt"
            name="openedAt"
            type="datetime-local"
            defaultValue={openedAtLocal ?? defaultOpenedAt}
            className="field"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="closedAt">
            Closed
          </label>
          <input
            id="closedAt"
            name="closedAt"
            type="datetime-local"
            defaultValue={closedAtLocal ?? ''}
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <span className="label">Side</span>
          <div className="flex gap-1 rounded-lg border border-line bg-ink-850 p-0.5">
            {(['LONG', 'SHORT'] as const).map((value) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-xs ${
                  side === value ? 'bg-mint-500/20 text-mint-200' : 'text-dim'
                }`}
              >
                <input type="radio" name="side" value={value} checked={side === value} onChange={() => setSide(value)} className="sr-only" />
                {value}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="contracts">
            Contracts
          </label>
          <input id="contracts" name="contracts" type="number" step="1" min="1" value={contracts} onChange={(e) => setContracts(e.target.value)} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="entryPrice">
            Entry
          </label>
          <input id="entryPrice" name="entryPrice" type="number" step="0.01" value={entry} onChange={(e) => setEntry(e.target.value)} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="stopPrice">
            Stop
          </label>
          <input id="stopPrice" name="stopPrice" type="number" step="0.01" value={stop} onChange={(e) => setStop(e.target.value)} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="exitPrice">
            Exit
          </label>
          <input id="exitPrice" name="exitPrice" type="number" step="0.01" value={exit} onChange={(e) => setExit(e.target.value)} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="playbookId">
            Playbook
          </label>
          <select id="playbookId" name="playbookId" value={playbookId} onChange={(e) => setPlaybookId(e.target.value)} className="field">
            <option value="">None</option>
            {playbooks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-line bg-ink-850/50 p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-dim">
            <input type="checkbox" name="feesOverridden" checked={feesOverridden} onChange={(e) => setFeesOverridden(e.target.checked)} />
            Override fees
          </label>
          <input
            name="fees"
            type="number"
            step="0.01"
            value={feesOverridden ? fees : computedFees.toFixed(2)}
            onChange={(e) => setFees(e.target.value)}
            disabled={!feesOverridden}
            className="field disabled:opacity-60"
          />
          <p className="mt-1 text-[11px] text-dim">
            Auto: {numContracts} × {fmtMoney(instrument?.commissionPerContract ?? 0, true)}
          </p>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-dim">
            <input type="checkbox" name="pnlOverridden" checked={pnlOverridden} onChange={(e) => setPnlOverridden(e.target.checked)} />
            Override P&amp;L
          </label>
          <input
            name="pnl"
            type="number"
            step="0.01"
            value={pnlOverridden ? pnl : (computedPnl ?? 0).toFixed(2)}
            onChange={(e) => setPnl(e.target.value)}
            disabled={!pnlOverridden}
            className="field disabled:opacity-60"
          />
          <p className="mt-1 text-[11px] text-dim">Net of fees, from entry/exit and {fmtMoney(instrument?.pointValue ?? 0)}/pt.</p>
        </div>
        <div>
          <span className="label">Result</span>
          <div className="rounded-lg border border-line bg-ink-900 px-3 py-2">
            <div className={`tabular text-lg font-semibold ${effectivePnl >= 0 ? 'text-[#7df3bd]' : 'text-[#ff8c96]'}`}>
              {fmtMoney(effectivePnl, true)}
            </div>
            <div className="text-[11px] text-dim">{computedR == null ? 'Add a stop for R' : fmtR(computedR)}</div>
          </div>
          <input type="hidden" name="rMultiple" value={computedR ?? ''} />
        </div>
      </div>

      {rules.length > 0 && (
        <div>
          <div className="label">Playbook rules — tick the ones you followed</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {rules.map((rule) => {
              const followed = trade?.followedRuleIds?.includes(rule.id);
              const broken = trade?.brokenRuleIds?.includes(rule.id);
              return (
                <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-ink-850/50 px-3 py-2 text-sm">
                  <span className="text-[#cdefe2]">{rule.text}</span>
                  <span className="flex shrink-0 gap-3 text-[11px] text-dim">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" name="followedRuleIds" value={rule.id} defaultChecked={followed} /> kept
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" name="brokenRuleIds" value={rule.id} defaultChecked={broken} /> broke
                    </label>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="label">Mistake tags</div>
        <div className="flex flex-wrap gap-2">
          {mistakeTags.map((tag) => (
            <label
              key={tag.id}
              className="cursor-pointer rounded-full border border-line bg-ink-850 px-3 py-1 text-xs text-dim transition has-[:checked]:border-[#7a2331] has-[:checked]:bg-[#3a1119] has-[:checked]:text-[#ff9aa3]"
            >
              <input type="checkbox" name="mistakeTags" value={tag.name} defaultChecked={trade?.mistakeTags?.includes(tag.name)} className="sr-only" />
              {tag.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-dim">Any mistake tag marks the trade as outside the system.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea id="notes" name="notes" rows={3} defaultValue={trade?.notes ?? ''} className="field" placeholder="What you saw and what you did." />
        </div>
        <div>
          <label className="label" htmlFor="screenshots">
            Chart screenshots
          </label>
          <input id="screenshots" name="screenshots" type="file" accept="image/*" multiple className="field" />
          <label className="mt-3 flex items-center gap-2 text-sm text-[#cdefe2]">
            <input type="checkbox" name="hidden" defaultChecked={trade?.hidden ?? false} />
            Hide this trade from results
          </label>
        </div>
      </div>

      {state.error && <p className="rounded-lg border border-[#7a2331] bg-[#3a1119] px-3 py-2 text-sm text-[#ff9aa3]">{state.error}</p>}
      {state.message && <p className="rounded-lg border border-mint-500/40 bg-mint-500/10 px-3 py-2 text-sm text-mint-200">{state.message}</p>}

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : trade ? 'Save trade' : 'Log trade'}
        </button>
        <Link className="btn btn-ghost" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
