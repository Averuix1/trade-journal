import { zonedInputToUtc } from '@/lib/time';

export type CsvTable = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const [headers, ...body] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows: body };
}

export const MAPPING_FIELDS = [
  { key: 'openedAt', label: 'Open time' },
  { key: 'closedAt', label: 'Close time' },
  { key: 'symbol', label: 'Instrument' },
  { key: 'side', label: 'Side (long/short)' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'entryPrice', label: 'Entry price' },
  { key: 'exitPrice', label: 'Exit price' },
  { key: 'fees', label: 'Fees' },
  { key: 'pnl', label: 'P&L' },
  { key: 'externalId', label: 'Broker trade id' },
  { key: 'boughtAt', label: 'Bought time (Tradovate)' },
  { key: 'soldAt', label: 'Sold time (Tradovate)' },
  { key: 'buyPrice', label: 'Buy price (Tradovate)' },
  { key: 'sellPrice', label: 'Sell price (Tradovate)' },
] as const;

export type MappingKey = (typeof MAPPING_FIELDS)[number]['key'];
export type Mapping = Partial<Record<MappingKey, string>>;

const HEADER_HINTS: Record<MappingKey, string[]> = {
  openedAt: ['enteredat', 'entrytime', 'opentime', 'openedat', 'entry time', 'open time', 'entrydatetime'],
  closedAt: ['exitedat', 'exittime', 'closetime', 'closedat', 'exit time', 'close time', 'exitdatetime'],
  symbol: ['contractname', 'symbol', 'instrument', 'contract', 'ticker', 'product'],
  side: ['side', 'type', 'direction', 'buysell', 'b/s', 'positiontype'],
  contracts: ['size', 'qty', 'quantity', 'contracts', 'volume', 'lots'],
  entryPrice: ['entryprice', 'entry', 'avgentryprice', 'openprice'],
  exitPrice: ['exitprice', 'exit', 'avgexitprice', 'closeprice'],
  fees: ['fees', 'commission', 'commissions', 'fee'],
  pnl: ['pnl', 'netpnl', 'profit', 'p/l', 'realizedpnl', 'grosspnl', 'net p&l', 'p&l'],
  externalId: ['id', 'tradeid', 'positionid', 'orderid'],
  boughtAt: ['boughttimestamp', 'boughttime'],
  soldAt: ['soldtimestamp', 'soldtime'],
  buyPrice: ['buyprice'],
  sellPrice: ['sellprice'],
};

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9/&]/g, '');

export function suggestMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  for (const field of MAPPING_FIELDS) {
    const hints = HEADER_HINTS[field.key];
    const match = headers.find((h) => !used.has(h) && hints.includes(normalise(h)));
    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }
  return mapping;
}

