export const DEFAULT_INSTRUMENTS = [
  { symbol: 'NQ', name: 'E-mini Nasdaq 100', pointValue: 20, tickSize: 0.25, commissionPerContract: 4.04, aliases: ['NASDAQ', 'NAS100'], sortOrder: 0 },
  { symbol: 'MNQ', name: 'Micro Nasdaq 100', pointValue: 2, tickSize: 0.25, commissionPerContract: 1.34, aliases: [] as string[], sortOrder: 1 },
  { symbol: 'ES', name: 'E-mini S&P 500', pointValue: 50, tickSize: 0.25, commissionPerContract: 4.04, aliases: [] as string[], sortOrder: 2 },
  { symbol: 'MES', name: 'Micro S&P 500', pointValue: 5, tickSize: 0.25, commissionPerContract: 1.34, aliases: [] as string[], sortOrder: 3 },
  { symbol: 'YM', name: 'E-mini Dow', pointValue: 5, tickSize: 1, commissionPerContract: 4.04, aliases: ['US30'], sortOrder: 4 },
  { symbol: 'MYM', name: 'Micro Dow', pointValue: 0.5, tickSize: 1, commissionPerContract: 1.34, aliases: [] as string[], sortOrder: 5 },
];

/** Applied when an instrument still has no aliases, so an edit is left alone. */
export const SEEDED_INSTRUMENT_ALIASES: Record<string, string[]> = {
  NQ: ['NASDAQ', 'NAS100'],
  YM: ['US30'],
};

/** Session windows are stored as minutes past midnight, New York time. */
export const DEFAULT_SESSIONS = [
  { key: 'asia', name: 'Asia', shortName: 'ASIA', startMinute: 19 * 60, endMinute: 2 * 60, entryWindowMins: 60, sortOrder: 0 },
  { key: 'london', name: 'London', shortName: 'LDN', startMinute: 3 * 60, endMinute: 8 * 60, entryWindowMins: 45, sortOrder: 1 },
  { key: 'ny_am', name: 'New York AM', shortName: 'NY AM', startMinute: 9 * 60 + 30, endMinute: 12 * 60, entryWindowMins: 30, sortOrder: 2 },
  { key: 'ny_pm', name: 'New York PM', shortName: 'NY PM', startMinute: 13 * 60, endMinute: 16 * 60, entryWindowMins: 30, sortOrder: 3 },
];

/** The eight reasons from the owner's rules playbook. Editable after that; nothing else is assumed. */
export const DEFAULT_MISTAKE_TAGS = [
  'Revenge',
  'FOMO',
  'Overtrading',
  'Boredom',
  'Chased Move',
  'Ignored Daily Limit',
  'Late Entry',
  'Other',
];

export const DEFAULT_RISK_PRESETS = [200, 250, 300, 400, 500];

/** Process checks shown before each session. The user can rewrite every line. */
export const DEFAULT_CHECKLIST = [
  'Slept 7 or more hours',
  'No unaccounted news in the session',
  'Higher-timeframe bias checked',
  'Max risk for today is decided',
  'Max trades for the session is clear',
  'The session plan is written down',
  'Not in a revenge mindset',
  'Phone is silent',
  'Journal is open',
  'Sitting out is an acceptable result',
];

export const DEFAULT_SESSION_ALIASES: Record<string, string[]> = {
  asia: ['Asia', 'ASIA'],
  london: ['London', 'LDN', 'LON'],
  ny_am: ['New York', 'NY', 'New York AM', 'NY AM'],
  ny_pm: ['New York PM', 'NY PM'],
};

export const PROP_FIRMS = ['Topstep', 'Apex', 'Tradeify', 'Lucid', 'TakeProfit', 'MyFundedFutures', 'Other'];

export const BREAK_LABELS: Record<string, string> = {
  DUMP: 'Dump',
  OUTSIDE: 'Late / outside',
  RULE: 'Playbook rule broken',
  MISTAKE: 'Mistake tagged',
};

/** Compact versions for tight table cells. */
export const BREAK_SHORT: Record<string, string> = {
  DUMP: 'Dump',
  OUTSIDE: 'Late',
  RULE: 'Rule',
  MISTAKE: 'Mistake',
};

export const BREAK_DESCRIPTIONS: Record<string, string> = {
  DUMP: 'Over the session cap',
  OUTSIDE: 'Entry outside the session or entry window',
  RULE: 'A playbook rule was ticked as broken',
  MISTAKE: 'A mistake tag was attached',
};

export const LEDGER_KINDS = [
  { value: 'EVAL_FEE', label: 'Eval fee', sign: -1, scope: 'PROP' },
  { value: 'RESET_FEE', label: 'Reset fee', sign: -1, scope: 'PROP' },
  { value: 'ACTIVATION_FEE', label: 'Activation fee', sign: -1, scope: 'PROP' },
  { value: 'MONTHLY_FEE', label: 'Monthly fee', sign: -1, scope: 'PROP' },
  { value: 'DATA_FEE', label: 'Data / platform fee', sign: -1, scope: 'PROP' },
  { value: 'PAYOUT', label: 'Payout', sign: 1, scope: 'PROP' },
  { value: 'DEPOSIT', label: 'Deposit', sign: 1, scope: 'PERSONAL' },
  { value: 'WITHDRAWAL', label: 'Withdrawal', sign: -1, scope: 'PERSONAL' },
] as const;

export const FEE_KINDS = ['EVAL_FEE', 'RESET_FEE', 'ACTIVATION_FEE', 'MONTHLY_FEE', 'DATA_FEE'];

export const GRADES = ['A', 'B', 'C', 'D', 'F'];
