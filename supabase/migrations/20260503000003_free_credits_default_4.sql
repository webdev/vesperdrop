-- Bump the default signup credit grant from 1 → 4 so new free users can
-- run a small taste session (4 watermarked previews) before being asked
-- to upgrade. The Complete-the-look API still gates on
-- `quality === "hd" && !watermarked`, so free users physically can't
-- spin off marketplace packs no matter how many credits they have.
--
-- Existing free profiles are NOT backfilled — only new signups benefit.
alter table public.profiles
  alter column credits_balance set default 4;
