export const DEFAULT_INSTRUMENTS = [
  { symbol: 'NQ', name: 'E-mini Nasdaq 100', pointValue: 20, tickSize: 0.25, commissionPerContract: 4.04, sortOrder: 0 },
  { symbol: 'MNQ', name: 'Micro Nasdaq 100', pointValue: 2, tickSize: 0.25, commissionPerContract: 1.34, sortOrder: 1 },
  { symbol: 'ES', name: 'E-mini S&P 500', pointValue: 50, tickSize: 0.25, commissionPerContract: 4.04, sortOrder: 2 },
  { symbol: 'MES', name: 'Micro S&P 500', pointValue: 5, tickSize: 0.25, commissionPerContract: 1.34, sortOrder: 3 },
];

/** Session windows are stored as minutes past midnight, New York time. */
export const DEFAULT_SESSIONS = [
  { key: 'asia', name: 'Asia', shortName: 'ASIA', startMinute: 19 * 60, endMinute: 2 * 60, entryWindowMins: 60, sortOrder: 0 },
  { key: 'london', name: 'London', shortName: 'LDN', startMinute: 3 * 60, endMinute: 8 * 60, entryWindowMins: 45, sortOrder: 1 },
  { key: 'ny_am', name: 'New York AM', shortName: 'NY AM', startMinute: 9 * 60 + 30, endMinute: 12 * 60, entryWindowMins: 30, sortOrder: 2 },
  { key: 'ny_pm', name: 'New York PM', shortName: 'NY PM', startMinute: 13 * 60, endMinute: 16 * 60, entryWindowMins: 30, sortOrder: 3 },
];

export const DEFAULT_MISTAKE_TAGS = [
  'Revenge',
  'FOMO',
  'Chased move',
  'Boredom',
  'Ignored daily limit',
  'Moved stop',
  'Oversized',
  'No setup',
];

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
