create or replace function public.try_take_token(
  p_user_id uuid,
  p_bucket text,
  p_capacity int,
  p_refill_per_minute int
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  now_ts timestamptz := now();
  cur_tokens int;
  cur_refilled timestamptz;
  elapsed_min numeric;
  refill int;
begin
  insert into public.rate_limits (user_id, bucket, tokens, refilled_at)
  values (p_user_id, p_bucket, p_capacity, now_ts)
  on conflict (user_id, bucket) do nothing;

  select tokens, refilled_at into cur_tokens, cur_refilled
  from public.rate_limits where user_id = p_user_id and bucket = p_bucket for update;

  elapsed_min := extract(epoch from (now_ts - cur_refilled)) / 60.0;
  refill := floor(elapsed_min * p_refill_per_minute);
  if refill > 0 then
    cur_tokens := least(p_capacity, cur_tokens + refill);
    cur_refilled := now_ts;
  end if;

  if cur_tokens <= 0 then
    update public.rate_limits set tokens = cur_tokens, refilled_at = cur_refilled
      where user_id = p_user_id and bucket = p_bucket;
    return false;
  end if;

  update public.rate_limits set tokens = cur_tokens - 1, refilled_at = cur_refilled
    where user_id = p_user_id and bucket = p_bucket;
  return true;
end;
$$;
