'use client';

import { useActionState } from 'react';
import type { Account } from '@/lib/db/schema';
import { previewImport, runImport, type ImportState } from '@/lib/actions/import';
import { MAPPING_FIELDS } from '@/lib/csv';
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

  return (
    <div className="space-y-5">
      <form action={previewAction} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="label" htmlFor="file">
              CSV file from TopstepX, Tradovate, or any broker
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
        {previewState.error && <p className="text-sm text-[#ff9aa3]">{previewState.error}</p>}
        <p className="text-[11px] text-dim">
          Nothing is saved until you press Import. Rows that already exist on the account are skipped automatically.
        </p>
      </form>

      {preview && (
        <div className="space-y-4 rounded-xl border border-line bg-ink-850/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#e6fff5]">
                {preview.fileName} · looks like {preview.source}
              </div>
              <div className="text-[11px] text-dim">
                {preview.totalRows} rows · {preview.ready} importable with the current mapping
              </div>
            </div>
          </div>

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

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-[#7a5a23] bg-[#3a2d11]/60 px-3 py-2 text-xs text-[#ffd79a]">
              {preview.errors.map((e) => (
                <div key={e.row}>
                  Row {e.row}: {e.message}
                </div>
              ))}
            </div>
          )}

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

          <form action={runActionFn} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="csv" value={preview.csv} />
            <input type="hidden" name="fileName" value={preview.fileName} />
            <input type="hidden" name="source" value={preview.source} />
            <input type="hidden" name="sourceTimezone" value={preview.timezone} />
            {MAPPING_FIELDS.map((field) => (
              <input key={field.key} type="hidden" name={`map_${field.key}`} value={preview.mapping[field.key] ?? ''} />
            ))}
            <div>
              <label className="label" htmlFor="importAccount">
                Import into
              </label>
              <select id="importAccount" name="accountId" defaultValue={defaultAccountId} className="text-sm">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={runPending}>
              {runPending ? 'Importing…' : `Import ${preview.ready} trades`}
            </button>
            {runState.error && <p className="text-sm text-[#ff9aa3]">{runState.error}</p>}
            {runState.message && <p className="text-sm text-mint-300">{runState.message}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
