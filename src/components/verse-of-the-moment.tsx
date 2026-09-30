'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CuratedVerse } from '@/lib/bible/types';
import { Badge } from '@/components/ui';

export function VerseOfTheMoment({ verses, initialIndex }: { verses: CuratedVerse[]; initialIndex: number }) {
  const themes = useMemo(() => [...new Set(verses.map((verse) => verse.theme))].sort(), [verses]);
  const [theme, setTheme] = useState('all');
  const [index, setIndex] = useState(initialIndex);
  const pool = theme === 'all' ? verses : verses.filter((verse) => verse.theme === theme);
  const verse = pool.find((item) => item === verses[index]) ?? pool[0];

  const nextVerse = () => {
    const choices = verses
      .map((_, i) => i)
      .filter((i) => i !== index && (theme === 'all' || verses[i].theme === theme));
    if (!choices.length) return;
    setIndex(choices[Math.floor(Math.random() * choices.length)]);
  };

  if (!verse) {
    return <p className="text-sm text-dim">No verses in this theme.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="on">{verse.theme}</Badge>
          <label className="flex items-center gap-2 text-xs text-dim">
            Theme
            <select
              aria-label="Filter verses by theme"
              value={theme}
              onChange={(event) => {
                const next = event.target.value;
                setTheme(next);
                const choices = verses
                  .map((item, i) => ({ item, i }))
                  .filter(({ item, i }) => (next === 'all' || item.theme === next) && i !== index);
                if (choices.length) setIndex(choices[Math.floor(Math.random() * choices.length)].i);
              }}
              className="text-sm"
            >
              <option value="all">All themes</option>
              {themes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="btn btn-primary px-5 py-2.5 text-base" onClick={nextVerse}>
          New verse
        </button>
      </div>

      <div>
        <div className="text-sm font-medium text-dim">{verse.ref}</div>
        <p className="mt-2 max-w-[65ch] font-serif text-xl leading-relaxed text-fg-strong">{verse.text}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="card-title">What it says</div>
          <p className="mt-1 text-sm leading-relaxed text-fg">{verse.meaning}</p>
        </div>
        <div>
          <div className="card-title">For trading</div>
          <p className="mt-1 text-sm leading-relaxed text-fg">{verse.trading}</p>
        </div>
      </div>

      <Link href={`/bible/${verse.slug}/${verse.chapter}`} className="text-sm text-mint-300 hover:underline">
        Read in context
      </Link>
    </div>
  );
}
