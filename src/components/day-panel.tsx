import Image from 'next/image';
import { Badge, MoneyText } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { DayJournalForm } from '@/components/day-journal-form';
import { DayScreenshotForm } from '@/components/day-screenshot-form';
import type { DayJournal, SessionDef, Trade } from '@/lib/db/schema';
import { toggleDayHidden } from '@/lib/actions/journal';
import { deleteScreenshot } from '@/lib/actions/trades';
import { fmtHold, fmtR } from '@/lib/format';
import { formatDayLong, formatTime } from '@/lib/time';
import { BREAK_SHORT } from '@/lib/defaults';
import { screenshotSrc } from '@/lib/blob';

export type DayPanelData = {
  date: string;
  accountId: number;
  trades: Trade[];
  journal: DayJournal | undefined;
  screenshots: { id: number; url: string | null; caption: string | null }[];
  sessions: SessionDef[];
  timezone: string;
  closeHref: string;
  mistakeTags: string[];
  activeSessionKeys: string[];
  checklistItems: string[];
  checklistSkipIfNo: number;
};

export function DayPanel({ data }: { data: DayPanelData }) {
  const pnl = data.trades.reduce((sum, t) => sum + t.pnl, 0);
  const rTotal = data.trades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const broke = data.trades.some((t) => !t.inSystem);
  const hidden = data.journal?.hidden ?? false;

  let running = 0;
  const curve = [
    { label: 'open', value: 0 },
    ...[...data.trades]
      .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())
      .map((t) => {
        running += t.pnl;
        return { label: formatTime(t.openedAt, data.timezone), value: running };
      }),
  ];

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-line bg-ink-950 shadow-2xl shadow-black/70">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-sm font-medium text-fg-strong">{formatDayLong(data.date)}</div>
          <div className="tabular mt-0.5 text-2xl font-semibold">
            <MoneyText value={pnl} />
            <span className="ml-2 text-sm text-dim">{fmtR(rTotal)}</span>
          </div>
        </div>
        <a href={data.closeHref} className="btn btn-sm btn-ghost" aria-label="Close day panel">
          Close
        </a>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {broke ? <Badge tone="down">Rule break this day</Badge> : <Badge tone="up">Rules kept this day</Badge>}
          {data.journal?.satOut && <Badge tone="warn">Sat out</Badge>}
          <form action={toggleDayHidden} className="ml-auto">
            <input type="hidden" name="accountId" value={data.accountId} />
            <input type="hidden" name="date" value={data.date} />
            <button className={`btn btn-sm ${hidden ? 'btn-primary' : ''}`} type="submit">
              {hidden ? 'Show this day' : 'Hide from results'}
            </button>
          </form>
        </div>

        <div>
          <div className="card-title mb-2">Day performance</div>
          <div className="rounded-xl border border-line bg-ink-900 p-3">
            <LineChart series={[{ points: curve, colour: pnl >= 0 ? 'rgb(var(--mint-400))' : 'rgb(var(--loss))', label: 'Day' }]} />
          </div>
        </div>

        <div>
          <div className="card-title mb-2">Trades</div>
          {data.trades.length === 0 ? (
            <p className="text-sm text-dim">No trades logged on this day.</p>
          ) : (
            <div className="scroll-x rounded-xl border border-line bg-ink-900 p-3">
              <table className="tabular">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Slot</th>
                    <th>Instr.</th>
                    <th>Side</th>
                    <th className="text-right">Entry</th>
                    <th className="text-right">Exit</th>
                    <th className="text-right">Hold</th>
                    <th className="text-right">P&L</th>
                    <th className="text-right">R</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-rows">
                  {data.trades.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap text-dim">
                        {data.sessions.find((s) => s.key === t.sessionKey)?.shortName ?? '—'}
                      </td>
                      <td>{t.slot ?? '—'}</td>
                      <td>{t.symbol}</td>
                      <td className="text-dim">{t.side === 'LONG' ? 'L' : 'S'}</td>
                      <td className="whitespace-nowrap text-right text-dim">{t.entryPrice ?? '—'}</td>
                      <td className="whitespace-nowrap text-right text-dim">{t.exitPrice ?? '—'}</td>
                      <td className="whitespace-nowrap text-right text-dim">
                        {fmtHold(t.closedAt ? (t.closedAt.getTime() - t.openedAt.getTime()) / 60000 : null)}
                      </td>
                      <td className="text-right">
                        <MoneyText value={t.pnl} />
                      </td>
                      <td className="text-right text-dim">{fmtR(t.rMultiple)}</td>
                      <td className="whitespace-nowrap text-[10px] uppercase text-dim">
                        {t.inSystem ? 'In' : t.breaks.map((b) => BREAK_SHORT[b] ?? b).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(data.journal?.screenshotLinks?.length ?? 0) > 0 && (
          <div>
            <div className="card-title mb-2">Chart links</div>
            <ul className="space-y-1 text-sm">
              {data.journal!.screenshotLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-mint-300 hover:underline">
                    {link.url}
                  </a>
                  {link.comment && <span className="ml-2 text-dim">{link.comment}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="card-title mb-2">Screenshots</div>
          {data.screenshots.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {data.screenshots.map((shot) => (
                <div key={shot.id} className="group relative overflow-hidden rounded-lg border border-line">
                  <Image
                    src={screenshotSrc(shot)}
                    alt={shot.caption ?? 'Chart screenshot'}
                    width={480}
                    height={300}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                  <form action={deleteScreenshot} className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
                    <input type="hidden" name="id" value={shot.id} />
                    <button className="btn btn-sm btn-danger" type="submit">
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <DayScreenshotForm accountId={data.accountId} date={data.date} />
        </div>

        <div>
          <div className="card-title mb-2">Day journal</div>
          <DayJournalForm
            accountId={data.accountId}
            date={data.date}
            journal={data.journal}
            mistakeTags={data.mistakeTags}
            sessions={data.sessions}
            activeSessionKeys={data.activeSessionKeys}
            checklistItems={data.checklistItems}
            checklistSkipIfNo={data.checklistSkipIfNo}
          />
        </div>
      </div>
    </aside>
  );
}
