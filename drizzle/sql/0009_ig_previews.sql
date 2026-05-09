create table if not exists ig_previews (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text,
  preset_slug text not null,
  source_images jsonb not null,
  preset_slugs text[] not null,
  expected_output_count integer not null,
  notes text,
  status text not null default 'pending',
  outputs jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists ig_previews_slug_key on ig_previews (slug);
create index if not exists ig_previews_created_idx on ig_previews (created_at desc);
create index if not exists ig_previews_status_idx on ig_previews (status);

alter table ig_previews
  drop constraint if exists ig_previews_status_check;
alter table ig_previews
  add constraint ig_previews_status_check
  check (status in ('pending','queued','generating','completed','partial','failed'));
