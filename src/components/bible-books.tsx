'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BookSummary } from '@/lib/bible/types';

export function BibleBooks({ books }: { books: BookSummary[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sections: { label: string; testament: BookSummary['testament'] }[] = [
    { label: 'Old Testament', testament: 'OT' },
    { label: 'New Testament', testament: 'NT' },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.testament}>
          <h3 className="mb-2 text-xs uppercase tracking-[0.16em] text-dim">{section.label}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {books
              .filter((book) => book.testament === section.testament)
              .map((book) => {
                const expanded = open === book.slug;
                return (
                  <div key={book.slug} data-bible-book={book.slug} className="rounded-xl border border-line-soft bg-ink-850/40">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-fg-strong hover:bg-ink-800"
                      onClick={() => setOpen(expanded ? null : book.slug)}
                    >
                      <span>{book.name}</span>
                      <span className="text-[11px] text-dim">{book.chapters} ch</span>
                    </button>
                    <div className={expanded ? 'grid grid-cols-6 gap-1 px-3 pb-3 sm:grid-cols-8' : 'hidden'}>
                      {Array.from({ length: book.chapters }, (_, index) => (
                        <Link
                          key={index + 1}
                          href={`/bible/${book.slug}/${index + 1}`}
                          className="rounded-md border border-line px-1 py-1 text-center text-xs tabular text-fg hover:border-line-bright hover:bg-ink-800"
                        >
                          {index + 1}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
