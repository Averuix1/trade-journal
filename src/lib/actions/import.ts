'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { accounts, bibleBookmarks, bibleState, dayJournals, imports, instruments, playbooks, screenshots, sessionDefs, trades } from '@/lib/db/schema';
import type { ScreenshotLink } from '@/lib/db/schema';
import { autoFees, autoPnl, autoR, rFromRisk, round2 } from '@/lib/calc';
import {
  MAPPING_FIELDS,
  convertRows,
  detectSource,
  parseCsv,
  suggestMapping,
  type Mapping,
  type MappingKey,
} from '@/lib/csv';
import { convertSheet, isSheetJournal, sheetWarnings, type SheetRow } from '@/lib/sheet-import';
import { getSettings } from '@/lib/queries';
import { tradingDay } from '@/lib/time';
import { num, recomputeAccountDays, str, type FormState } from '@/lib/actions/shared';

export type SheetPreviewRow = {
  index: number;
  date: string;
  session: string;
  slot: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  risk: number | null;
  pnl: number;
  r: number | null;
  setup: string | null;
  error: string | null;
};

export type ImportPreview = {
  csv: string;
  fileName: string;
  source: string;
  kind: 'sheet' | 'broker';
  headers: string[];
  mapping: Mapping;
  sampleRows: string[][];
  sheetRows: SheetPreviewRow[];
  warnings: string[];
  totalRows: number;
  ready: number;
  errors: { row: number; message: string }[];
  timezone: string;
};

export type ImportState = FormState & { preview?: ImportPreview };

function mappingFromForm(formData: FormData, headers: string[]): Mapping {
  const mapping: Mapping = {};
  for (const field of MAPPING_FIELDS) {
    const value = str(formData.get(`map_${field.key}`));
    if (value && headers.includes(value)) mapping[field.key as MappingKey] = value;
  }
  return mapping;
}

export async function previewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const config = await getSettings();
  const file = formData.get('file');
  const existingCsv = str(formData.get('csv'));
  let csv = existingCsv ?? '';
  let fileName = str(formData.get('fileName')) ?? 'trades.csv';

  if (file instanceof File && file.size > 0) {
    csv = await file.text();
    fileName = file.name;
  }
  if (!csv.trim()) return { error: 'Choose a CSV file first.' };

  const table = parseCsv(csv);
  if (!table.headers.length) return { error: 'That file has no header row.' };

  const timezone = str(formData.get('sourceTimezone')) ?? config.timezone;

  if (isSheetJournal(table.headers)) {
    const [sessions, specs] = await Promise.all([
      db.select().from(sessionDefs),
      db.select().from(instruments),
    ]);
    const accountId = Number(formData.get('accountId'));
    let fallbackRisk = 200;
    if (accountId) {
      const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
      if (account) fallbackRisk = account.riskPerTrade;
    }
    const rows = convertSheet(table, sessions, specs, fallbackRisk);
    return {
      preview: {
        csv,
        fileName,
        source: 'Google Sheets journal',
        kind: 'sheet',
        headers: table.headers,
        mapping: {},
        sampleRows: [],
        sheetRows: rows.map(toSheetPreview),
        warnings: sheetWarnings(rows),
        totalRows: table.rows.length,
        ready: rows.filter((r) => !r.error).length,
        errors: rows.filter((r) => r.error).slice(0, 8).map((r) => ({ row: r.index + 2, message: r.error! })),
        timezone,
      },
      ok: true,
    };
  }

  const mapping = existingCsv ? mappingFromForm(formData, table.headers) : suggestMapping(table.headers);
  const rows = convertRows(table, mapping, timezone);

  return {
    preview: {
      csv,
      fileName,
      source: detectSource(table.headers),
      kind: 'broker',
      headers: table.headers,
      mapping,
      sampleRows: table.rows.slice(0, 12),
      sheetRows: [],
      warnings: [],
      totalRows: table.rows.length,
      ready: rows.filter((r) => !r.error).length,
      errors: rows.filter((r) => r.error).slice(0, 8).map((r) => ({ row: r.index + 2, message: r.error! })),
      timezone,
    },
    ok: true,
  };
}

function toSheetPreview(row: SheetRow): SheetPreviewRow {
  return {
    index: row.index,
    date: row.date,
    session: row.sessionName ?? row.sessionLabel,
    slot: row.slot,
    symbol: row.resolvedSymbol || row.symbol,
    side: row.side,
    risk: row.plannedRisk,
    pnl: row.pnl,
    r: row.r,
    setup: row.setup,
    error: row.error,
  };
}

