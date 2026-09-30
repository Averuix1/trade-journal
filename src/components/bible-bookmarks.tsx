'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { deleteBookmark, updateBookmark } from '@/lib/actions/bible';
import type { FormState } from '@/lib/actions/shared';
import { bookSlug } from '@/lib/bible/slug';

const initial: FormState = {};

export function BibleBookmarks({
  marks,
}: {
  marks: { id: number; book: string; chapter: number; verse: number | null; note: string | null }[];
}) {
  const [state, action, pending] = useActionState(updateBookmark, initial);
  if (!marks.length) {
    return <p className="text-sm text-dim">No bookmarks yet. Open a chapter and tap a verse, or bookmark the chapter.</p>;
  }

  return (
    <div className="space-y-3">
      {state.message && <p className="text-sm text-mint-200">{state.message}</p>}
      {state.error && <p className="text-sm text-loss-text">{state.error}</p>}
      {marks.map((mark) => {
        const href = `/bible/${bookSlug(mark.book)}/${mark.chapter}${mark.verse ? `#v${mark.verse}` : ''}`;
        const label = mark.verse ? `${mark.book} ${mark.chapter}:${mark.verse}` : `${mark.book} ${mark.chapter}`;
        return (
          <div key={mark.id} className="rounded-xl border border-line-soft bg-ink-850/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={href} className="text-sm font-medium text-fg-strong hover:underline">
                {label}
              </Link>
              <form action={deleteBookmark}>
                <input type="hidden" name="id" value={mark.id} />
                <button className="btn btn-sm btn-ghost text-loss-text" type="submit">
                  Delete
                </button>
              </form>
            </div>
            <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={mark.id} />
              <input name="note" defaultValue={mark.note ?? ''} aria-label={`Note for ${label}`} placeholder="Note" className="min-w-[12rem] flex-1 text-sm" />
              <button className="btn btn-sm" type="submit" disabled={pending}>
                Save note
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
