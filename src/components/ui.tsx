import type { ReactNode } from 'react';
import Link from 'next/link';
import { fmtMoney, fmtSigned } from '@/lib/format';

export function Card({
  title,
  action,
  children,
  className = '',
  bodyClassName = 'card-pad',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
          <h2 className="card-title">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  size = 'md',
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'up' | 'down' | 'auto';
  size?: 'sm' | 'md' | 'lg';
}) {
  const toneClass =
    tone === 'up' ? 'text-[#7df3bd]' : tone === 'down' ? 'text-[#ff8c96]' : 'text-[#eafff7]';
  const sizeClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <div>
      <div className="card-title">{label}</div>
      <div className={`tabular mt-1 font-semibold tracking-tight ${sizeClass} ${toneClass}`}>{value}</div>
      {sub != null && <div className="mt-1 text-xs text-dim">{sub}</div>}
    </div>
  );
}

export function MoneyStat({ label, value, sub, decimals }: { label: ReactNode; value: number; sub?: ReactNode; decimals?: boolean }) {
  return (
    <Stat
      label={label}
      value={fmtSigned(value, decimals)}
      sub={sub}
      tone={value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'}
    />
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  const map: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };
  return <div className={`grid gap-4 ${map[cols] ?? map[4]}`}>{children}</div>;
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-base font-medium text-[#d8ece6]">{title}</div>
      <p className="max-w-md text-sm text-dim">{body}</p>
      {action && (
        <Link className="btn btn-primary mt-1" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'up' | 'down' | 'warn' | 'on';
}) {
  const map = {
    neutral: 'border-line bg-ink-850 text-dim',
    up: 'border-mint-500/40 bg-mint-500/15 text-mint-200',
    down: 'border-[#7a2331] bg-[#3a1119] text-[#ff9aa3]',
    warn: 'border-[#7a5a23] bg-[#3a2d11] text-[#ffd79a]',
    on: 'border-mint-400/60 bg-mint-400/20 text-mint-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${map[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ pct, tone = 'mint' }: { pct: number; tone?: 'mint' | 'warn' }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
      <div
        className={`h-full rounded-full ${tone === 'mint' ? 'bg-mint-400' : 'bg-[#e0a24e]'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function KeyValue({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-dim">{label}</span>
      <span
        className={`tabular text-sm font-medium ${
          tone === 'up' ? 'text-[#7df3bd]' : tone === 'down' ? 'text-[#ff8c96]' : 'text-[#e6fff5]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9fd3c2]">{children}</h2>
      {hint && <span className="text-xs text-dim">{hint}</span>}
    </div>
  );
}

export function MoneyText({ value, decimals = false }: { value: number; decimals?: boolean }) {
  return (
    <span className={`tabular ${value > 0 ? 'text-[#7df3bd]' : value < 0 ? 'text-[#ff8c96]' : 'text-dim'}`}>
      {fmtSigned(value, decimals)}
    </span>
  );
}

export function PlainMoney({ value, decimals = false }: { value: number; decimals?: boolean }) {
  return <span className="tabular">{fmtMoney(value, decimals)}</span>;
}