export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const config = await getSettings();
  const accountId = Number(formData.get('accountId'));
  if (!accountId) return { error: 'Pick the account these trades belong to.' };
  const csv = str(formData.get('csv'));
  if (!csv) return { error: 'Upload the file again.' };

  const table = parseCsv(csv);
  if (isSheetJournal(table.headers)) return runSheetImport(accountId, table, str(formData.get('fileName')), formData);

  const mapping = mappingFromForm(formData, table.headers);
  const timezone = str(formData.get('sourceTimezone')) ?? config.timezone;
  const rows = convertRows(table, mapping, timezone).filter((r) => !r.error);
  if (!rows.length) return { error: 'Nothing importable in that file with the current column mapping.' };

  const specs = await db.select().from(instruments);
  const bySymbol = new Map(specs.map((s) => [s.symbol.toUpperCase(), s]));

  const existing = await db
    .select({ externalId: trades.externalId })
    .from(trades)
    .where(eq(trades.accountId, accountId));
  const seen = new Set(existing.map((e) => e.externalId).filter(Boolean) as string[]);

  const [batch] = await db
    .insert(imports)
    .values({
      accountId,
      source: str(formData.get('source')) ?? detectSource(table.headers),
      fileName: str(formData.get('fileName')),
    })
    .returning({ id: imports.id });

  const dates: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (seen.has(row.externalId)) {
      skipped += 1;
      continue;
    }
    seen.add(row.externalId);
    const instrument = bySymbol.get(row.symbol.toUpperCase());
    const pointValue = instrument?.pointValue ?? null;
    const fees = row.fees != null ? Math.abs(row.fees) : autoFees(row.contracts, instrument?.commissionPerContract ?? 0);
    const pnl =
      row.pnl != null
        ? round2(row.pnl - (row.fees != null ? 0 : fees))
        : pointValue == null
          ? 0
          : (autoPnl(row.side, row.entryPrice, row.exitPrice, row.contracts, pointValue, fees) ?? 0);
    const tradeDate = tradingDay(row.openedAt!);
    dates.push(tradeDate);
    await db.insert(trades).values({
      accountId,
      openedAt: row.openedAt!,
      closedAt: row.closedAt,
      tradeDate,
      symbol: row.symbol,
      side: row.side,
      contracts: row.contracts,
      entryPrice: row.entryPrice,
      exitPrice: row.exitPrice,
      fees: round2(fees),
      feesOverridden: row.fees != null,
      pnl,
      pnlOverridden: row.pnl != null,
      rMultiple:
        pointValue == null ? null : autoR(row.side, row.entryPrice, null, row.contracts, pointValue, pnl),
      importId: batch.id,
      externalId: row.externalId,
    });
    inserted += 1;
  }

  await db.update(imports).set({ tradeCount: inserted, skippedCount: skipped }).where(eq(imports.id, batch.id));
  await recomputeAccountDays(accountId, dates);
  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `Imported ${inserted} trade(s). Skipped ${skipped} duplicate(s). Undo it below if it looks wrong.`,
  };
}

