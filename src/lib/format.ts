const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export function fmtMoney(value: number | null | undefined, decimals = false): string {
  if (value == null || Number.isNaN(value)) return '—';
  return decimals ? money2.format(value) : money0.format(value);
}

export function fmtSigned(value: number | null | undefined, decimals = false): string {
  if (value == null || Number.isNaN(value)) return '—';
  const body = fmtMoney(Math.abs(value), decimals);
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

export function fmtR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}R`;
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function fmtNum(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(decimals);
}

export function fmtHold(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return '—';
  if (mins < 1) return '<1m';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function pnlTone(value: number, band = 0): 'up' | 'down' | 'flat' {
  if (value > band) return 'up';
  if (value < -band) return 'down';
  return 'flat';
}

export function pnlClass(value: number): string {
  if (value > 0) return 'text-[#7df3bd]';
  if (value < 0) return 'text-[#ff8c96]';
  return 'text-dim';
}

/** Compact signed money for tight cells: +$500, -$1.3k, +$12k. */
export function fmtSignedCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  if (abs < 1000) return `${sign}$${Math.round(abs)}`;
  const k = abs / 1000;
  return `${sign}$${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
}

/** Short R for tight cells: +2R, -0.5R, +1.3R. */
export function fmtRShort(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  const body = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '');
  return `${sign}${body}R`;
}
