'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { accounts, imports, instruments, screenshots, trades } from '@/lib/db/schema';
import { autoFees, autoPnl, autoR, round2 } from '@/lib/calc';
import {
  MAPPING_FIELDS,
  convertRows,
  detectSource,
  parseCsv,
  suggestMapping,
  type Mapping,
  type MappingKey,
} from '@/lib/csv';
import { getSettings } from '@/lib/queries';
import { tradingDay } from '@/lib/time';
import { recomputeAccountDays, str, type FormState } from '@/lib/actions/shared';

export type ImportPreview = {
  csv: string;
  fileName: string;
  source: string;
  headers: string[];
  mapping: Mapping;
  sampleRows: string[][];
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
  const mapping = existingCsv ? mappingFromForm(formData, table.headers) : suggestMapping(table.headers);
  const rows = convertRows(table, mapping, timezone);

  return {
    preview: {
      csv,
      fileName,
      source: detectSource(table.headers),
      headers: table.headers,
      mapping,
      sampleRows: table.rows.slice(0, 12),
      totalRows: table.rows.length,
      ready: rows.filter((r) => !r.error).length,
      errors: rows.filter((r) => r.error).slice(0, 8).map((r) => ({ row: r.index + 2, message: r.error! })),
      timezone,
    },
    ok: true,
  };
}

export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const config = await getSettings();
  const accountId = Number(formData.get('accountId'));
  if (!accountId) return { error: 'Pick the account these trades belong to.' };
  const csv = str(formData.get('csv'));
  if (!csv) return { error: 'Upload the file again.' };

  const table = parseCsv(csv);
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
    const pointValue = instrument?.pointValue ?? 1;
    const fees = row.fees != null ? Math.abs(row.fees) : autoFees(row.contracts, instrument?.commissionPerContract ?? 0);
    const pnl =
      row.pnl != null
        ? round2(row.pnl - (row.fees != null ? 0 : fees))
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
      rMultiple: autoR(row.side, row.entryPrice, null, row.contracts, pointValue, pnl),
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

export async function undoImport(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  const rows = await db.select().from(trades).where(eq(trades.importId, id));
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await db.delete(screenshots).where(inArray(screenshots.tradeId, ids));
    await db.delete(trades).where(inArray(trades.id, ids));
  }
  const [batch] = await db.select().from(imports).where(eq(imports.id, id));
  await db.delete(imports).where(eq(imports.id, id));
  if (batch) await recomputeAccountDays(batch.accountId, rows.map((r) => r.tradeDate));
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
  for (const row of accountRows) {
    const oldId = Number(row.id);
    const [created] = await db
      .insert(accounts)
      .values({ ...row, id: undefined, name: `${row.name} (restored)`, createdAt: undefined })
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
  revalidatePath('/', 'layout');
  return { ok: true, message: `Restored ${accountRows.length} account(s) and ${restored} trade(s).` };
}
