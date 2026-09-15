import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index';

export type Database = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

let cached: Database | undefined;

export function getDb(): Database {
  if (cached) {
    return cached;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  cached = createDb(url);
  return cached;
}
