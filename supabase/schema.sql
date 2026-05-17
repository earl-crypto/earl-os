-- ─── Earl OS · Database Schema ───────────────────────────────────────────────
-- Run this entire file in Supabase → SQL Editor → New Query → Run

-- ── Profiles (one row per user) ──────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text    not null default 'Earl Neal',
  title       text    not null default 'Founder · Tour Production Manager',
  status      text    not null default 'available',
  event       text    not null default '',
  venue       text    not null default '',
  updated_at  timestamptz default now()
);

-- ── Show dates ────────────────────────────────────────────────────────────────
create table if not exists public.show_dates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  venue       text,
  city        text,
  is_outdoor  boolean default false,
  created_at  timestamptz default now(),
  unique (user_id, date)
);

-- ── Task templates (the repeating master list) ────────────────────────────────
create table if not exists public.task_templates (
  id          text primary key,              -- local nanoid preserved from app
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null,                 -- 'office' | 'show:pre' | 'show:day' | 'show:post'
  text        text not null,
  ord         integer not null default 0,
  created_at  timestamptz default now()
);

-- ── Task state (checked/unchecked per day) ────────────────────────────────────
create table if not exists public.task_state (
  user_id     uuid not null references auth.users on delete cascade,
  template_id text not null references public.task_templates on delete cascade,
  scope_date  date not null,
  done        boolean not null default false,
  primary key (user_id, template_id, scope_date)
);

-- ── One-off tasks ─────────────────────────────────────────────────────────────
create table if not exists public.tasks_oneoff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  text        text not null,
  done        boolean not null default false,
  ord         integer not null default 0,
  created_at  timestamptz default now()
);

-- ── Personal journal (one row per calendar day) ───────────────────────────────
create table if not exists public.journal_personal (
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  mood        integer not null default 3,
  energy      integer not null default 3,
  grateful    text not null default '',
  win         text not null default '',
  reflection  text not null default '',
  updated_at  timestamptz default now(),
  primary key (user_id, date)
);

-- ── Show journal (one row per show date) ──────────────────────────────────────
create table if not exists public.journal_show (
  user_id           uuid not null references auth.users on delete cascade,
  show_date         date not null,
  venue             text not null default '',
  crew_call         text not null default '',
  t_load_in         text not null default '',
  soundcheck        text not null default '',
  doors             text not null default '',
  show_time         text not null default '',
  curfew            text not null default '',
  attendance_cap    text not null default '',
  attendance_actual text not null default '',
  arrival           text not null default '',
  parking           text not null default '',
  load_in           text not null default '',
  meals             text not null default '',
  show              text not null default '',
  load_out          text not null default '',
  depart            text not null default '',
  general           text not null default '',
  updated_at        timestamptz default now(),
  primary key (user_id, show_date)
);

-- ── Quick notes ───────────────────────────────────────────────────────────────
create table if not exists public.notes (
  user_id     uuid primary key references auth.users on delete cascade,
  text        text not null default '',
  updated_at  timestamptz default now()
);

-- ── App settings (tweaks, mode, closed windows) ───────────────────────────────
create table if not exists public.settings (
  user_id        uuid primary key references auth.users on delete cascade,
  tweaks         jsonb not null default '{}',
  show_day       boolean not null default false,
  closed_windows jsonb not null default '{}',
  updated_at     timestamptz default now()
);

-- ── News cache (populated by edge function later) ─────────────────────────────
create table if not exists public.news_cache (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  category     text not null,
  title        text not null,
  url          text unique,
  published_at timestamptz,
  hot          boolean default false,
  created_at   timestamptz default now()
);

-- ── Weather cache (populated by edge function later) ──────────────────────────
create table if not exists public.weather_cache (
  location     text primary key,
  forecast     jsonb,
  fetched_at   timestamptz default now()
);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.show_dates      enable row level security;
alter table public.task_templates  enable row level security;
alter table public.task_state      enable row level security;
alter table public.tasks_oneoff    enable row level security;
alter table public.journal_personal enable row level security;
alter table public.journal_show    enable row level security;
alter table public.notes           enable row level security;
alter table public.settings        enable row level security;

-- Each user can only touch their own rows
create policy "own profile"    on public.profiles        for all using (auth.uid() = id);
create policy "own show_dates" on public.show_dates      for all using (auth.uid() = user_id);
create policy "own templates"  on public.task_templates  for all using (auth.uid() = user_id);
create policy "own task_state" on public.task_state      for all using (auth.uid() = user_id);
create policy "own oneoff"     on public.tasks_oneoff    for all using (auth.uid() = user_id);
create policy "own j_personal" on public.journal_personal for all using (auth.uid() = user_id);
alter table public.journal_personal enable row level security;
create policy "own j_show"     on public.journal_show    for all using (auth.uid() = user_id);
create policy "own notes"      on public.notes           for all using (auth.uid() = user_id);
create policy "own settings"   on public.settings        for all using (auth.uid() = user_id);

-- News + weather readable by any signed-in user (populated server-side)
alter table public.news_cache    enable row level security;
alter table public.weather_cache enable row level security;
create policy "read news"    on public.news_cache    for select using (auth.role() = 'authenticated');
create policy "read weather" on public.weather_cache for select using (auth.role() = 'authenticated');

-- ─── Auto-create profile on first sign-in ─────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.notes    (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Realtime (run once to enable live push to connected clients) ─────────────
alter publication supabase_realtime add table public.task_templates;
alter publication supabase_realtime add table public.task_state;
alter publication supabase_realtime add table public.tasks_oneoff;
alter publication supabase_realtime add table public.journal_personal;
alter publication supabase_realtime add table public.journal_show;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.show_dates;
