import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/lib/db';
import { bibleBookmarks, bibleState } from '@/lib/db/schema';

export const getReadingState = cache(async () => {
  const [row] = await db.select().from(bibleState).where(eq(bibleState.id, 1));
  return row ?? null;
});

export const getBookmarks = cache(async () => {
  return db.select().from(bibleBookmarks).orderBy(desc(bibleBookmarks.createdAt), desc(bibleBookmarks.id));
});

export async function bookmarksForChapter(book: string, chapter: number) {
  const rows = await getBookmarks();
  return rows.filter((row) => row.book === book && row.chapter === chapter);
}
