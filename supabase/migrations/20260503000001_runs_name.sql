-- User-editable batch name. Null = use the auto-derived title (scenes used).
alter table public.runs
  add column if not exists name text;

-- Trim trailing whitespace and cap length so the UI can rely on a clean value.
alter table public.runs
  drop constraint if exists runs_name_length_chk;
alter table public.runs
  add constraint runs_name_length_chk
  check (name is null or (char_length(name) between 1 and 80));
