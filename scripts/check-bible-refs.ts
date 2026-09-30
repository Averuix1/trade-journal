import { assertCuratedVerses, resolveRef } from '../src/lib/bible/load';

const blanks = ['Luke 17:36', 'Acts 8:37', 'Acts 15:34', 'Acts 24:7', 'Romans 16:25'];

try {
  const result = assertCuratedVerses();
  for (const ref of blanks) {
    const resolved = resolveRef(ref);
    if (!resolved) throw new Error(`Blank verse ${ref} did not parse.`);
    if (resolved.text.trim()) throw new Error(`Expected ${ref} to be blank in the World English Bible.`);
  }
  const range = resolveRef('Psalm 23:1-4');
  if (!range?.text.includes(' ') || range.book !== 'Psalms') {
    throw new Error('Psalm 23:1-4 did not resolve against Psalms.');
  }
  console.log(`Bible refs ok: ${result.count} verses, ${result.books} books.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
