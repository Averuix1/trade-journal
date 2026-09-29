import { Card } from '@/components/ui';
import { ImportWizard } from '@/components/import-wizard';
import { NoAccounts } from '@/components/no-accounts';
import { RestoreForm } from '@/components/restore-form';
import { undoImport } from '@/lib/actions/import';
import { getImports, getScope, getSettings } from '@/lib/queries';

export const metadata = { title: 'Import — Trade Journal' };

export default async function ImportPage() {
  const scope = await getScope();
  if (!scope.accounts.length) return <NoAccounts />;

  const [config, batches] = await Promise.all([getSettings(), getImports(scope.accounts.map((a) => a.id))]);

  return (
    <div className="space-y-5">
      <Card title="Import trades from a CSV">
        <ImportWizard
          accounts={scope.accounts}
          defaultAccountId={scope.account?.id ?? scope.accounts[0].id}
          defaultTimezone={config.timezone}
        />
      </Card>

      <Card title="Where the file comes from">
        <div className="grid gap-4 text-sm text-dim sm:grid-cols-2">
          <div>
            <div className="mb-1 font-medium text-[#cdefe2]">TopstepX</div>
            <p>
              Open TopstepX, go to the trades/performance view, set the date range and export to CSV. The columns
              (ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice, Fees, PnL, Size) are detected automatically.
            </p>
          </div>
          <div>
            <div className="mb-1 font-medium text-[#cdefe2]">Tradovate</div>
            <p>
              In Tradovate go to Reports → Performance → Trades and download the CSV. Its bought/sold timestamps and
              buy/sell prices are used to work out whether each trade was long or short.
            </p>
          </div>
          <div>
            <div className="mb-1 font-medium text-[#cdefe2]">Google Sheets journal</div>
            <p>
              Export the trade log (one row per filled slot). Date, session, slot, instrument, direction, risk and
              result are read. The sheet&rsquo;s outcome and R columns are ignored and R is recalculated. Day notes,
              the rules-followed answer, the reason and the chart link land on the day. Undoing the batch removes the
              trades and leaves those day notes in place.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Import history">
        {batches.length === 0 ? (
          <p className="text-sm text-dim">No imports yet.</p>
        ) : (
          <div className="scroll-x">
            <table className="tabular">
              <thead>
                <tr>
                  <th className="py-1.5">When</th>
                  <th>Account</th>
                  <th>Source</th>
                  <th>File</th>
                  <th className="text-right">Imported</th>
                  <th className="text-right">Skipped</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-rows">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="py-1.5">{batch.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td className="text-dim">{scope.accounts.find((a) => a.id === batch.accountId)?.name}</td>
                    <td className="text-dim">{batch.source}</td>
                    <td className="text-dim">{batch.fileName ?? '—'}</td>
                    <td className="text-right">{batch.tradeCount}</td>
                    <td className="text-right text-dim">{batch.skippedCount}</td>
                    <td className="text-right">
                      <form action={undoImport}>
                        <input type="hidden" name="id" value={batch.id} />
                        <button className="btn btn-sm btn-ghost text-[#ff9aa3]" type="submit">
                          Undo import
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Backup everything">
          <p className="mb-3 text-sm text-dim">
            Downloads one JSON file with every account, trade, journal note, playbook and money entry. Keep a copy
            somewhere safe.
          </p>
          <a className="btn btn-primary" href="/api/backup" download>
            Download JSON backup
          </a>
        </Card>
        <Card title="Restore from a backup">
          <RestoreForm />
        </Card>
      </div>
    </div>
  );
}
