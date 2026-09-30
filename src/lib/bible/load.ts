import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookSlug } from '@/lib/bible/slug';
import type { BookSummary, ChapterView, CuratedVerse, ResolvedRef, Testament } from '@/lib/bible/types';

export { bookSlug };

type WebBook = { name: string; chapters: string[][] };
type WebFile = { books: WebBook[] };
type VerseFile = { ref: string; translation?: string; text?: string; meaning: string; trading: string; theme: string };

const BOOK_ALIASES: Record<string, string> = {
  psalm: 'Psalms',
  psalms: 'Psalms',
  'song of songs': 'Song of Solomon',
};

const OT_COUNT = 39;

let webCache: WebFile | null = null;
let curatedCache: CuratedVerse[] | null = null;

function dataPath(name: string) {
  return join(process.cwd(), 'src/lib/bible/data', name);
}

export function loadWeb(): WebFile {
  if (!webCache) {
    webCache = JSON.parse(readFileSync(dataPath('web-bible.json'), 'utf8')) as WebFile;
  }
  return webCache;
}

export function listBooks(): BookSummary[] {
  return loadWeb().books.map((book, index) => ({
    name: book.name,
    slug: bookSlug(book.name),
    testament: (index < OT_COUNT ? 'OT' : 'NT') as Testament,
    chapters: book.chapters.length,
  }));
}

export function findBook(slugOrName: string): { book: WebBook; index: number; summary: BookSummary } | null {
  const books = loadWeb().books;
  const needle = slugOrName.trim().toLowerCase();
  const index = books.findIndex((book) => book.name.toLowerCase() === needle || bookSlug(book.name) === needle);
  if (index < 0) return null;
  const summaries = listBooks();
  return { book: books[index], index, summary: summaries[index] };
}

function canonicalBook(name: string): string {
  return BOOK_ALIASES[name.trim().toLowerCase()] ?? name.trim();
}

export function parseRef(ref: string): { book: string; chapter: number; start: number; end: number } | null {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!match) return null;
  const start = Number(match[3]);
  const end = Number(match[4] ?? match[3]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { book: canonicalBook(match[1]), chapter: Number(match[2]), start, end };
}

/** Resolves a curated reference against the World English Bible. Blank verses inside a range are skipped. */
export function resolveRef(ref: string): ResolvedRef | null {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  const found = findBook(parsed.book);
  if (!found) return null;
  const chapter = found.book.chapters[parsed.chapter - 1];
  if (!chapter) return null;
  if (parsed.start < 1 || parsed.end > chapter.length) return null;
  const parts: string[] = [];
  for (let n = parsed.start; n <= parsed.end; n += 1) {
    const text = String(chapter[n - 1] ?? '').trim();
    if (text) parts.push(text);
  }
  return {
    ref,
    book: found.summary.name,
    slug: found.summary.slug,
    chapter: parsed.chapter,
    start: parsed.start,
    end: parsed.end,
    text: parts.join(' '),
  };
}

export function getChapter(slug: string, chapterNumber: number): ChapterView | null {
  const found = findBook(slug);
  if (!found) return null;
  const chapters = found.book.chapters;
  if (chapterNumber < 1 || chapterNumber > chapters.length) return null;
  const books = listBooks();
  const verses = chapters[chapterNumber - 1]
    .map((text, index) => ({ n: index + 1, text: String(text).trim() }))
    .filter((verse) => verse.text.length > 0);

  let prev: ChapterView['prev'] = null;
  let next: ChapterView['next'] = null;
  if (chapterNumber > 1) {
    prev = { slug: found.summary.slug, name: found.summary.name, chapter: chapterNumber - 1 };
  } else if (found.index > 0) {
    const earlier = books[found.index - 1];
    prev = { slug: earlier.slug, name: earlier.name, chapter: earlier.chapters };
  }
  if (chapterNumber < chapters.length) {
    next = { slug: found.summary.slug, name: found.summary.name, chapter: chapterNumber + 1 };
  } else if (found.index < books.length - 1) {
    const later = books[found.index + 1];
    next = { slug: later.slug, name: later.name, chapter: 1 };
  }

  return {
    name: found.summary.name,
    slug: found.summary.slug,
    chapter: chapterNumber,
    verses,
    prev,
    next,
  };
}

export function getCuratedVerses(): CuratedVerse[] {
  if (curatedCache) return curatedCache;
  const raw = JSON.parse(readFileSync(dataPath('verses.json'), 'utf8')) as VerseFile[];
  curatedCache = raw.map((verse) => {
    const resolved = resolveRef(verse.ref);
    if (!resolved || !resolved.text.trim()) {
      throw new Error(`Bible ref did not resolve: ${verse.ref}`);
    }
    return {
      ref: verse.ref,
      text: resolved.text,
      meaning: verse.meaning,
      trading: verse.trading,
      theme: verse.theme,
      slug: resolved.slug,
      chapter: resolved.chapter,
    };
  });
  return curatedCache;
}

export function assertCuratedVerses(): { count: number; books: number } {
  const verses = getCuratedVerses();
  const books = listBooks();
  if (books.length !== 66) throw new Error(`Expected 66 Bible books, found ${books.length}.`);
  if (!verses.length) throw new Error('No curated verses.');
  for (const verse of verses) {
    if (!verse.text.trim()) throw new Error(`Empty text for ${verse.ref}`);
  }
  return { count: verses.length, books: books.length };
}