async function runSheetImport(
  fallbackAccountId: number,
  table: ReturnType<typeof parseCsv>,
  fileName: string | null,
  formData: FormData,
): Promise<ImportState> {
  const accountRows = await db.select().from(accounts);
  const byId = new Map(accountRows.map((account) => [account.id, account]));
  const fallback = byId.get(fallbackAccountId);
  if (!fallback) return { error: 'Pick the account these trades belong to.' };

  const [sessions, specs, books] = await Promise.all([
    db.select().from(sessionDefs),
    db.select().from(instruments),
    db.select().from(playbooks),
  ]);
  const parsed = convertSheet(table, sessions, specs, fallback.riskPerTrade).filter((row) => !row.error && row.openedAt);
  if (!parsed.length) return { error: 'Nothing importable in that Google Sheets file.' };

  const accountMode = str(formData.get('accountMode')) ?? 'all';
  const riskMode = str(formData.get('riskMode')) ?? 'keep';
  const riskOverride = num(formData.get('riskOverride'));
  const rangeFrom = formData.getAll('rangeFrom').map((value) => String(value));
  const rangeTo = formData.getAll('rangeTo').map((value) => String(value));
  const rangeAccount = formData.getAll('rangeAccount').map((value) => Number(value));

  const assigned = parsed.map((row) => {
    let accountId = fallbackAccountId;
    if (accountMode === 'row') {
      const picked = Number(formData.get(`rowAccount_${row.index}`));
      if (picked && byId.has(picked)) accountId = picked;
    } else if (accountMode === 'range') {
      for (let i = 0; i < rangeFrom.length; i += 1) {
        const id = rangeAccount[i];
        if (!rangeFrom[i] || !rangeTo[i] || !id || !byId.has(id)) continue;
        if (row.date >= rangeFrom[i] && row.date <= rangeTo[i]) {
          accountId = id;
          break;
        }
      }
    }
    const account = byId.get(accountId) ?? fallback;
    let risk = row.plannedRisk != null && row.plannedRisk > 0 ? row.plannedRisk : account.riskPerTrade;
    if (riskMode === 'all' && riskOverride != null && riskOverride > 0) risk = riskOverride;
    if (riskMode === 'row') {
      const picked = num(formData.get(`rowRisk_${row.index}`));
      if (picked != null && picked > 0) risk = picked;
    }
    return { row, accountId, risk };
  });

  const rows = assigned.map((item) => item.row);

  const known = new Set(specs.map((spec) => spec.symbol.toUpperCase()));
  let sortOrder = specs.length;
  for (const row of rows) {
    if (!row.createSymbol || known.has(row.resolvedSymbol)) continue;
    known.add(row.resolvedSymbol);
    await db
      .insert(instruments)
      .values({
        symbol: row.resolvedSymbol,
        name: row.symbol.trim() || row.resolvedSymbol,
        pointValue: null,
        tickSize: 0.25,
        commissionPerContract: 0,
        sortOrder,
      })
      .onConflictDoNothing();
    sortOrder += 1;
  }

  const playbookByName = new Map(books.map((book) => [book.name.toLowerCase(), book.id]));
  for (const setup of new Set(rows.map((row) => row.setup).filter((name): name is string => Boolean(name)))) {
    if (playbookByName.has(setup.toLowerCase())) continue;
    const [created] = await db
      .insert(playbooks)
      .values({ name: setup })
      .returning({ id: playbooks.id });
    playbookByName.set(setup.toLowerCase(), created.id);
  }

  const accountIds = [...new Set(assigned.map((item) => item.accountId))];
  const existing = await db
    .select({ accountId: trades.accountId, externalId: trades.externalId })
    .from(trades)
    .where(inArray(trades.accountId, accountIds));
  const seen = new Set(existing.filter((entry) => entry.externalId).map((entry) => `${entry.accountId}|${entry.externalId}`));

  const [batch] = await db
    .insert(imports)
    .values({ accountId: fallbackAccountId, source: 'Google Sheets journal', fileName })
    .returning({ id: imports.id });

  const datesByAccount = new Map<number, string[]>();
  const rowsByAccount = new Map<number, SheetRow[]>();
  let inserted = 0;
  let skipped = 0;

  for (const item of assigned) {
    const dates = datesByAccount.get(item.accountId) ?? [];
    dates.push(item.row.date);
    datesByAccount.set(item.accountId, dates);
    const journalRows = rowsByAccount.get(item.accountId) ?? [];
    journalRows.push(item.row);
    rowsByAccount.set(item.accountId, journalRows);

    const key = `${item.accountId}|${item.row.externalId}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    await db.insert(trades).values({
      accountId: item.accountId,
      openedAt: item.row.openedAt!,
      tradeDate: item.row.date,
      symbol: item.row.resolvedSymbol,
      side: item.row.side,
      contracts: null,
      plannedRisk: item.risk,
      timeKnown: false,
      fees: 0,
      feesOverridden: true,
      pnl: round2(item.row.pnl),
      pnlOverridden: true,
      rMultiple: rFromRisk(item.row.pnl, item.risk),
      playbookId: item.row.setup ? (playbookByName.get(item.row.setup.toLowerCase()) ?? null) : null,
      importId: batch.id,
      externalId: item.row.externalId,
    });
    inserted += 1;
  }

  for (const [accountId, journalRows] of rowsByAccount) await mergeSheetDays(accountId, journalRows);
  await db.update(imports).set({ tradeCount: inserted, skippedCount: skipped }).where(eq(imports.id, batch.id));
  for (const [accountId, dates] of datesByAccount) await recomputeAccountDays(accountId, dates);
  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `Imported ${inserted} trade(s) into ${datesByAccount.size} account(s). Skipped ${skipped} duplicate(s). Undoing this batch removes the trades. Day notes, reasons and chart links stay on the calendar.`,
  };
}

/** Fills blank day-journal fields only, so a second import does not wipe notes you edited. */
async function mergeSheetDays(accountId: number, rows: SheetRow[]) {
  const byDate = new Map<string, SheetRow>();
  for (const row of rows) {
    const current = byDate.get(row.date);
    if (!current) {
      byDate.set(row.date, row);
      continue;
    }
    byDate.set(row.date, {
      ...current,
      dayRulesFollowed: current.dayRulesFollowed ?? row.dayRulesFollowed,
      dayReason: current.dayReason ?? row.dayReason,
      dayNote: current.dayNote ?? row.dayNote,
      dayUrl: current.dayUrl ?? row.dayUrl,
      dayComment: current.dayComment ?? row.dayComment,
    });
  }

  for (const [date, row] of byDate) {
    const [existing] = await db
      .select()
      .from(dayJournals)
      .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)));
    const link: ScreenshotLink | null = row.dayUrl ? { url: row.dayUrl, comment: row.dayComment } : null;
    if (!existing) {
      await db.insert(dayJournals).values({
        accountId,
        date,
        rulesFollowed: row.dayRulesFollowed,
        ruleBreakReason: row.dayReason,
        notes: row.dayNote,
        screenshotLinks: link ? [link] : [],
      });
      continue;
    }
    const links = existing.screenshotLinks ?? [];
    const nextLinks = link && !links.some((item) => item.url === link.url) ? [...links, link] : links;
    const patch: Partial<typeof dayJournals.$inferInsert> = {};
    if (existing.rulesFollowed == null && row.dayRulesFollowed != null) patch.rulesFollowed = row.dayRulesFollowed;
    if (!existing.ruleBreakReason && row.dayReason) patch.ruleBreakReason = row.dayReason;
    if (!existing.notes && row.dayNote) patch.notes = row.dayNote;
    if (nextLinks.length !== links.length) patch.screenshotLinks = nextLinks;
    if (Object.keys(patch).length) {
      await db.update(dayJournals).set({ ...patch, updatedAt: new Date() }).where(eq(dayJournals.id, existing.id));
    }
  }
}

export async function undoImport(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  const rows = await db.select().from(trades).where(eq(trades.importId, id));
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await db.delete(screenshots).where(inArray(screenshots.tradeId, ids));
    await db.delete(trades).where(inArray(trades.id, ids));
  }
  await db.delete(imports).where(eq(imports.id, id));
  const byAccount = new Map<number, string[]>();
  for (const row of rows) {
    const dates = byAccount.get(row.accountId) ?? [];
    dates.push(row.tradeDate);
    byAccount.set(row.accountId, dates);
  }
  for (const [accountId, dates] of byAccount) await recomputeAccountDays(accountId, dates);
  revalidatePath('/', 'layout');
}

export async function restoreBackup(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a backup .json file.' };
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
  const accountRows = (payload.accounts as (typeof accounts.$inferInsert)[]) ?? [];
  const tradeRows = (payload.trades as Record<string, unknown>[]) ?? [];
  if (!accountRows.length) return { error: 'No accounts in that backup.' };

  const idMap = new Map<number, number>();
  const [quickLog] = await db.select().from(accounts).where(eq(accounts.isQuickLog, true)).limit(1);
  for (const row of accountRows) {
    const oldId = Number(row.id);
    if (row.isQuickLog && quickLog) {
      idMap.set(oldId, quickLog.id);
      continue;
    }
    const [created] = await db
      .insert(accounts)
      .values({ ...row, id: undefined, name: `${row.name} (restored)`, isQuickLog: false, createdAt: undefined })
      .returning({ id: accounts.id });
    idMap.set(oldId, created.id);
  }
  let restored = 0;
  const touched = new Map<number, string[]>();
  for (const row of tradeRows) {
    const accountId = idMap.get(Number(row.accountId));
    if (!accountId) continue;
    const openedAt = new Date(String(row.openedAt));
    const tradeDate = String(row.tradeDate ?? tradingDay(openedAt));
    await db.insert(trades).values({
      ...(row as typeof trades.$inferInsert),
      id: undefined,
      accountId,
      importId: null,
      openedAt,
      closedAt: row.closedAt ? new Date(String(row.closedAt)) : null,
      tradeDate,
      createdAt: undefined,
    });
    const list = touched.get(accountId) ?? [];
    list.push(tradeDate);
    touched.set(accountId, list);
    restored += 1;
  }
  for (const [accountId, dates] of touched) await recomputeAccountDays(accountId, dates);

  const stateRows = (payload.bibleState as { book?: string; chapter?: number; updatedAt?: string }[]) ?? [];
  for (const row of stateRows) {
    if (!row.book || !row.chapter) continue;
    await db
      .insert(bibleState)
      .values({ id: 1, book: row.book, chapter: Number(row.chapter), updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date() })
      .onConflictDoUpdate({
        target: bibleState.id,
        set: { book: row.book, chapter: Number(row.chapter), updatedAt: new Date() },
      });
  }
  const bookmarkRows = (payload.bibleBookmarks as { book?: string; chapter?: number; verse?: number | null; note?: string | null; createdAt?: string }[]) ?? [];
  const bookmarkValues = bookmarkRows
    .filter((row) => row.book && row.chapter)
    .map((row) => ({
      book: String(row.book),
      chapter: Number(row.chapter),
      verse: row.verse == null ? null : Number(row.verse),
      note: row.note ?? null,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    }));
  if (bookmarkValues.length) await db.insert(bibleBookmarks).values(bookmarkValues);

  revalidatePath('/', 'layout');
  return { ok: true, message: `Restored ${accountRows.length} account(s) and ${restored} trade(s).` };
}
