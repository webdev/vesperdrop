// Shared user-facing copy for /api/try/generate failure codes.
//
// The unauth funnel grants 3 free renders per device (all delivered as
// watermarked previews; the inline email gate unlocks the HD versions).
// `credit_limit_reached` (HTTP 402) fires when those 3 renders are spent.
// `quota_exhausted` (HTTP 402) fires for authed visitors who've burned
// through their plan's credits. Anything else is a transient generation
// failure — surface the underlying message so signal can be told from noise.
//
// "Out of free renders" is the §15a-locked headline for
// `credit_limit_reached`; do NOT reword it. Both the streaming Studio
// frame (`studio-frame.tsx`) and the post-stream DevelopGrid
// (`develop-grid.tsx`) import from here so the two views speak the same
// language (§9 — one copy source, no duplication).

export function failureHeadline(code?: string): string {
  switch (code) {
    case "credit_limit_reached":
      return "Out of free renders";
    case "quota_exhausted":
      return "Out of credits";
    default:
      return "Generation failed";
  }
}

export function failureBody(code: string | undefined, message?: string): string {
  switch (code) {
    case "credit_limit_reached":
      return "You've used your 3 free renders on this device. Sign up to keep generating.";
    case "quota_exhausted":
      return "You've used every credit on your plan. Upgrade to keep generating.";
    default:
      return message
        ? `${message}. Try a different scene or refresh to retry.`
        : "We couldn't develop this shot. Try a different scene or refresh to retry.";
  }
}
