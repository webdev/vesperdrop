create or replace function increment_etsy_preview_counter(
  p_page_id uuid,
  p_kind text
) returns void
language plpgsql
as $$
begin
  if p_kind = 'view' then
    update etsy_preview_pages
       set view_count = view_count + 1, updated_at = now()
     where id = p_page_id;
  elsif p_kind = 'cta_click' then
    update etsy_preview_pages
       set cta_click_count = cta_click_count + 1, updated_at = now()
     where id = p_page_id;
  elsif p_kind = 'signup_start' then
    update etsy_preview_pages
       set signup_click_count = signup_click_count + 1, updated_at = now()
     where id = p_page_id;
  elsif p_kind = 'signup' then
    update etsy_preview_pages
       set signup_count = signup_count + 1, updated_at = now()
     where id = p_page_id;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;
end;
$$;
