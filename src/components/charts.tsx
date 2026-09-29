import type { EquityPoint } from '@/lib/stats';
import { fmtMoney, fmtPct } from '@/lib/format';

function path(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

type Series = { points: EquityPoint[]; colour: string; label: string; dashed?: boolean };

export function LineChart({
  series,
  height = 180,
  baseline,
  showZero = true,
}: {
  series: Series[];
  height?: number;
  baseline?: number;
  showZero?: boolean;
}) {
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  if (baseline != null) all.push(baseline);
  if (!all.length) {
    return <div className="flex h-[180px] items-center justify-center text-xs text-dim">No data yet.</div>;
  }
  const width = 600;
  const pad = 6;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (showZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const scaleY = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const zeroY = scaleY(0);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full" preserveAspectRatio="none">
        <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray="3 4" />
        {baseline != null && (
          <line x1="0" x2={width} y1={scaleY(baseline)} y2={scaleY(baseline)} stroke="rgb(var(--loss))" strokeWidth="1.5" strokeDasharray="5 4" />
        )}
        {series.map((s, si) => {
          const n = Math.max(1, s.points.length - 1);
          const pts = s.points.map((p, i) => ({ x: (i / n) * width, y: scaleY(p.value) }));
          const last = pts[pts.length - 1];
          return (
            <g key={si}>
              {si === 0 && pts.length > 1 && (
                <path
                  d={`${path(pts)} L${width},${zeroY} L0,${zeroY} Z`}
                  fill={s.colour}
                  opacity="0.12"
                />
              )}
              <path
                d={path(pts)}
                fill="none"
                stroke={s.colour}
                strokeWidth="2"
                strokeDasharray={s.dashed ? '5 4' : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {last && <circle cx={last.x} cy={last.y} r="3" fill={s.colour} />}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-dim">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <i className="inline-block h-0.5 w-4 rounded" style={{ background: s.colour }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BarChart({
  bars,
  height = 160,
  format = (v: number) => fmtMoney(v),
}: {
  bars: { label: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
}) {
  if (!bars.length) return <div className="flex h-[120px] items-center justify-center text-xs text-dim">No data yet.</div>;
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {bars.map((b, i) => {
        const h = (Math.abs(b.value) / max) * (height - 26);
        const up = b.value >= 0;
        return (
          <div key={`${b.label}-${i}`} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              className={`w-full rounded-t ${up ? 'bg-mint-500/80' : 'bg-loss'}`}
              style={{ height: Math.max(2, h) }}
              title={`${b.label}: ${format(b.value)}`}
            />
            <span className="w-full truncate text-center text-[9px] text-dim">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HBar({ pct, tone = 'mint' }: { pct: number; tone?: 'mint' | 'red' }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
      <div className={`h-full ${tone === 'mint' ? 'bg-mint-400' : 'bg-loss'}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Gauge({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgb(var(--mint-400))"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
        />
      </svg>
      <div>
        <div className="tabular text-2xl font-semibold text-fg-strong">{fmtPct(pct)}</div>
        <div className="card-title mt-0.5">{label}</div>
        {sub && <div className="mt-1 text-xs text-dim">{sub}</div>}
      </div>
    </div>
  );
}

export function SplitBar({ left, right, leftLabel, rightLabel }: { left: number; right: number; leftLabel: string; rightLabel: string }) {
  const total = left + right || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className="bg-mint-400" style={{ width: `${(left / total) * 100}%` }} />
        <div className="bg-loss" style={{ width: `${(right / total) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-dim">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
