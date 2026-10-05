// An in-memory Postgres loaded with the real migration, with small stand-ins for the
// parts Supabase provides (auth schema, roles, realtime publication).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function makeDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    create publication supabase_realtime;
  `);
  const dir = path.join(ROOT, 'supabase', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(path.join(dir, f), 'utf8'));
  return db;
}
export async function asUser(db, user, fn) {
  if (user) await db.query(`insert into auth.users (id, email) values ($1, $2) on conflict do nothing`, [user.id, user.email]);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [user ? JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' }) : '']);
  if (fn) { await db.exec('set role authenticated'); try { return await fn(); } finally { await db.exec('reset role'); } }
}
