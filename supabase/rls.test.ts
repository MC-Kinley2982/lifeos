import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prüft die Supabase-Migration mit einer echten Postgres-Engine (PGlite):
 * Row Level Security, gesperrter anonymer Zugriff und Last-Write-Wins-Trigger.
 * Supabase-spezifische Teile (auth.users, auth.uid(), Rollen) werden minimal nachgebildet.
 */
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec('reset role;');
  if (user) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  } else {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  const migration = readFileSync(new URL('./migrations/20261002120000_lifeos_records.sql', import.meta.url), 'utf8');
  await db.exec(migration);
});

afterAll(async () => {
  await db.close();
});

describe('Supabase-Migration (RLS)', () => {
  it('Nutzer A kann eigene Einträge anlegen und lesen (user_id kommt aus der Anmeldung)', async () => {
    await as(A, `insert into public.lifeos_records (collection, id, data, updated_at) values ('homework', 'hw1', '{"title":"Mathe"}', now())`);
    const rows = await as(A, `select user_id, id from public.lifeos_records`);
    expect(rows.rows).toEqual([{ user_id: A, id: 'hw1' }]);
  });

  it('Nutzer B sieht und ändert die Einträge von A nicht', async () => {
    expect((await as(B, `select * from public.lifeos_records`)).rows).toHaveLength(0);
    const upd = await as(B, `update public.lifeos_records set data = '{"title":"gehackt"}' where id = 'hw1'`);
    expect(upd.affectedRows).toBe(0);
    const del = await as(B, `delete from public.lifeos_records where id = 'hw1'`);
    expect(del.affectedRows).toBe(0);
    await expect(as(B, `insert into public.lifeos_records (user_id, collection, id, data, updated_at) values ('${A}', 'homework', 'fake', '{}', now())`)).rejects.toThrow(
      /row-level security/i,
    );
  });

  it('anonyme Zugriffe sind gesperrt', async () => {
    await expect(as(null, `select * from public.lifeos_records`)).rejects.toThrow(/permission denied/i);
  });

  it('ältere Stände überschreiben neuere nicht (Last-Write-Wins)', async () => {
    const t1 = '2026-10-02T10:00:00Z';
    const t0 = '2026-10-02T09:00:00Z';
    const t2 = '2026-10-02T11:00:00Z';
    const upsert = (title: string, t: string) =>
      as(
        A,
        `insert into public.lifeos_records (collection, id, data, updated_at) values ('tasks', 't1', $1, $2)
         on conflict (user_id, collection, id) do update set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at`,
        [JSON.stringify({ title }), t],
      );
    await upsert('neu', t1);
    const before = (await as(A, `select server_updated_at from public.lifeos_records where id = 't1'`)).rows[0] as { server_updated_at: Date };
    await upsert('alt', t0);
    const stale = (await as(A, `select data, server_updated_at from public.lifeos_records where id = 't1'`)).rows[0] as { data: { title: string }; server_updated_at: Date };
    expect(stale.data.title).toBe('neu');
    expect(stale.server_updated_at.getTime()).toBe(before.server_updated_at.getTime());
    await upsert('neuer', t2);
    const fresh = (await as(A, `select data from public.lifeos_records where id = 't1'`)).rows[0] as { data: { title: string } };
    expect(fresh.data.title).toBe('neuer');
  });

  it('Konto löschen entfernt alle Einträge (on delete cascade)', async () => {
    await db.exec(`delete from auth.users where id = '${A}'`);
    expect((await db.query(`select * from public.lifeos_records where user_id = '${A}'`)).rows).toHaveLength(0);
  });
});
