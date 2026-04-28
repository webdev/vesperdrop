create or replace function public.try_reserve_quota(p_user_id uuid, p_delta int, p_cap int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(now(), 'YYYY-MM');
  current int;
begin
  if p_cap = 0 then
    return true;
  end if;

  insert into public.usage_monthly (user_id, year_month, generation_count)
  values (p_user_id, ym, 0)
  on conflict (user_id, year_month) do nothing;

  select generation_count into current from public.usage_monthly
    where user_id = p_user_id and year_month = ym for update;

  if current + p_delta > p_cap then
    return false;
  end if;

  update public.usage_monthly set generation_count = current + p_delta
    where user_id = p_user_id and year_month = ym;

  return true;
end;
$$;
