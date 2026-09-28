import type { Instrument, SessionDef } from '@/lib/db/schema';
import { rFromRisk } from '@/lib/calc';
import { parseNumber, type CsvTable } from '@/lib/csv';
import { NY_TZ, minutesToClock, zonedInputToUtc } from '@/lib/time';

const REQUIRED = ['date', 'session', 'instrument', 'pnl_usd', 'risk_usd'];

/** True when the header row is the Google Sheets journal export, not a broker fill file. */
export function isSheetJournal(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  return REQUIRED.every((h) => set.has(h)) && (set.has('slot') || set.has('slot_label'));
}

export type SheetRow = {
  index: number;
  externalId: string;
  date: string;
  sessionLabel: string;
  sessionKey: string | null;
  sessionName: string | null;
  slot: string;
  symbol: string;
  resolvedSymbol: string;
  createSymbol: boolean;
  side: 'LONG' | 'SHORT';
  plannedRisk: number | null;
  pnl: number;
  /** Recalculated result ÷ risk. The sheet's own R column is never used. */
  r: number | null;
  setup: string | null;
  isExtra: boolean;
  dayRulesFollowed: boolean | null;
  dayReason: string | null;
  dayUrl: string | null;
  dayComment: string | null;
  dayNote: string | null;
  openedAt: Date | null;
  error: string | null;
};

function cell(row: string[], index: Map<string, number>, key: string): string {
  const i = index.get(key);
  return i == null ? '' : (row[i] ?? '').trim();
}

function yesNo(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (value === 'yes' || value === 'true' || value === 'y') return true;
  if (value === 'no' || value === 'false' || value === 'n') return false;
  return null;
}

function parseSlot(slot: string, label: string, extra: boolean): string {
  if (extra || /extra/i.test(slot) || /extra/i.test(label)) return 'EXTRA';
  const fromLabel = label.match(/T(\d+)/i);
  if (fromLabel) return `T${fromLabel[1]}`;
  if (/^\d+$/.test(slot)) return `T${Number(slot)}`;
  const fromSlot = slot.match(/^T(\d+)$/i);
  if (fromSlot) return `T${fromSlot[1]}`;
  return 'T1';
}

function resolveSession(label: string, sessions: SessionDef[]): SessionDef | null {
  const needle = label.trim().toLowerCase();
  if (!needle) return null;
  for (const session of sessions) {
    const names = [session.name, session.shortName, session.key, ...(session.aliases ?? [])].map((n) => n.toLowerCase());
    if (names.includes(needle)) return session;
  }
  return null;
}

function resolveSymbol(raw: string, instruments: Instrument[]): { symbol: string; create: boolean } {
  const value = raw.trim();
  if (!value) return { symbol: '', create: false };
  const upper = value.toUpperCase();
  for (const inst of instruments) {
    if (inst.symbol.toUpperCase() === upper) return { symbol: inst.symbol, create: false };
    if ((inst.aliases ?? []).some((alias) => alias.toUpperCase() === upper)) return { symbol: inst.symbol, create: false };
  }
  return { symbol: upper.replace(/\s+/g, ''), create: true };
}

function splitLink(url: string, comment: string): { url: string; comment: string | null } {
  if (url && !comment) {
    const split = url.match(/^(https?:\/\/\S+)\s+-\s+(.+)$/);
    if (split) return { url: split[1], comment: split[2] };
  }
  return { url, comment: comment || null };
}

/** Session open in New York, plus one minute per earlier slot, so classification reproduces T1/T2/T3. */
export function placeholderOpen(date: string, session: SessionDef, slot: string): Date {
  const slotN = Number(slot.replace(/\D/g, '')) || 1;
  let clock = session.startMinute + Math.max(0, slotN - 1);
  let day = date;
  if (clock >= 1440) {
    const [y, m, d] = date.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    day = next.toISOString().slice(0, 10);
    clock -= 1440;
  }
  return zonedInputToUtc(`${day}T${minutesToClock(clock)}`, NY_TZ);
}

/** A clock time that sits between the default sessions, so the row classifies as outside. */
function outsideOpen(date: string): Date {
  return zonedInputToUtc(`${date}T12:30`, NY_TZ);
}

