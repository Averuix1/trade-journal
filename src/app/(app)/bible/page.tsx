import Link from 'next/link';
import { BibleBookmarks } from '@/components/bible-bookmarks';
import { BibleBooks } from '@/components/bible-books';
import { VerseOfTheMoment } from '@/components/verse-of-the-moment';
import { Card } from '@/components/ui';
import { getCuratedVerses, listBooks } from '@/lib/bible';
import { getBookmarks, getReadingState } from '@/lib/bible/store';

export const metadata = { title: 'Bible — Super-Journal' };

export default async function BiblePage() {
  const [verses, books, state, marks] = await Promise.all([
    Promise.resolve(getCuratedVerses()),
    Promise.resolve(listBooks()),
    getReadingState(),
    getBookmarks(),
  ]);
  const initialIndex = verses.length ? Math.floor(Math.random() * verses.length) : 0;
  const continueBook = state ? books.find((book) => book.name === state.book) : null;

  return (
    <div className="space-y-5">
      <Card title="Verse of the moment">
        <VerseOfTheMoment verses={verses} initialIndex={initialIndex} />
      </Card>

      {continueBook && state && (
        <div>
          <Link href={`/bible/${continueBook.slug}/${state.chapter}`} className="btn btn-primary">
            Continue reading · {continueBook.name} {state.chapter}
          </Link>
        </div>
      )}

      <Card title="Books">
        <BibleBooks books={books} />
      </Card>

      <Card title="Bookmarks">
        <BibleBookmarks
          marks={marks.map((mark) => ({
            id: mark.id,
            book: mark.book,
            chapter: mark.chapter,
            verse: mark.verse,
            note: mark.note,
          }))}
        />
      </Card>
    </div>
  );
}
