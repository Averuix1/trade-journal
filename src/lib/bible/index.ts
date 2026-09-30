import 'server-only';

export { assertCuratedVerses, findBook, getChapter, getCuratedVerses, listBooks, resolveRef } from '@/lib/bible/load';
export { bookSlug } from '@/lib/bible/slug';
export type { BookSummary, ChapterView, CuratedVerse, ResolvedRef } from '@/lib/bible/types';
