'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { accounts, ledgerEntries, type LedgerKind } from '@/lib/db/schema';
import { num, str, type FormState } from '@/lib/actions/shared';

export async function addLedgerEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const accountId = Number(formData.get('accountId'));
  const amount = num(formData.get('amount'));
  const kind = str(formData.get('kind')) as LedgerKind | null;
  const date = str(formData.get('date')) ?? new Date().toISOString().slice(0, 10);
  if (!accountId) return { error: 'Pick an account.' };
  const [account] = await db.select({ isQuickLog: accounts.isQuickLog }).from(accounts).where(eq(accounts.id, accountId));
  if (account?.isQuickLog) return { error: 'Fees and payouts are not applicable for Quick log.' };
  if (!kind) return { error: 'Pick an entry type.' };
  if (amount == null || amount <= 0) return { error: 'Enter a positive amount.' };
  await db.insert(ledgerEntries).values({ accountId, date, kind, amount, note: str(formData.get('note')) });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Entry added.' };
}

export async function deleteLedgerEntry(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.delete(ledgerEntries).where(eq(ledgerEntries.id, id));
  revalidatePath('/', 'layout');
}
