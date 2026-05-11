-- Pricing v2: rename credits -> quota_units.
-- Display copy still says "photos" everywhere user-facing; the schema name
-- stays generic so a future product (video, upscale, premium model) doesn't
-- require another migration.

ALTER TABLE profiles RENAME COLUMN credits_balance TO quota_units_balance;
ALTER TABLE complete_look_packs RENAME COLUMN credits_spent TO quota_units_spent;

DROP FUNCTION IF EXISTS public.try_deduct_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.refill_credits(uuid, text, integer, timestamptz);

CREATE OR REPLACE FUNCTION public.try_consume_quota(
  p_user_id UUID,
  p_amount INT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated INT;
BEGIN
  WITH upd AS (
    UPDATE public.profiles
    SET quota_units_balance = quota_units_balance - p_amount
    WHERE id = p_user_id AND quota_units_balance >= p_amount
    RETURNING 1
  )
  SELECT count(*) INTO updated FROM upd;
  RETURN updated > 0;
END;
$$;

-- BEHAVIOR CHANGE FROM legacy refill_credits: this function REPLACES the
-- balance instead of adding to it. Pricing v2 spec is explicit: quota does
-- not roll over between billing periods. Each invoice.payment_succeeded
-- replaces the balance with the new cycle's allocation.
CREATE OR REPLACE FUNCTION public.refill_quota(
  p_user_id UUID,
  p_plan TEXT,
  p_quota INT,
  p_renews_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET
    plan = p_plan,
    quota_units_balance = p_quota,
    plan_renews_at = p_renews_at
  WHERE id = p_user_id;
END;
$$;
