export type Testament = 'OT' | 'NT';

export type BookSummary = {
  name: string;
  slug: string;
  testament: Testament;
  chapters: number;
};

export type ChapterVerse = { n: number; text: string };

export type ChapterNeighbor = { slug: string; name: string; chapter: number } | null;

export type ChapterView = {
  name: string;
  slug: string;
  chapter: number;
  verses: ChapterVerse[];
  prev: ChapterNeighbor;
  next: ChapterNeighbor;
};

export type CuratedVerse = {
  ref: string;
  text: string;
  meaning: string;
  trading: string;
  theme: string;
  slug: string;
  chapter: number;
};

export type ResolvedRef = {
  ref: string;
  book: string;
  slug: string;
  chapter: number;
  start: number;
  end: number;
  text: string;
};
