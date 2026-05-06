alter table etsy_candidates
  add constraint etsy_candidates_status_check
  check (status in ('pending','generating','completed','partial','failed','skipped','to_review'));

alter table etsy_preview_pages
  add constraint etsy_preview_pages_status_check
  check (status in ('pending','generating','partial','completed','failed'));

alter table etsy_preview_events
  add constraint etsy_preview_events_kind_check
  check (kind in ('view','cta_click','signup_start','signup'));
