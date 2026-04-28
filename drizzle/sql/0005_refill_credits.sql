create or replace function public.refill_credits(
  p_user_id uuid,
  p_plan text,
  p_credits int,
  p_renews_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set
    plan = p_plan,
    credits_balance = credits_balance + p_credits,
    plan_renews_at = p_renews_at
  where id = p_user_id;
end;
$$;
