export const NY_TZ = 'America/New_York';

export const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
];

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function zonedParts(date: Date, timeZone: string): Parts {
  const bag: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour === '24' ? '0' : bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for the given instant, in the given zone. */
export function dateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The trading day a fill belongs to: the New York calendar date of the fill. */
export function tradingDay(date: Date): string {
  return dateKey(date, NY_TZ);
}

/** Minutes past midnight in the given zone. */
export function minuteOfDay(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** Converts a `YYYY-MM-DDTHH:mm` wall-clock string in `timeZone` to a UTC instant. */
export function zonedInputToUtc(value: string, timeZone: string): Date {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0);
  let guess = new Date(naive);
  for (let i = 0; i < 3; i += 1) {
    guess = new Date(naive - offsetMs(guess, timeZone));
  }
  return guess;
}

/** Inverse of `zonedInputToUtc`, for `<input type="datetime-local">`. */
export function utcToZonedInput(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatTime(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateTime(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function minutesToClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function clockToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Parses YYYY-MM-DD as a calendar date without any timezone drift. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekdayOf(key: string): number {
  return parseDateKey(key).getUTCDay();
}

export function weekdayName(key: string): string {
  return WEEKDAYS[weekdayOf(key)];
}

export function monthName(month: number): string {
  return MONTHS[month - 1];
}

export function formatDayLong(key: string): string {
  const d = parseDateKey(key);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

export function formatDayShort(key: string): string {
  const d = parseDateKey(key);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(2)}`;
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKeyFromUtcDate(d);
}

export function dateKeyFromUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ISO week key like 2026-W40, used for the calendar's weekly totals column. */
export function isoWeekKey(key: string): string {
  const d = parseDateKey(key);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000 - ((firstThursday.getUTCDay() + 6) % 7) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

export function startOfWeek(key: string): string {
  const d = parseDateKey(key);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return dateKeyFromUtcDate(d);
}

export function monthKeyOf(key: string): string {
  return key.slice(0, 7);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayKey(timeZone: string): string {
  return dateKey(new Date(), timeZone);
}
