-- profiles: 1:1 with auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_renews_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_count int not null,
  preset_count int not null,
  total_images int not null,
  created_at timestamptz not null default now()
);
create index runs_user_created_idx on public.runs (user_id, created_at desc);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sceneify_source_id text not null,
  sceneify_generation_id text,
  preset_id text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  output_url text,
  watermarked boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generations_run_idx on public.generations (run_id);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_status_idx on public.generations (status);

create table public.usage_monthly (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year_month text not null,
  generation_count int not null default 0,
  primary key (user_id, year_month)
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null,
  tokens int not null,
  refilled_at timestamptz not null,
  primary key (user_id, bucket)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.generations enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.rate_limits enable row level security;
-- stripe_events is service-role only; no policies, RLS off.

create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "runs_self" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "generations_self" on public.generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "usage_self_read" on public.usage_monthly
  for select using (auth.uid() = user_id);

create policy "rate_limits_self_read" on public.rate_limits
  for select using (auth.uid() = user_id);

-- Trigger: create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
