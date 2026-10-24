-- yah. sign-up list: a new, separate table. Nothing existing is touched.
-- Run once in Supabase: SQL Editor → New query → paste → Run.

create table if not exists public.yah_signups (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  school      text check (char_length(school) <= 120),
  grad_year   smallint check (grad_year between 1990 and 2100),
  interests   text[] not null default '{}' check (cardinality(interests) <= 10),
  source      text check (char_length(source) <= 255)
);

-- One sign-up per email (case-insensitive). Duplicates return HTTP 409,
-- which the site treats as "you're already on the list".
create unique index if not exists yah_signups_email_key
  on public.yah_signups (lower(email));

-- Row-level security: the public site may insert, but nobody can read,
-- change or delete rows with the publishable key. View sign-ups in the
-- Supabase dashboard (Table Editor) or with the service-role key.
alter table public.yah_signups enable row level security;

drop policy if exists "Public can sign up" on public.yah_signups;
create policy "Public can sign up"
  on public.yah_signups
  for insert
  to anon
  with check (true);

revoke all on public.yah_signups from anon, authenticated;
grant insert (name, email, school, grad_year, interests, source)
  on public.yah_signups to anon;
