-- Multi-shot listing packs derived from a parent generation.
-- One row per (parent generation, platform); shot rows live in generations.
CREATE TABLE IF NOT EXISTS public.complete_look_packs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  parent_generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform             TEXT NOT NULL CHECK (platform IN ('amazon','shopify','instagram','tiktok')),
  sceneify_pack_id     TEXT NOT NULL,
  shot_count           INT  NOT NULL,
  credits_spent        INT  NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','running','succeeded','partial','failed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS complete_look_packs_parent_platform_key
  ON public.complete_look_packs (parent_generation_id, platform);
CREATE INDEX IF NOT EXISTS complete_look_packs_run_idx
  ON public.complete_look_packs (run_id);
CREATE INDEX IF NOT EXISTS complete_look_packs_user_created_idx
  ON public.complete_look_packs (user_id, created_at DESC);

-- Pack shots become regular generations linked to the parent + pack.
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS parent_generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pack_id              UUID REFERENCES public.complete_look_packs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pack_role            TEXT,
  ADD COLUMN IF NOT EXISTS pack_shot_index      INT;

CREATE INDEX IF NOT EXISTS generations_pack_idx
  ON public.generations (pack_id);
CREATE INDEX IF NOT EXISTS generations_parent_idx
  ON public.generations (parent_generation_id);
