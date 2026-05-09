alter table ig_previews
  add column if not exists view_count integer not null default 0,
  add column if not exists cta_click_count integer not null default 0,
  add column if not exists signup_click_count integer not null default 0,
  add column if not exists signup_count integer not null default 0;

create table if not exists ig_preview_events (
  id integer generated always as identity primary key,
  preview_id uuid not null references ig_previews(id) on delete cascade,
  kind text not null,
  label text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint ig_preview_events_kind_check
    check (kind in ('view','cta_click','signup_start','signup'))
);

create index if not exists ig_preview_events_preview_idx on ig_preview_events (preview_id);
create index if not exists ig_preview_events_created_idx on ig_preview_events (created_at desc);

create or replace function increment_ig_preview_counter(
  p_preview_id uuid,
  p_kind text
) returns void
language plpgsql
as $$
begin
  if p_kind = 'view' then
    update ig_previews
       set view_count = view_count + 1, updated_at = now()
     where id = p_preview_id;
  elsif p_kind = 'cta_click' then
    update ig_previews
       set cta_click_count = cta_click_count + 1, updated_at = now()
     where id = p_preview_id;
  elsif p_kind = 'signup_start' then
    update ig_previews
       set signup_click_count = signup_click_count + 1, updated_at = now()
     where id = p_preview_id;
  elsif p_kind = 'signup' then
    update ig_previews
       set signup_count = signup_count + 1, updated_at = now()
     where id = p_preview_id;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;
end;
$$;
