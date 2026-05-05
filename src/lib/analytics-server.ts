import "server-only";

/**
 * Server-side analytics. Sends events to GA4 via the Measurement
 * Protocol (https://developers.google.com/analytics/devguides/collection/protocol/ga4).
 * Mirrors the PostHog server pattern that came before — fire-and-forget,
 * no-op when env isn't configured, never throws to the caller.
 *
 * Required env (else this is a silent no-op):
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID  → e.g. "G-XXXXXXXXXX"
 *   GA_API_SECRET                  → server-only secret from GA admin
 *
 * client_id is the GA-required dedup key; we use the user id (or any
 * stable distinct id the caller provides). Setting `user_id` too gives
 * us cross-device attribution when the user signs in.
 */

const ENDPOINT = "https://www.google-analytics.com/mp/collect";

type CaptureArgs = {
  /** Stable per-user identifier — used as both client_id and user_id. */
  distinctId: string;
  /** Event name, must match the client-side AnalyticsEvent union. */
  event: string;
  /** Flat key/value props. GA4 limits to 25 params per event. */
  properties?: Record<string, unknown>;
};

export async function serverTrack(args: CaptureArgs): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret) return;
  try {
    const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(
      measurementId,
    )}&api_secret=${encodeURIComponent(apiSecret)}`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: args.distinctId,
        user_id: args.distinctId,
        events: [
          {
            name: args.event,
            params: sanitizeParams(args.properties ?? {}),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[analytics-server] capture failed", err);
  }
}

/**
 * GA4 only allows scalar params (string | number | boolean). Arrays /
 * objects get JSON-stringified so we don't silently drop them; numbers
 * stay numeric so GA can build numeric metrics.
 */
function sanitizeParams(
  raw: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      out[k] = JSON.stringify(v);
    }
  }
  return out;
}
