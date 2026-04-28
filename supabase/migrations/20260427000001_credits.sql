-- Expand plan check to include all tiers
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'studio', 'agency'));

-- Add credits_balance (new free users get 1 HD credit on sign-up)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_balance INT NOT NULL DEFAULT 1;

-- Add model_used and quality to generations
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS model_used TEXT;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT 'hd'
  CHECK (quality IN ('preview', 'hd'));

-- Atomically deduct credits (returns false if insufficient)
CREATE OR REPLACE FUNCTION public.try_deduct_credits(
  p_user_id UUID,
  p_amount INT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated INT;
BEGIN
  WITH upd AS (
    UPDATE public.profiles
    SET credits_balance = credits_balance - p_amount
    WHERE id = p_user_id AND credits_balance >= p_amount
    RETURNING 1
  )
  SELECT count(*) INTO updated FROM upd;
  RETURN updated > 0;
END;
$$;

-- Refill credits when subscription is activated or renewed
CREATE OR REPLACE FUNCTION public.refill_credits(
  p_user_id UUID,
  p_plan TEXT,
  p_credits INT,
  p_renews_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET
    plan = p_plan,
    credits_balance = credits_balance + p_credits,
    plan_renews_at = p_renews_at
  WHERE id = p_user_id;
END;
$$;
