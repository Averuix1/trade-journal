'use client';

import { useActionState, useState } from 'react';
import type { Account } from '@/lib/db/schema';
import { previewImport, runImport, type ImportState } from '@/lib/actions/import';
import { MAPPING_FIELDS } from '@/lib/csv';
import { fmtR, fmtSigned } from '@/lib/format';
import { TIMEZONES } from '@/lib/time';

const initial: ImportState = {};

export function ImportWizard({
  accounts,
  defaultAccountId,
  defaultTimezone,
}: {
  accounts: Account[];
  defaultAccountId: number;
  defaultTimezone: string;
}) {
  const [previewState, previewAction, previewPending] = useActionState(previewImport, initial);
  const [runState, runActionFn, runPending] = useActionState(runImport, initial);
  const preview = previewState.preview;
  const [accountMode, setAccountMode] = useState<'all' | 'row' | 'range'>('all');
  const [riskMode, setRiskMode] = useState<'keep' | 'all' | 'row'>('keep');
  const [riskAll, setRiskAll] = useState('200');
  const [ranges, setRanges] = useState([{ from: '', to: '', accountId: String(defaultAccountId) }]);
  const placeholderCount = preview?.sheetRows.filter((row) => row.risk === 500).length ?? 0;

  return (
    <div className="space-y-5">
      <form action={previewAction} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="label" htmlFor="file">
              CSV from TopstepX, Tradovate, a broker, or the Google Sheets journal
            </label>
            <input id="file" name="file" type="file" accept=".csv,text/csv" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="sourceTimezone">
              Times in the file are
            </label>
            <select id="sourceTimezone" name="sourceTimezone" defaultValue={defaultTimezone} className="text-sm">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={previewPending}>
            {previewPending ? 'Reading…' : 'Read file'}
          </button>
        </div>
        {previewState.error && <p className="text-sm text-loss-text">{previewState.error}</p>}
        <p className="text-[11px] text-dim">
          Nothing is saved until you press Import. Rows that already exist on the account are skipped automatically.
        </p>
      </form>

      {preview && (
        <div className="space-y-4 rounded-xl border border-line bg-ink-850/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-fg-strong">
                {preview.kind === 'sheet' ? 'Google Sheets journal' : preview.fileName} · looks like {preview.source}
              </div>
              <div className="text-[11px] text-dim">
                {preview.totalRows} rows · {preview.ready} importable
                {preview.kind === 'broker' ? ' with the current mapping' : ''}
              </div>
            </div>
          </div>

          {preview.kind === 'sheet' && preview.warnings.length > 0 && (
            <div className="rounded-lg border border-warn-line bg-warn-soft/70 px-3 py-2 text-xs text-warn">
              {preview.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}

          {preview.kind === 'broker' && (
          <form action={previewAction} className="space-y-3">
            <input type="hidden" name="csv" value={preview.csv} />
            <input type="hidden" name="fileName" value={preview.fileName} />
            <input type="hidden" name="sourceTimezone" value={preview.timezone} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MAPPING_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="label" htmlFor={`map_${field.key}`}>
                    {field.label}
                  </label>
                  <select id={`map_${field.key}`} name={`map_${field.key}`} defaultValue={preview.mapping[field.key] ?? ''} className="field text-xs">
                    <option value="">— not in file —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button className="btn" type="submit" disabled={previewPending}>
              Re-check mapping
            </button>
          </form>
          )}

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-warn-line bg-warn-soft/70 px-3 py-2 text-xs text-warn">
              {preview.errors.map((e) => (
                <div key={e.row}>
                  Row {e.row}: {e.message}
                </div>
              ))}
            </div>
          )}

          {preview.kind === 'broker' && (
          <div className="scroll-x rounded-lg border border-line-soft">
            <table className="tabular text-xs">
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-rows">
                {preview.sampleRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap px-2 py-1 text-dim">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          <form action={runActionFn} className="space-y-4">
            <input type="hidden" name="csv" value={preview.csv} />
            <input type="hidden" name="fileName" value={preview.fileName} />
            <input type="hidden" name="source" value={preview.source} />
            <input type="hidden" name="sourceTimezone" value={preview.timezone} />
            {MAPPING_FIELDS.map((field) => (
              <input key={field.key} type="hidden" name={`map_${field.key}`} value={preview.mapping[field.key] ?? ''} />
            ))}

            {preview.kind === 'sheet' && placeholderCount > 0 && (
              <p className="rounded-lg border border-warn-line bg-warn-soft/70 px-3 py-2 text-xs text-warn">
                {placeholderCount} rows list $500 risk. In this journal $500 is a placeholder, not a measured stop. Keep the
                sheet amounts, replace every row, or set risk on a row. R is result divided by the risk you keep.
              </p>
            )}

            {preview.kind === 'sheet' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="label" htmlFor="accountMode">
                    Accounts
                  </label>
                  <select
                    id="accountMode"
                    name="accountMode"
                    value={accountMode}
                    onChange={(event) => setAccountMode(event.target.value as 'all' | 'row' | 'range')}
                    className="field text-sm"
                  >
                    <option value="all">One account for the whole file</option>
                    <option value="range">Assign by date range</option>
                    <option value="row">Assign each row</option>
                  </select>
                  {accountMode === 'range' && (
                    <div className="space-y-2">
                      {ranges.map((range, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <input
                            name="rangeFrom"
                            type="date"
                            value={range.from}
                            onChange={(event) =>
                              setRanges((current) => current.map((item, i) => (i === index ? { ...item, from: event.target.value } : item)))
                            }
                            className="text-xs"
                            aria-label="Range start"
                          />
                          <input
                            name="rangeTo"
                            type="date"
                            value={range.to}
                            onChange={(event) =>
                              setRanges((current) => current.map((item, i) => (i === index ? { ...item, to: event.target.value } : item)))
                            }
                            className="text-xs"
                            aria-label="Range end"
                          />
                          <select
                            name="rangeAccount"
                            value={range.accountId}
                            onChange={(event) =>
                              setRanges((current) =>
                                current.map((item, i) => (i === index ? { ...item, accountId: event.target.value } : item)),
                              )
                            }
                            className="text-xs"
                            aria-label="Range account"
                          >
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setRanges((current) => [...current, { from: '', to: '', accountId: String(defaultAccountId) }])}
                      >
                        Add date range
                      </button>
                      <p className="text-[11px] text-dim">Dates outside these ranges use the account below.</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="label" htmlFor="riskMode">
                    Risk
                  </label>
                  <select
                    id="riskMode"
                    name="riskMode"
                    value={riskMode}
                    onChange={(event) => setRiskMode(event.target.value as 'keep' | 'all' | 'row')}
                    className="field text-sm"
                  >
                    <option value="keep">Keep the sheet risk</option>
                    <option value="all">Override every row</option>
                    <option value="row">Set risk per row</option>
                  </select>
                  {riskMode === 'all' && (
                    <input
                      name="riskOverride"
                      type="number"
                      min="1"
                      step="1"
                      value={riskAll}
                      onChange={(event) => setRiskAll(event.target.value)}
                      className="field max-w-[10rem]"
                      aria-label="Override risk"
                    />
                  )}
                </div>
              </div>
            )}

            {preview.kind === 'sheet' && (
              <div id="sheet-preview" className="scroll-x rounded-lg border border-line-soft">
                <table className="tabular text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1.5">Date</th>
                      <th>Session</th>
                      <th>Slot</th>
                      <th>Instrument</th>
                      <th>Side</th>
                      <th className="text-right">Risk</th>
                      <th className="text-right">Result</th>
                      <th className="text-right">R</th>
                      <th>Setup</th>
                      {accountMode === 'row' && <th>Account</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-rows">
                    {preview.sheetRows.map((row) => {
                      const override = riskMode === 'all' && Number(riskAll) > 0 ? Number(riskAll) : row.risk;
                      const shownR = override != null && override > 0 ? Math.round((row.pnl / override) * 100) / 100 : row.r;
                      return (
                        <tr key={`${row.date}-${row.slot}-${row.index}`}>
                          <td className="px-2 py-1">{row.date}</td>
                          <td className="text-dim">{row.session}</td>
                          <td>{row.slot}</td>
                          <td>{row.symbol}</td>
                          <td className="text-dim">{row.side === 'LONG' ? 'Long' : 'Short'}</td>
                          <td className="text-right text-dim">
                            {riskMode === 'row' ? (
                              <input
                                name={`rowRisk_${row.index}`}
                                type="number"
                                step="1"
                                min="0"
                                defaultValue={row.risk ?? ''}
                                className="w-20 text-right text-xs"
                                aria-label={`Risk for ${row.date} ${row.slot}`}
                              />
                            ) : (
                              (override ?? '—')
                            )}
                          </td>
                          <td className="text-right">{fmtSigned(row.pnl)}</td>
                          <td className="text-right text-dim">{fmtR(shownR)}</td>
                          <td className={row.error ? 'text-loss-text' : 'text-dim'}>{row.error ?? row.setup ?? '—'}</td>
                          {accountMode === 'row' && (
                            <td>
                              <select name={`rowAccount_${row.index}`} defaultValue={defaultAccountId} className="text-xs" aria-label={`Account for ${row.date}`}>
                                {accounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="importAccount">
                  {preview.kind === 'sheet' && accountMode !== 'all' ? 'Account for everything else' : 'Import into'}
                </label>
                <select id="importAccount" name="accountId" defaultValue={defaultAccountId} className="text-sm">
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={runPending || preview.ready === 0}>
                {runPending ? 'Importing…' : `Import ${preview.ready} trades`}
              </button>
              {runState.error && <p className="text-sm text-loss-text">{runState.error}</p>}
              {runState.message && <p className="text-sm text-mint-300">{runState.message}</p>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
