create or replace function public.increment_usage(p_user_id uuid, p_year_month text, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.usage_monthly (user_id, year_month, generation_count)
  values (p_user_id, p_year_month, p_delta)
  on conflict (user_id, year_month)
  do update set generation_count = public.usage_monthly.generation_count + excluded.generation_count;
end;
$$;
