import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Both prop ("flip") and personal books live in one table, split by `type`. */
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<'PROP' | 'PERSONAL'>(),
  status: text('status').notNull().default('ACTIVE').$type<'ACTIVE' | 'ARCHIVED'>(),
  stage: text('stage').$type<'EVAL' | 'FUNDED' | 'BLOWN'>(),
  firm: text('firm'),
  program: text('program'),
  accountSize: doublePrecision('account_size'),
  startingBalance: doublePrecision('starting_balance').notNull().default(0),
  targetBalance: doublePrecision('target_balance'),
  targetDate: text('target_date'),
  startDate: text('start_date').notNull(),
  // user-entered prop rules, never firm presets
  profitTarget: doublePrecision('profit_target'),
  maxDrawdown: doublePrecision('max_drawdown'),
  drawdownType: text('drawdown_type').$type<'TRAILING' | 'EOD' | 'STATIC'>(),
  dailyLossLimit: doublePrecision('daily_loss_limit'),
  consistencyPct: doublePrecision('consistency_pct'),
  minTradingDays: integer('min_trading_days'),
  // discipline rules
  maxTradesPerSession: integer('max_trades_per_session').notNull().default(3),
  riskPerTrade: doublePrecision('risk_per_trade').notNull().default(300),
  /** Quick-pick dollar amounts for the add-trade form, e.g. 200, 250, 300. */
  riskPresets: jsonb('risk_presets').$type<number[]>().notNull().default([200, 250, 300, 400, 500]),
  activeSessions: jsonb('active_sessions').$type<string[]>().notNull().default([]),
  entryWindows: jsonb('entry_windows').$type<Record<string, number>>().notNull().default({}),
  resetOfAccountId: integer('reset_of_account_id'),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Built-in space for trades that are not tied to a prop or personal account. */
  isQuickLog: boolean('is_quick_log').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trades = pgTable(
  'trades',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** Trading day (YYYY-MM-DD) resolved in the display timezone; denormalised for fast grouping. */
    tradeDate: text('trade_date').notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull().$type<'LONG' | 'SHORT'>(),
    contracts: doublePrecision('contracts'),
    /** Dollar risk used for R when there is no stop price. Sheet imports and quick entry land here. */
    plannedRisk: doublePrecision('planned_risk'),
    /** Dollar take-profit target from quick entry. Null when the trade was logged from prices. */
    takeProfit: doublePrecision('take_profit'),
    /** Planned reward ÷ risk, stored so stats can compare the plan with the R that was achieved. */
    plannedRr: doublePrecision('planned_rr'),
    /** False when the open time is a placeholder (the source had a date but no clock time). */
    timeKnown: boolean('time_known').notNull().default(true),
    entryPrice: doublePrecision('entry_price'),
    stopPrice: doublePrecision('stop_price'),
    exitPrice: doublePrecision('exit_price'),
    fees: doublePrecision('fees').notNull().default(0),
    feesOverridden: boolean('fees_overridden').notNull().default(false),
    pnl: doublePrecision('pnl').notNull().default(0),
    pnlOverridden: boolean('pnl_overridden').notNull().default(false),
    rMultiple: doublePrecision('r_multiple'),
    sessionKey: text('session_key'),
    slot: text('slot'),
    playbookId: integer('playbook_id'),
    brokenRuleIds: jsonb('broken_rule_ids').$type<number[]>().notNull().default([]),
    followedRuleIds: jsonb('followed_rule_ids').$type<number[]>().notNull().default([]),
    mistakeTags: jsonb('mistake_tags').$type<string[]>().notNull().default([]),
    breaks: jsonb('breaks').$type<string[]>().notNull().default([]),
    inSystem: boolean('in_system').notNull().default(true),
    hidden: boolean('hidden').notNull().default(false),
    notes: text('notes'),
    importId: integer('import_id'),
    externalId: text('external_id'),
    /** Name of an account that was deleted while this trade was kept. */
    formerAccount: text('former_account'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('trades_external_uq').on(t.accountId, t.externalId)],
);

