export type EtsyPreviewEventParams = {
  preview_token: string;
  candidate_id: string;
  seller_name: string | null;
  listing_url: string;
  source: "etsy_outreach";
};

export const ETSY_EVENT_NAMES = {
  preview_view: "etsy_preview_view",
  preview_cta_click: "etsy_preview_cta_click",
  preview_signup_start: "etsy_preview_signup_start",
  admin_generation_submitted: "etsy_admin_generation_submitted",
  admin_generation_completed: "etsy_admin_generation_completed",
  admin_copy_preview_link: "etsy_admin_copy_preview_link",
} as const;
