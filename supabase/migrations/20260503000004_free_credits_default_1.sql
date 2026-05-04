-- Reverts 20260503000003: free signup grant back to 1 credit. Decided
-- against the wider taste session — 4 free generations is too much
-- Sceneify cost per signup. Existing free users keep whatever balance
-- they currently have (no backfill).
alter table public.profiles
  alter column credits_balance set default 1;