export function convertSheet(
  table: CsvTable,
  sessions: SessionDef[],
  instruments: Instrument[],
  fallbackRisk: number,
): SheetRow[] {
  const index = new Map(table.headers.map((h, i) => [h.trim().toLowerCase(), i]));
  return table.rows.map((row, i) => {
    const date = cell(row, index, 'date');
    const sessionLabel = cell(row, index, 'session');
    const session = resolveSession(sessionLabel, sessions);
    const extra = /^true$/i.test(cell(row, index, 'is_extra_trade'));
    const slot = parseSlot(cell(row, index, 'slot'), cell(row, index, 'slot_label'), extra);
    const rawSymbol = cell(row, index, 'instrument');
    const resolved = resolveSymbol(rawSymbol, instruments);
    const direction = cell(row, index, 'direction').toLowerCase();
    const side: 'LONG' | 'SHORT' = direction.startsWith('s') ? 'SHORT' : 'LONG';
    const plannedRisk = parseNumber(cell(row, index, 'risk_usd'));
    const pnl = parseNumber(cell(row, index, 'pnl_usd'));
    const riskForR = plannedRisk != null && plannedRisk > 0 ? plannedRisk : fallbackRisk;
    const link = splitLink(cell(row, index, 'day_screenshot_url'), cell(row, index, 'day_screenshot_comment'));
    const isExtra = extra || slot === 'EXTRA';

    let error: string | null = null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error = 'Date must be YYYY-MM-DD.';
    else if (!rawSymbol) error = 'Missing instrument.';
    else if (pnl == null) error = 'Missing result ($).';
    else if (!direction) error = 'Missing direction.';
    else if (!isExtra && !session) error = `Session “${sessionLabel || 'blank'}” is not mapped. Add an alias under Settings → Sessions.`;

    const openedAt = error
      ? null
      : isExtra || !session
        ? outsideOpen(date)
        : placeholderOpen(date, session, slot);

    return {
      index: i,
      externalId: cell(row, index, 'trade_id') || `${date}-${sessionLabel}-${slot}-${i + 1}`,
      date,
      sessionLabel,
      sessionKey: session?.key ?? null,
      sessionName: session?.name ?? null,
      slot,
      symbol: rawSymbol,
      resolvedSymbol: resolved.symbol,
      createSymbol: resolved.create,
      side,
      plannedRisk,
      pnl: pnl ?? 0,
      r: pnl == null ? null : rFromRisk(pnl, riskForR),
      setup: cell(row, index, 'setup') || null,
      isExtra,
      dayRulesFollowed: yesNo(cell(row, index, 'day_rules_followed')),
      dayReason: cell(row, index, 'day_rule_break_reason') || null,
      dayUrl: link.url || null,
      dayComment: link.comment,
      dayNote: cell(row, index, 'day_note') || null,
      openedAt,
      error,
    };
  });
}

export function sheetWarnings(rows: SheetRow[]): string[] {
  const out: string[] = [
    'Outcome and the sheet’s R column are ignored. R is recalculated as result divided by risk.',
  ];
  const symbols = [...new Set(rows.filter((r) => !r.error && r.createSymbol).map((r) => r.resolvedSymbol))];
  for (const symbol of symbols) {
    out.push(`${symbol} will be added as a dollar / R instrument (no point value).`);
  }
  const mapped = new Set<string>();
  for (const row of rows) {
    if (row.error || !row.sessionName) continue;
    if (row.sessionLabel.toLowerCase() === row.sessionName.toLowerCase()) continue;
    if (mapped.has(row.sessionLabel.toLowerCase())) continue;
    mapped.add(row.sessionLabel.toLowerCase());
    out.push(
      `“${row.sessionLabel}” is mapped to ${row.sessionName}. There was no clock time, so those trades are placed at the session open.`,
    );
  }
  if (rows.some((r) => !r.error && r.sessionName && r.sessionLabel.toLowerCase() === r.sessionName.toLowerCase())) {
    out.push('There was no clock time, so each trade is placed at its session open and is not marked late.');
  }
  return out;
}