export const screenshots = pgTable('screenshots', {
  id: serial('id').primaryKey(),
  tradeId: integer('trade_id'),
  accountId: integer('account_id').notNull(),
  tradeDate: text('trade_date').notNull(),
  url: text('url'),
  blobPath: text('blob_path'),
  data: bytea('data'),
  contentType: text('content_type').notNull().default('image/png'),
  caption: text('caption'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dayJournals = pgTable(
  'day_journals',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id').notNull(),
    date: text('date').notNull(),
    mood: integer('mood'),
    sleepHours: doublePrecision('sleep_hours'),
    grade: text('grade'),
    followedPlan: boolean('followed_plan'),
    /** Separate from the reason: a day can be "followed" and still carry a reason. */
    rulesFollowed: boolean('rules_followed'),
    ruleBreakReason: text('rule_break_reason'),
    sleptWell: boolean('slept_well'),
    screenshotLinks: jsonb('screenshot_links').$type<ScreenshotLink[]>().notNull().default([]),
    checklist: jsonb('checklist').$type<Record<string, ChecklistRun>>().notNull().default({}),
    lesson: text('lesson'),
    notes: text('notes'),
    hidden: boolean('hidden').notNull().default(false),
    satOut: boolean('sat_out').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('day_journals_uq').on(t.accountId, t.date)],
);

export type LedgerKind =
  | 'EVAL_FEE'
  | 'RESET_FEE'
  | 'ACTIVATION_FEE'
  | 'MONTHLY_FEE'
  | 'DATA_FEE'
  | 'PAYOUT'
  | 'DEPOSIT'
  | 'WITHDRAWAL';

export const ledgerEntries = pgTable('ledger_entries', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull(),
  date: text('date').notNull(),
  kind: text('kind').notNull().$type<LedgerKind>(),
  amount: doublePrecision('amount').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playbooks = pgTable('playbooks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  colour: text('colour').notNull().default('#22d39a'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playbookRules = pgTable('playbook_rules', {
  id: serial('id').primaryKey(),
  playbookId: integer('playbook_id').notNull(),
  text: text('text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const instruments = pgTable('instruments', {
  symbol: text('symbol').primaryKey(),
  name: text('name').notNull(),
  /** Null means the symbol has no contract multiplier — results are entered in dollars and judged in R. */
  pointValue: doublePrecision('point_value'),
  tickSize: doublePrecision('tick_size').notNull().default(0.25),
  commissionPerContract: doublePrecision('commission_per_contract').notNull().default(0),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const sessionDefs = pgTable('session_defs', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  /** Minutes from midnight, New York time. */
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  entryWindowMins: integer('entry_window_mins').notNull().default(30),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const mistakeTags = pgTable(
  'mistake_tags',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [uniqueIndex('mistake_tags_name_lower_idx').on(sql`lower(${table.name})`)],
);

export const imports = pgTable('imports', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull(),
  source: text('source').notNull(),
  fileName: text('file_name'),
  tradeCount: integer('trade_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One row (id = 1): the chapter the reader last opened. */
export const bibleState = pgTable('bible_state', {
  id: integer('id').primaryKey().default(1),
  book: text('book').notNull(),
  chapter: integer('chapter').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bibleBookmarks = pgTable('bible_bookmarks', {
  id: serial('id').primaryKey(),
  book: text('book').notNull(),
  chapter: integer('chapter').notNull(),
  verse: integer('verse'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  timezone: text('timezone').notNull().default('Australia/Sydney'),
  beBandR: doublePrecision('be_band_r').notNull().default(0.09),
  /** 0 keeps R unrounded. 0.25 shows R to the nearest quarter, the way the spreadsheet did. */
  rRounding: doublePrecision('r_rounding').notNull().default(0),
  checklistItems: jsonb('checklist_items').$type<string[]>().notNull().default([]),
  checklistSkipIfNo: integer('checklist_skip_if_no').notNull().default(2),
  lastSymbol: text('last_symbol'),
  lastAccountId: integer('last_account_id'),
  /** Which trade form is open by default. The other mode stays one click away. */
  tradeEntryMode: text('trade_entry_mode').notNull().default('quick').$type<'quick' | 'detailed'>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ScreenshotLink = { url: string; comment: string | null };

export type ChecklistRun = { answers: (boolean | null)[]; note: string | null };

export type Account = typeof accounts.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type DayJournal = typeof dayJournals.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Playbook = typeof playbooks.$inferSelect;
export type PlaybookRule = typeof playbookRules.$inferSelect;
export type Instrument = typeof instruments.$inferSelect;
export type SessionDef = typeof sessionDefs.$inferSelect;
export type Screenshot = typeof screenshots.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type ImportBatch = typeof imports.$inferSelect;
export type MistakeTag = typeof mistakeTags.$inferSelect;
export type BibleState = typeof bibleState.$inferSelect;
export type BibleBookmark = typeof bibleBookmarks.$inferSelect;
