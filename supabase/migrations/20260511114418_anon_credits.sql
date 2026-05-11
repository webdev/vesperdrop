-- Anon credit ledger for the unauth /try/generate path. Replaces the
-- per-IP rate-limit bucket (which was trivially defeated by VPN
-- rotators and punished office NAT users). Each anon visitor gets
-- N credits keyed on a per-cookie anon_id; each generation
-- decrements one. Persisting server-side means a tampered cookie
-- can't reset the allowance. Cookie clear = fresh row = same
-- weakness as cookie-only, but the goal is anti-abuse for casual /
-- scripted spam, not bulletproof protection.

CREATE TABLE anon_credits (
  anon_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credits_remaining int NOT NULL DEFAULT 3,
  -- Optional fingerprint hash (e.g. SHA256 of UA + IP) so we can
  -- detect cookie-cleared abuse later. Nullable for now since the
  -- /try route doesn't compute one yet.
  fingerprint_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Refreshed on each successful decrement so a future cleanup job
  -- can reap rows that have been idle for 30+ days.
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX anon_credits_fingerprint_idx
  ON anon_credits (fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;

CREATE INDEX anon_credits_last_used_idx
  ON anon_credits (last_used_at);

-- Atomic decrement. Returns true if a credit was consumed, false if
-- the row is at zero. Mirrors try_consume_quota's contract so the
-- call sites stay symmetric.
CREATE OR REPLACE FUNCTION public.try_consume_anon_credit(
  p_anon_id uuid
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated INT;
BEGIN
  WITH upd AS (
    UPDATE public.anon_credits
    SET credits_remaining = credits_remaining - 1,
        last_used_at = now()
    WHERE anon_id = p_anon_id AND credits_remaining >= 1
    RETURNING 1
  )
  SELECT count(*) INTO updated FROM upd;
  RETURN updated > 0;
END;
$$;
