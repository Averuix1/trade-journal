'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { dayJournals } from '@/lib/db/schema';
import { bool, num, str, type FormState } from '@/lib/actions/shared';

async function upsertJournal(accountId: number, date: string, values: Partial<typeof dayJournals.$inferInsert>) {
  const [existing] = await db
    .select()
    .from(dayJournals)
    .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)));
  if (existing) {
    await db
      .update(dayJournals)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(dayJournals.id, existing.id));
  } else {
    await db.insert(dayJournals).values({ accountId, date, ...values });
  }
}

export async function saveDayJournal(_prev: FormState, formData: FormData): Promise<FormState> {
  const accountId = Number(formData.get('accountId'));
  const date = String(formData.get('date') ?? '');
  if (!accountId || !date) return { error: 'Pick an account and a day first.' };
  await upsertJournal(accountId, date, {
    mood: num(formData.get('mood')),
    sleepHours: num(formData.get('sleepHours')),
    grade: str(formData.get('grade')),
    followedPlan: formData.get('followedPlan') == null ? null : bool(formData.get('followedPlan')),
    lesson: str(formData.get('lesson')),
    notes: str(formData.get('notes')),
    satOut: bool(formData.get('satOut')),
  });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Journal saved.' };
}

export async function toggleDayHidden(formData: FormData) {
  const accountId = Number(formData.get('accountId'));
  const date = String(formData.get('date') ?? '');
  if (!accountId || !date) return;
  const [existing] = await db
    .select()
    .from(dayJournals)
    .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)));
  await upsertJournal(accountId, date, { hidden: !existing?.hidden });
  revalidatePath('/', 'layout');
}

export async function unhideAllDays(formData: FormData) {
  const accountId = Number(formData.get('accountId'));
  if (accountId) {
    await db.update(dayJournals).set({ hidden: false }).where(eq(dayJournals.accountId, accountId));
  } else {
    await db.update(dayJournals).set({ hidden: false });
  }
  revalidatePath('/', 'layout');
}

export async function markSatOut(formData: FormData) {
  const accountId = Number(formData.get('accountId'));
  const date = String(formData.get('date') ?? '');
  if (!accountId || !date) return;
  const [existing] = await db
    .select()
    .from(dayJournals)
    .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)));
  await upsertJournal(accountId, date, { satOut: !existing?.satOut });
  revalidatePath('/', 'layout');
}
