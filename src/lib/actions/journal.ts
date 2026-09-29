'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { dayJournals, type ChecklistRun, type ScreenshotLink } from '@/lib/db/schema';
import { bool, num, str, type FormState } from '@/lib/actions/shared';
import { getSessionDefs, getSettings } from '@/lib/queries';

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
  const tri = (key: string): boolean | null => {
    const raw = formData.get(key);
    if (raw == null || String(raw) === '') return null;
    return bool(raw);
  };
  const [config, sessions, existing] = await Promise.all([
    getSettings(),
    getSessionDefs(),
    db
      .select()
      .from(dayJournals)
      .where(and(eq(dayJournals.accountId, accountId), eq(dayJournals.date, date)))
      .then((rows) => rows[0]),
  ]);
  const url = str(formData.get('screenshotUrl'));
  const comment = str(formData.get('screenshotComment'));
  const previousUrl = str(formData.get('previousScreenshotUrl'));
  let screenshotLinks: ScreenshotLink[] = existing?.screenshotLinks ?? [];
  if (url) {
    screenshotLinks = screenshotLinks.filter((link) => link.url !== url && link.url !== previousUrl);
    screenshotLinks = [...screenshotLinks, { url, comment }];
  } else if (previousUrl) {
    screenshotLinks = screenshotLinks.filter((link) => link.url !== previousUrl);
  }
  const checklist: Record<string, ChecklistRun> = {};
  for (const session of sessions) {
    const answers = config.checklistItems.map((_, index) => {
      const value = str(formData.get(`check_${session.key}_${index}`));
      if (value === 'yes') return true;
      if (value === 'no') return false;
      return null;
    });
    const note = str(formData.get(`checkNote_${session.key}`));
    if (answers.some((answer) => answer != null) || note) checklist[session.key] = { answers, note };
  }
  await upsertJournal(accountId, date, {
    mood: num(formData.get('mood')),
    sleepHours: num(formData.get('sleepHours')),
    grade: str(formData.get('grade')),
    followedPlan: tri('followedPlan'),
    rulesFollowed: tri('rulesFollowed'),
    ruleBreakReason: str(formData.get('ruleBreakReason')),
    sleptWell: tri('sleptWell'),
    screenshotLinks,
    checklist,
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
