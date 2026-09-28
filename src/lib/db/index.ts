import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import postgres from 'postgres';
import ws from 'ws';
import * as schema from './schema';

type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

/** Rewrite `@ep-…` to `@ep-…-pooler` so Neon serves the connection from its pooler. */
function pooledNeonUrl(connectionString: string): string {
  return connectionString.replace(/(@ep-[^.]+)/i, (endpoint) =>
    endpoint.endsWith('-pooler') ? endpoint : `${endpoint}-pooler`,
  );
}

function createDb(): Db {
  const connectionString = databaseUrl();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. On Vercel add a Neon/Postgres store from the Storage tab; locally copy .env.example to .env.local.',
    );
  }
  if (/neon\.tech|neon\.build/.test(connectionString)) {
    // HTTP fetch against the pooled host. Pool.query skips the WebSocket handshake,
    // so a serverless function does not pay to open a connection on every request.
    neonConfig.poolQueryViaFetch = true;
    if (!globalThis.WebSocket) neonConfig.webSocketConstructor = ws;
    return drizzleNeon(new Pool({ connectionString: pooledNeonUrl(connectionString) }), { schema }) as unknown as Db;
  }
  const client = postgres(connectionString, { max: 5, prepare: false });
  return drizzlePostgres(client, { schema });
}

const globalForDb = globalThis as unknown as { __db?: Db };

/** Lazy so that importing this module never throws before env vars are wired up. */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = (globalForDb.__db ??= createDb());
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export { schema };