export function detectSource(headers: string[]): string {
  const set = new Set(headers.map(normalise));
  if (set.has('boughttimestamp') || set.has('soldtimestamp')) return 'Tradovate';
  if (set.has('contractname') && set.has('enteredat')) return 'TopstepX';
  return 'CSV';
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Parses the timestamp formats the Topstep/Tradovate exports use. Naive times use `timeZone`. */
export function parseTimestamp(raw: string, timeZone: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    const direct = new Date(value);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    return zonedInputToUtc(`${y}-${m}-${d}T${pad(Number(hh))}:${mm}`, timeZone);
  }

  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (match) {
    const [, mo, d, y, hRaw, mm, , ampm] = match;
    let hour = Number(hRaw);
    if (ampm) {
      const isPm = ampm.toLowerCase() === 'pm';
      if (isPm && hour < 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;
    }
    return zonedInputToUtc(`${y}-${pad(Number(mo))}-${pad(Number(d))}T${pad(hour)}:${mm}`, timeZone);
  }

  match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (match) {
    const [, d, mon, y, hh, mm] = match;
    const month = MONTHS[mon.toLowerCase()];
    if (month) return zonedInputToUtc(`${y}-${pad(month)}-${pad(Number(d))}T${pad(Number(hh))}:${mm}`, timeZone);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return zonedInputToUtc(`${value}T00:00`, timeZone);

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, (m) => (m === '(' ? '-' : ''));
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function normaliseSymbol(raw: string): string {
  const value = raw.trim().toUpperCase();
  // CON.F.US.ENQ.Z25 / MNQZ5 / /MNQ  ->  base root
  const dotted = value.match(/\.([A-Z]{2,4})\.[A-Z]\d{1,2}$/);
  if (dotted) return dotted[1].replace(/^ENQ$/, 'NQ').replace(/^EP$/, 'ES');
  const stripped = value.replace(/^\//, '');
  const rooted = stripped.match(/^([A-Z]{1,4}?)[FGHJKMNQUVXZ]\d{1,2}$/);
  if (rooted) return rooted[1];
  return stripped;
}

export type ParsedRow = {
  index: number;
  openedAt: Date | null;
  closedAt: Date | null;
  symbol: string;
  side: 'LONG' | 'SHORT';
  contracts: number;
  entryPrice: number | null;
  exitPrice: number | null;
  fees: number | null;
  pnl: number | null;
  externalId: string;
  error: string | null;
};

export function convertRows(table: CsvTable, mapping: Mapping, timeZone: string): ParsedRow[] {
  const index = new Map(table.headers.map((h, i) => [h, i]));
  const get = (row: string[], key: MappingKey): string | undefined => {
    const header = mapping[key];
    if (!header) return undefined;
    const i = index.get(header);
    return i == null ? undefined : row[i];
  };

  return table.rows.map((row, i) => {
    const boughtAt = get(row, 'boughtAt');
    const soldAt = get(row, 'soldAt');
    let opened: Date | null;
    let closed: Date | null;
    let side: 'LONG' | 'SHORT';
    let entry: number | null;
    let exit: number | null;

    if (boughtAt && soldAt) {
      const bought = parseTimestamp(boughtAt, timeZone);
      const sold = parseTimestamp(soldAt, timeZone);
      const buyPrice = parseNumber(get(row, 'buyPrice'));
      const sellPrice = parseNumber(get(row, 'sellPrice'));
      const long = !bought || !sold ? true : bought.getTime() <= sold.getTime();
      side = long ? 'LONG' : 'SHORT';
      opened = long ? bought : sold;
      closed = long ? sold : bought;
      entry = long ? buyPrice : sellPrice;
      exit = long ? sellPrice : buyPrice;
    } else {
      opened = parseTimestamp(get(row, 'openedAt') ?? '', timeZone);
      closed = parseTimestamp(get(row, 'closedAt') ?? '', timeZone);
      const rawSide = (get(row, 'side') ?? 'long').trim().toLowerCase();
      side = /^(s|sell|short|sld)/.test(rawSide) ? 'SHORT' : 'LONG';
      entry = parseNumber(get(row, 'entryPrice'));
      exit = parseNumber(get(row, 'exitPrice'));
    }

    const symbol = normaliseSymbol(get(row, 'symbol') ?? '');
    const contracts = Math.abs(parseNumber(get(row, 'contracts')) ?? 1) || 1;
    const fees = parseNumber(get(row, 'fees'));
    const pnl = parseNumber(get(row, 'pnl'));
    const externalIdRaw = (get(row, 'externalId') ?? '').trim();
    const externalId =
      externalIdRaw || `${symbol}|${opened?.toISOString() ?? i}|${side}|${contracts}|${pnl ?? entry ?? ''}`;

    let error: string | null = null;
    if (!opened) error = 'No open time';
    else if (!symbol) error = 'No instrument';
    else if (pnl == null && (entry == null || exit == null)) error = 'No P&L and no entry/exit price';

    return { index: i, openedAt: opened, closedAt: closed, symbol, side, contracts, entryPrice: entry, exitPrice: exit, fees, pnl, externalId, error };
  });
}
