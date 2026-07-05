-- Schema for Scribrrr's custom Google OAuth flow (apps/server/src/routes/auth.ts).
--
-- Note: this app does NOT use Supabase Auth. Login is a hand-rolled Google
-- OAuth exchange in Fastify, with sessions tracked by a cookie + a token
-- stored in "auth_sessions". Because of that, "users" has its own identity
-- (keyed by google_id) rather than referencing auth.users, and RLS is
-- enabled with no policies below -- there is no browser-side Supabase client
-- anywhere in this app, so the only legitimate access path is the Fastify
-- backend using the service_role key, which bypasses RLS entirely anyway.
--
-- Run once via the Supabase SQL editor, `psql`, or `supabase db push`.

create extension if not exists "pgcrypto"; -- provides gen_random_uuid()

create table "users" (
  "id" uuid primary key default gen_random_uuid(),
  "google_id" text unique not null,
  "email" text unique not null,
  "name" text,
  "picture" text,
  "created_at" timestamptz not null default now()
);

-- Replaces the in-memory auth_sessions store in auth.ts. Persisting this is
-- what makes the 7-day cookie actually mean something -- an in-memory store
-- loses every session on server restart or redeploy.
create table "auth_sessions" (
  "token" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users" ("id") on delete cascade,
  "created_at" timestamptz not null default now(),
  "expires_at" timestamptz not null default (now() + interval '7 days')
);

create table "sessions" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid references "users" ("id") on delete set null,
  "session_name" text,
  "created_at" timestamptz not null default now(),
  "ended_at" timestamptz
);

create table "speakers" (
  "id" uuid primary key default gen_random_uuid(),
  "session_id" uuid not null references "sessions" ("id") on delete cascade,
  "display_id" int not null,
  "name" text
);

create table "messages" (
  "id" uuid primary key default gen_random_uuid(),
  "session_id" uuid not null references "sessions" ("id") on delete cascade,
  "speaker_id" uuid references "speakers" ("id") on delete cascade,
  "text" text,
  "start_time_ms" integer,
  "end_time_ms" integer,
  "confidence" numeric,
  "created_at" timestamptz not null default now()
);

create table "summaries" (
  "id" uuid primary key default gen_random_uuid(),
  "session_id" uuid not null references "sessions" ("id") on delete cascade,
  "summary_type" text not null default 'recent_2min',
  "content" jsonb not null,
  "created_at" timestamptz not null default now()
);

create index on "auth_sessions" ("user_id");
create index on "sessions" ("user_id");
create unique index "speakers_session_display_idx" on "speakers" ("session_id", "display_id");
create index on "messages" ("session_id");
create index on "summaries" ("session_id");

alter table "users" enable row level security;
alter table "auth_sessions" enable row level security;
alter table "sessions" enable row level security;
alter table "speakers" enable row level security;
alter table "messages" enable row level security;
alter table "summaries" enable row level security;
