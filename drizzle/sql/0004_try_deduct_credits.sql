create or replace function public.try_deduct_credits(
  p_user_id uuid,
  p_amount int
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  updated int;
begin
  with upd as (
    update public.profiles
    set credits_balance = credits_balance - p_amount
    where id = p_user_id and credits_balance >= p_amount
    returning 1
  )
  select count(*) into updated from upd;
  return updated > 0;
end;
$$;
