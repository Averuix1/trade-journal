import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BibleReader } from '@/components/bible-reader';
import { saveReadingPosition } from '@/lib/actions/bible';
import { getChapter } from '@/lib/bible';
import { bookmarksForChapter } from '@/lib/bible/store';

type Params = Promise<{ book: string; chapter: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { book, chapter } = await params;
  const view = getChapter(book, Number(chapter));
  return { title: view ? `${view.name} ${view.chapter} — Bible` : 'Bible — Trade Journal' };
}

export default async function BibleChapterPage({ params }: { params: Params }) {
  const { book, chapter } = await params;
  const chapterNumber = Number(chapter);
  const view = getChapter(book, chapterNumber);
  if (!view) notFound();
  await saveReadingPosition(view.name, view.chapter);
  const marks = await bookmarksForChapter(view.name, view.chapter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/bible" className="text-xs text-dim hover:underline">
            Bible
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-fg-strong">
            {view.name} {view.chapter}
          </h1>
        </div>
      </div>
      <BibleReader
        book={view.name}
        chapter={view.chapter}
        verses={view.verses}
        prev={view.prev}
        next={view.next}
        bookmarks={marks.map((mark) => ({ id: mark.id, verse: mark.verse, note: mark.note }))}
      />
    </div>
  );
}
