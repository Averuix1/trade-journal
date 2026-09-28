// Runs on every Vercel build (see the "build" script) so the owner never needs a terminal.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!url) {
  console.warn('[migrate] No DATABASE_URL/POSTGRES_URL set - skipping migrations.');
  process.exit(0);
}

const dir = join(process.cwd(), 'drizzle');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`create table if not exists "__migrations" (
    "name" text primary key,
    "applied_at" timestamptz not null default now()
  )`;
  const applied = new Set((await sql`select name from "__migrations"`).map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(dir, file), 'utf8');
    const statements = body
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    await sql.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement);
      await tx`insert into "__migrations" (name) values (${file})`;
    });
    console.log(`[migrate] applied ${file}`);
  }
  console.log(`[migrate] up to date (${files.length} migration file(s)).`);
} catch (error) {
  console.error('[migrate] failed:', error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
