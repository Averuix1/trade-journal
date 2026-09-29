import { MoneyText } from '@/components/ui';
import { HBar } from '@/components/charts';
import { fmtHold, fmtNum, fmtPct, fmtR } from '@/lib/format';
import type { Breakdown } from '@/lib/stats';

type Column = 'trades' | 'winRate' | 'avgWin' | 'avgLoss' | 'avgR' | 'pf' | 'hold' | 'winHold' | 'lossHold' | 'bar';

const HEADERS: Record<Column, string> = {
  trades: 'Trades',
  winRate: 'Win %',
  avgWin: 'Avg win',
  avgLoss: 'Avg loss',
  avgR: 'Avg R',
  pf: 'PF',
  hold: 'Hold',
  winHold: 'W hold',
  lossHold: 'L hold',
  bar: '',
};

export function BreakdownTable({
  rows,
  columns = ['trades', 'winRate', 'avgWin', 'avgLoss', 'avgR'],
  emptyLabel = 'Nothing to break down yet.',
}: {
  rows: Breakdown[];
  columns?: Column[];
  emptyLabel?: string;
}) {
  if (!rows.length) return <p className="text-sm text-dim">{emptyLabel}</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.stats.totalPnl)), 1);

  return (
    <div className="scroll-x">
      <table className="tabular">
        <thead>
          <tr>
            <th className="py-1.5">Name</th>
            <th className="text-right">P&L</th>
            {columns.map((c) => (
              <th key={c} className={c === 'bar' ? 'w-24' : 'text-right'}>
                {HEADERS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-rows">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="py-1.5 text-fg">{row.label}</td>
              <td className="text-right">
                <MoneyText value={row.stats.totalPnl} />
              </td>
              {columns.map((c) => (
                <td key={c} className={c === 'bar' ? '' : 'text-right text-dim'}>
                  {c === 'trades' && row.stats.trades}
                  {c === 'winRate' && fmtPct(row.stats.winRate)}
                  {c === 'avgWin' && <MoneyText value={row.stats.avgWin} />}
                  {c === 'avgLoss' && <MoneyText value={-row.stats.avgLoss} />}
                  {c === 'avgR' && fmtR(row.stats.avgR)}
                  {c === 'pf' && fmtNum(row.stats.profitFactor)}
                  {c === 'hold' && fmtHold(row.stats.avgHoldMins)}
                  {c === 'winHold' && fmtHold(row.stats.winHoldMins)}
                  {c === 'lossHold' && fmtHold(row.stats.lossHoldMins)}
                  {c === 'bar' && <HBar pct={(Math.abs(row.stats.totalPnl) / max) * 100} tone={row.stats.totalPnl >= 0 ? 'mint' : 'red'} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
