-- Scenes catalog: presentation metadata for the scene picker on /try and marketing.
-- Slug maps 1:1 to a Sceneify preset id (when wired into the real generation flow).
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  mood text not null,
  category text not null,
  palette text[] not null,
  image_url text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index scenes_display_order_idx on public.scenes (display_order);

alter table public.scenes enable row level security;

create policy "scenes_public_read" on public.scenes
  for select using (true);

insert into public.scenes (slug, name, mood, category, palette, image_url, display_order) values
  ('studio_athletic', 'Studio Athletic', 'STUDIO · SOFT STROBE', 'STUDIO',
    array['#f4f0e8','#c2a37a','#8a6f4d','#3d3025','#1b1915'],
    '/marketing/styles/studio_athletic.jpg', 1),
  ('leather_noir', 'Leather Noir', 'INTERIOR · LOW KEY TUNGSTEN', 'INTERIOR',
    array['#2a2018','#5d4632','#a87b4f','#d6b380','#1b1915'],
    '/marketing/styles/leather_noir.jpg', 2),
  ('graffiti_alley', 'Graffiti Alley', 'ALLEY · BOUNCED DAYLIGHT', 'STREET',
    array['#3a4d4a','#7e8a6e','#c2a047','#d65f3f','#1f1f1d'],
    '/marketing/styles/graffiti_alley.jpg', 3),
  ('mono_street', 'Mono Street', 'STREET · OVERCAST CONCRETE', 'STREET',
    array['#cfcdc8','#9a958d','#5e5a52','#2f2c27','#1b1915'],
    '/marketing/styles/mono_street.jpg', 4),
  ('shutter_crew', 'Shutter Crew', 'ROLLUP DOORS · MORNING SUN', 'EXTERIOR',
    array['#e8d8b6','#c79755','#6f4a2a','#392418','#0f0c08'],
    '/marketing/styles/shutter_crew.jpg', 5);
