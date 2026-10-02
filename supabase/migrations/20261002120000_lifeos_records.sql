-- ─────────────────────────────────────────────────────────────────────────────
-- LifeOS – Cloud-Synchronisierung
--
-- Eine Tabelle für alle synchronisierten Einträge (Einstellungen, Routinen, Termine,
-- Aufgaben, Ziele, Tageszustände, Urlaub, Fächer, Stundenplan, Hausaufgaben, Tests …).
-- Jede Zeile = ein Eintrag als JSON. Neue App-Bereiche brauchen keine neue Tabelle.
--
-- Sicherheit: Row Level Security – jede Person sieht und ändert ausschließlich eigene Zeilen.
-- Anonyme Zugriffe sind komplett gesperrt.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.lifeos_records (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection        text        not null check (char_length(collection) between 1 and 64),
  id                text        not null check (char_length(id) between 1 and 200),
  data              jsonb,
  deleted           boolean     not null default false,
  -- Zeitpunkt der Änderung auf dem Gerät: entscheidet bei Konflikten (neuer gewinnt).
  updated_at        timestamptz not null,
  -- Vom Server gesetzt: Cursor für "alles seit dem letzten Abgleich".
  server_updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists lifeos_records_user_cursor_idx
  on public.lifeos_records (user_id, server_updated_at);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.lifeos_records enable row level security;

drop policy if exists "lifeos: eigene Einträge lesen" on public.lifeos_records;
create policy "lifeos: eigene Einträge lesen" on public.lifeos_records
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "lifeos: eigene Einträge anlegen" on public.lifeos_records;
create policy "lifeos: eigene Einträge anlegen" on public.lifeos_records
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "lifeos: eigene Einträge ändern" on public.lifeos_records;
create policy "lifeos: eigene Einträge ändern" on public.lifeos_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "lifeos: eigene Einträge löschen" on public.lifeos_records;
create policy "lifeos: eigene Einträge löschen" on public.lifeos_records
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Nur angemeldete Nutzer dürfen überhaupt auf die Tabelle zugreifen.
revoke all on public.lifeos_records from anon;
grant select, insert, update, delete on public.lifeos_records to authenticated;

-- ── Konflikte: Last-Write-Wins auch auf dem Server ──────────────────────────
-- Ein älterer Stand (z. B. von einem lange offline gewesenen Gerät) überschreibt nie einen neueren.
create or replace function public.lifeos_records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- ältere Änderung verwerfen
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists lifeos_records_before_write on public.lifeos_records;
create trigger lifeos_records_before_write
  before insert or update on public.lifeos_records
  for each row execute function public.lifeos_records_before_write();
