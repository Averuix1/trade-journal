'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { instruments, mistakeTags, sessionDefs, settings } from '@/lib/db/schema';
import { clockToMinutes } from '@/lib/time';
import { num, str, type FormState } from '@/lib/actions/shared';

export async function saveGeneralSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await db
    .update(settings)
    .set({
      timezone: str(formData.get('timezone')) ?? 'Australia/Sydney',
      beBandR: num(formData.get('beBandR')) ?? 0.09,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved.' };
}

export async function saveInstruments(_prev: FormState, formData: FormData): Promise<FormState> {
  const symbols = formData.getAll('symbol').map((v) => String(v).trim().toUpperCase());
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    if (!symbol) continue;
    const values = {
      name: String(formData.getAll('name')[i] ?? symbol),
      pointValue: Number(formData.getAll('pointValue')[i] ?? 1) || 1,
      tickSize: Number(formData.getAll('tickSize')[i] ?? 0.25) || 0.25,
      commissionPerContract: Number(formData.getAll('commissionPerContract')[i] ?? 0) || 0,
      sortOrder: i,
    };
    await db.insert(instruments).values({ symbol, ...values }).onConflictDoUpdate({ target: instruments.symbol, set: values });
  }
  const newSymbol = str(formData.get('newSymbol'))?.toUpperCase();
  if (newSymbol) {
    await db
      .insert(instruments)
      .values({
        symbol: newSymbol,
        name: str(formData.get('newName')) ?? newSymbol,
        pointValue: num(formData.get('newPointValue')) ?? 1,
        tickSize: num(formData.get('newTickSize')) ?? 0.25,
        commissionPerContract: num(formData.get('newCommission')) ?? 0,
        sortOrder: symbols.length,
      })
      .onConflictDoNothing();
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Contract table saved.' };
}

export async function deleteInstrument(formData: FormData) {
  const symbol = String(formData.get('symbol') ?? '');
  if (!symbol) return;
  await db.delete(instruments).where(eq(instruments.symbol, symbol));
  revalidatePath('/', 'layout');
}

export async function saveSessions(_prev: FormState, formData: FormData): Promise<FormState> {
  const keys = formData.getAll('key').map((v) => String(v));
  for (let i = 0; i < keys.length; i += 1) {
    await db
      .update(sessionDefs)
      .set({
        name: String(formData.getAll('sessionName')[i] ?? keys[i]),
        shortName: String(formData.getAll('shortName')[i] ?? keys[i]).toUpperCase(),
        startMinute: clockToMinutes(String(formData.getAll('start')[i] ?? '00:00')),
        endMinute: clockToMinutes(String(formData.getAll('end')[i] ?? '00:00')),
        entryWindowMins: Number(formData.getAll('entryWindow')[i] ?? 30) || 0,
        sortOrder: i,
      })
      .where(eq(sessionDefs.key, keys[i]));
  }
  const newName = str(formData.get('newSessionName'));
  if (newName) {
    const key = newName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    await db
      .insert(sessionDefs)
      .values({
        key,
        name: newName,
        shortName: (str(formData.get('newShortName')) ?? newName.slice(0, 4)).toUpperCase(),
        startMinute: clockToMinutes(str(formData.get('newStart')) ?? '09:30'),
        endMinute: clockToMinutes(str(formData.get('newEnd')) ?? '12:00'),
        entryWindowMins: num(formData.get('newEntryWindow')) ?? 30,
        sortOrder: keys.length,
      })
      .onConflictDoNothing();
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Sessions saved. Log or edit a trade to re-check older days.' };
}

export async function deleteSession(formData: FormData) {
  const key = String(formData.get('key') ?? '');
  if (!key) return;
  await db.delete(sessionDefs).where(eq(sessionDefs.key, key));
  revalidatePath('/', 'layout');
}

export async function addMistakeTag(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = str(formData.get('name'));
  if (!name) return { error: 'Type a tag name.' };
  await db.insert(mistakeTags).values({ name, sortOrder: 99 });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Tag added.' };
}

export async function deleteMistakeTag(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.delete(mistakeTags).where(eq(mistakeTags.id, id));
  revalidatePath('/', 'layout');
}
