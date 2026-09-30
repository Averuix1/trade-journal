'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { findBook } from '@/lib/bible/load';
import { db } from '@/lib/db';
import { bibleBookmarks, bibleState } from '@/lib/db/schema';
import { str, type FormState } from '@/lib/actions/shared';

function revalidateBible() {
  revalidatePath('/bible', 'layout');
}

export async function saveReadingPosition(book: string, chapter: number) {
  const found = findBook(book);
  if (!found || chapter < 1 || chapter > found.summary.chapters) return;
  await db
    .insert(bibleState)
    .values({ id: 1, book: found.summary.name, chapter, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: bibleState.id,
      set: { book: found.summary.name, chapter, updatedAt: new Date() },
    });
}

export async function saveBookmark(_prev: FormState, formData: FormData): Promise<FormState> {
  const bookName = str(formData.get('book'));
  const chapter = Number(formData.get('chapter'));
  const verseRaw = str(formData.get('verse'));
  const verse = verseRaw ? Number(verseRaw) : null;
  const note = str(formData.get('note'));
  if (!bookName || !Number.isFinite(chapter)) return { error: 'Missing chapter.' };
  const found = findBook(bookName);
  if (!found || chapter < 1 || chapter > found.summary.chapters) return { error: 'That chapter is not in the Bible.' };
  if (verse != null && (!Number.isFinite(verse) || verse < 1)) return { error: 'That verse is not in this chapter.' };

  const existing = await db
    .select()
    .from(bibleBookmarks)
    .where(and(eq(bibleBookmarks.book, found.summary.name), eq(bibleBookmarks.chapter, chapter)));
  const match = existing.find((row) => (row.verse ?? null) === verse);
  if (match) {
    await db.update(bibleBookmarks).set({ note }).where(eq(bibleBookmarks.id, match.id));
  } else {
    await db.insert(bibleBookmarks).values({
      book: found.summary.name,
      chapter,
      verse,
      note,
    });
  }
  revalidateBible();
  return { ok: true, message: verse == null ? 'Chapter bookmarked.' : 'Verse bookmarked.' };
}

export async function updateBookmark(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing bookmark.' };
  await db.update(bibleBookmarks).set({ note: str(formData.get('note')) }).where(eq(bibleBookmarks.id, id));
  revalidateBible();
  return { ok: true, message: 'Note saved.' };
}

export async function deleteBookmark(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.delete(bibleBookmarks).where(eq(bibleBookmarks.id, id));
  revalidateBible();
}
