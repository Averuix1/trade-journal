'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { saveBookmark } from '@/lib/actions/bible';
import type { FormState } from '@/lib/actions/shared';
import type { ChapterNeighbor, ChapterVerse } from '@/lib/bible/types';

const FONT_KEY = 'tj-bible-font';
type FontSize = 'S' | 'M' | 'L';
const initial: FormState = {};

function chapterHref(target: ChapterNeighbor) {
  return target ? `/bible/${target.slug}/${target.chapter}` : '';
}

function ChapterNav({ prev, next }: { prev: ChapterNeighbor; next: ChapterNeighbor }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {prev ? (
        <a href={chapterHref(prev)} className="btn btn-ghost">
          Previous · {prev.name} {prev.chapter}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a href={chapterHref(next)} className="btn btn-ghost">
          Next · {next.name} {next.chapter}
        </a>
      ) : (
        <span />
      )}
    </div>
  );
}

export function BibleReader({
  book,
  chapter,
  verses,
  prev,
  next,
  bookmarks,
}: {
  book: string;
  chapter: number;
  verses: ChapterVerse[];
  prev: ChapterNeighbor;
  next: ChapterNeighbor;
  bookmarks: { id: number; verse: number | null; note: string | null }[];
}) {
  const [size, setSize] = useState<FontSize>('M');
  const [active, setActive] = useState<number | null>(null);
  const [state, action, pending] = useActionState(saveBookmark, initial);
  const chapterMark = bookmarks.find((mark) => mark.verse == null);
  const activeMark = bookmarks.find((mark) => mark.verse === active);

  useEffect(() => {
    const saved = window.localStorage.getItem(FONT_KEY);
    if (saved === 'S' || saved === 'M' || saved === 'L') setSize(saved);
  }, []);

  const chooseSize = (nextSize: FontSize) => {
    setSize(nextSize);
    window.localStorage.setItem(FONT_KEY, nextSize);
  };

  const sizeClass = size === 'S' ? 'text-base' : size === 'L' ? 'text-xl' : 'text-lg';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-850 p-0.5" role="group" aria-label="Font size">
          {(['S', 'M', 'L'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={size === value}
              className={`rounded-md px-3 py-1.5 text-xs ${size === value ? 'chip-on' : 'text-dim'}`}
              onClick={() => chooseSize(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="book" value={book} />
          <input type="hidden" name="chapter" value={chapter} />
          <input
            name="note"
            defaultValue={chapterMark?.note ?? ''}
            placeholder="Optional note"
            aria-label="Chapter bookmark note"
            className="text-sm"
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {chapterMark ? 'Update chapter bookmark' : 'Bookmark chapter'}
          </button>
        </form>
      </div>

      <ChapterNav prev={prev} next={next} />

      <article className={`mx-auto max-w-[65ch] font-serif ${sizeClass} leading-[1.75] text-fg`}>
        {verses.map((verse) => {
          const marked = bookmarks.some((mark) => mark.verse === verse.n);
          return (
            <p key={verse.n} id={`v${verse.n}`} className={`rounded-lg px-2 py-1 ${active === verse.n ? 'bg-ink-800' : ''}`}>
              <button
                type="button"
                className="text-left"
                aria-label={`Verse ${verse.n}`}
                onClick={() => setActive(active === verse.n ? null : verse.n)}
              >
                <span className="mr-2 align-super text-[0.7em] tabular text-dim">{verse.n}</span>
                {verse.text}
                {marked && <span className="ml-2 align-super text-[0.65em] uppercase tracking-wide text-mint-300">Saved</span>}
              </button>
            </p>
          );
        })}
      </article>

      {active != null && (
        <form action={action} className="mx-auto max-w-[65ch] space-y-2 rounded-xl border border-line bg-ink-850/50 p-4">
          <input type="hidden" name="book" value={book} />
          <input type="hidden" name="chapter" value={chapter} />
          <input type="hidden" name="verse" value={active} />
          <label className="label" htmlFor="verse-note">
            Bookmark {book} {chapter}:{active}
          </label>
          <input id="verse-note" name="note" defaultValue={activeMark?.note ?? ''} placeholder="Optional note" className="field" />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {activeMark ? 'Update verse bookmark' : 'Save verse bookmark'}
          </button>
        </form>
      )}

      {state.error && <p className="text-sm text-loss-text">{state.error}</p>}
      {state.message && <p className="text-sm text-mint-200">{state.message}</p>}

      <ChapterNav prev={prev} next={next} />
    </div>
  );
}
