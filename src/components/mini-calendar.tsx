import Link from 'next/link';
import type { DaySummary } from '@/lib/stats';
import { fmtR, fmtRShort, fmtSigned, fmtSignedCompact } from '@/lib/format';
import { daysInMonth, monthName, parseDateKey } from '@/lib/time';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MiniCalendar({
  month,
  days,
  hiddenDays = new Set<string>(),
}: {
  month: string;
  days: Map<string, DaySummary>;
  hiddenDays?: Set<string>;
}) {
  const [year, m] = month.split('-').map(Number);
  const total = daysInMonth(year, m);
  const first = (parseDateKey(`${month}-01`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= total; d += 1) cells.push(`${month}-${String(d).padStart(2, '0')}`);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-fg-strong">
          {monthName(m)} {year}
        </span>
        <Link href={`/calendar?month=${month}`} className="text-[11px] text-mint-300 hover:underline">
          Full calendar
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d, i) => (
          <div key={i} className="text-[9px] uppercase text-dim">
            {d}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`e${i}`} />;
          const day = days.get(key);
          const hidden = hiddenDays.has(key);
          const hasTrades = Boolean(day && day.trades > 0 && !hidden);
          const tone = hidden
            ? 'bg-ink-800 text-dim'
            : !day || day.trades === 0
              ? 'bg-ink-850/60 text-dim/70'
              : day.pnl > 0
                ? 'bg-profit/70 text-white'
                : day.pnl < 0
                  ? 'bg-loss/70 text-white'
                  : 'bg-ink-700 text-fg';
          return (
            <Link
              key={key}
              href={`/calendar?month=${key.slice(0, 7)}&day=${key}`}
              className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-md px-0.5 py-0.5 font-medium leading-tight transition hover:ring-1 hover:ring-mint-400/50 ${tone}`}
              title={day ? `${key}: ${fmtSigned(day.pnl)} · ${fmtR(day.r)}` : key}
            >
              <span className={hasTrades ? 'text-[8px] opacity-70' : 'text-[10px]'}>{Number(key.slice(8))}</span>
              {hasTrades && day && (
                <>
                  <span className="tabular whitespace-nowrap text-[9px] font-semibold">{fmtSignedCompact(day.pnl)}</span>
                  <span className="tabular whitespace-nowrap text-[8px] opacity-80">{fmtRShort(day.r)}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
