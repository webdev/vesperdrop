# Generation Progress UX — Design

**Date:** 2026-04-29
**Status:** Approved (pending user review)
**Surface:** `/try` (anonymous freemium flow). Authenticated flow inherits the same components in a follow-up.

## Goal

Make the 70-second image-generation wait feel like deliberate craft instead of a stalled spinner. Specifically:

- Reduce drop-off during the wait (target: <5% tab-aways from upload to first result, vs. an estimated current ~25%).
- Communicate that real per-photo work is happening — this is the differentiator vs. one-shot Midjourney/DALL·E waits.
- Carry no false-progress signals (no fake percent counters, no fake ETAs).

## Non-goals

- Real-time partial-image streaming. Sceneify does not stream intermediate frames; we don't fake them.
- A numeric progress percent. Indeterminate motion only.
- Authenticated/paid HD flow. Same components will be reused there in a separate spec.
- LoRA-trained per-preset references (CLAUDE.md v3 work). Not a dependency.

## High-level flow

```
upload  ─►  POST /api/try/start
              │
              ├──►  Vercel Blob put (existing logic)
              ├──►  Gemini Flash extract attributes  ─┐
              └──►  sceneify.createGeneration()       ├─►  return { jobId, attributes, preset }
                                                       ┘    (~1.5–2s total, parallel)

client  ─►  GET /api/try/jobs/[jobId]/events  (SSE)
              │
              │  every 1.5s: sceneify.getGeneration(id)
              │  emit phase events derived from elapsed time
              │  on succeeded: fetch + watermark + storeWatermarked
              │  emit done { outputUrl }
```

The current `POST /api/try/generate` route is replaced. No backwards-compat shim — `/try` is the only caller and we update it in the same change.

## Architecture

### New endpoints

#### `POST /api/try/start` — `src/app/api/try/start/route.ts`

Replaces `/api/try/generate`. Accepts the same multipart form (`file`, `sceneSlug`). Reuses the existing rate limiter and validation block from `generate/route.ts`.

In parallel, fires:

1. Blob upload (existing path).
2. `extractAttributes(buffer, mimeType)` — Gemini Flash via Gateway. Cached by sha256 of the bytes.
3. `startViaSceneify({ sourceUrl, sourceFilename, sourceMimeType, presetSlug, model: 'gpt-image-2', quality: 'medium' })` — a new wrapper in `src/lib/ai/sceneify.ts` alongside the existing `generateViaSceneify`. It performs the source upload + slug→id resolution + `createGeneration` and returns `{ jobId, sourceId }` without polling. The synchronous `generateViaSceneify` wrapper stays for any future caller that still wants the all-in-one shape.

Returns:

```ts
{
  jobId: string,            // sceneify generation id
  startedAt: number,        // unix ms, drives elapsed-time math on the client
  attributes: ExtractedAttributes | null,  // null if VLM failed/low-confidence
  preset: { slug, name, mood, palette, heroImageUrl, category }
}
```

The `sourceId` (Sceneify-side) is held server-side in a short-lived map keyed by `jobId`. We don't expose it to the client. Map entries TTL after 10 minutes.

#### `GET /api/try/jobs/[jobId]/events` — `src/app/api/try/jobs/[jobId]/events/route.ts`

Server-Sent Events stream. Looks up the `jobId` in the in-memory job store, then polls `sceneify.getGeneration(jobId)` every 1.5s. Emits typed events:

```
event: phase
data: { id: 'composing', elapsedMs: 18400, totalEstMs: 70000 }

event: tick
data: { elapsedMs: 18400 }

event: done
data: { outputUrl: 'https://…' }

event: error
data: { message: string, retryable: boolean }
```

`tick` fires every 1s for the client's caption rotator. `phase` fires only when the phase id changes. On `succeeded` from Sceneify: fetch the output, watermark, `storeWatermarked` (existing helpers), then emit `done`. On `failed`: emit `error`.

SSE chosen over polling so the `done` event lands the instant generation completes — polling adds up to 1.5s of perceived stall at the worst possible moment.

### Server modules

#### `src/lib/ai/extract-attributes.ts`

```ts
export type ExtractedAttributes = {
  garment: string;        // "linen shirt"
  color: string;          // "navy"
  material: string;       // "linen"
  cut?: string;           // "relaxed", "tailored"
  pattern?: string;       // "solid", "pinstripe"
  confidence: 'high' | 'medium' | 'low';
};

export async function extractAttributes(
  bytes: Buffer,
  mimeType: string,
): Promise<ExtractedAttributes | null>;
```

- Uses `generateObject` from AI SDK v6 against `google/gemini-2.5-flash` through the Gateway.
- Zod schema enforces shape. `confidence: 'low'` results return `null` (caller falls back to preset-only strings).
- Cached in **Vercel Runtime Cache** keyed by `sha256(bytes).slice(0, 16)`, TTL 24h, tag `vlm-extract`. Same flatlay re-uploads are free.
- Timeout 4s with 1 retry. On total failure, returns `null` — never throws into the start route.

#### `src/lib/progress/strings.ts`

The string library. Pure function module, fully testable.

```ts
type Phase = {
  id: 'reading' | 'choosing' | 'composing' | 'matching' | 'finishing';
  weight: number;             // fraction of totalEstMs
  lines: { template: string; personal: boolean }[];
};

export const PHASES: Phase[];
export function phaseAtElapsed(elapsedMs: number, totalEstMs: number): Phase['id'];
export function pickLine(phaseId, attributes, preset, history): string;
```

- `phaseAtElapsed` — cumulative weight math, capped to `finishing` once elapsed > totalEstMs.
- `pickLine` — picks a line from the current phase, prefers `personal: true` when `attributes` is non-null, never picks the most-recent line in `history` (avoids immediate repeats).
- Slot fills: `{garment}`, `{color}`, `{material}`, `{mood}`, `{palette[0]}`, `{palette[1]}`, `{presetName}`. Missing slots collapse the line gracefully (`"Reading your shirt…"` instead of `"Reading your {color} shirt…"` when color is missing) — implemented as a templating helper, not ad-hoc string replace.
- 18+ lines for v1, distributed across phases roughly proportional to phase weight.

#### `src/lib/progress/job-store.ts`

In-memory map of `jobId → { sceneifySourceId, presetSlug, createdAt }`. TTL 10 minutes. Same justification as the rate limiter — fine for MVP on Fluid Compute, swap to Redis when traffic warrants.

### Client components

#### `src/app/try/progress-screen.tsx` — new

The wait screen. Props:

```ts
{
  jobId: string;
  startedAt: number;
  userPhotoUrl: string;     // local object URL of the upload
  attributes: ExtractedAttributes | null;
  preset: { slug, name, mood, palette, heroImageUrl, category };
  onDone: (outputUrl: string) => void;
  onError: (msg: string, retryable: boolean) => void;
}
```

Layout:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ┌──────────────┐      ┌──┬──┬──┬──┬──┐           │
│   │  user photo  │      │R1│R2│R3│R4│R5│           │
│   │   ~360px     │      └──┴──┴──┴──┴──┘           │
│   └──────────────┘      (filmstrip)                  │
│                                                      │
│      "Pulling references for the linen-chair set…"   │
│                                                      │
│      ▁▁▁▂▂▂▂▃▃▃▃▃ ░░░░░░░░  (palette sweep)         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **User photo (left, ~360px square):** lightly desaturated (95% saturation), 1.5px noise overlay, slow 12s zoom from `scale(1.0)` to `scale(1.04)`. Stays mounted the full wait. CSS-only animation.
- **Filmstrip (right, 5 tiles):** Stock fallback per category (option B from brainstorm) — see `src/lib/progress/filmstrip-fallback.ts`. Each tile is 64×64. Default state: 35% opacity, grayscale 60%. When the active caption matches `personal: false` lines that mention "references" / "shots" / a palette color, a round-robin tile transitions to 100% opacity, full color, with a 2px ring in `palette[0]`, over 250ms ease-out. Hold for 1.8s, then return to default. Roughly 6 highlights across 70s.
- **Caption:** Single line, fixed 24px height (no layout shift), 350ms crossfade between lines. New line every 2.8s, driven by a client-side timer plus `tick` events from SSE. Server timer is authoritative; client uses the timer for smooth ticks between server messages.
- **Sweep bar:** 4px tall, full-width within the card. Linear gradient `palette[0] → palette[1] → palette[0]`, animated via CSS `background-position` over 8s. Pure motion-as-life — never tied to actual progress.
- **60s re-anchor:** when `elapsedMs > 60_000` and we haven't shown it yet, force the caption to `"Almost there — the high-res pass takes a beat longer."` for one cycle. Then resume normal rotation.

#### `src/lib/progress/filmstrip-fallback.ts`

```ts
export const FILMSTRIP_BY_CATEGORY: Record<string, string[]>;
```

5 stock thumbnails per category. Categories are derived from the existing `SceneifyPublicPreset.category` field — the implementation plan should enumerate the actual category set from the seeded scenes table at build time and assert one entry per category exists. Stored under `public/filmstrip/<category>/01.jpg` … `05.jpg`. ~80×80 jpegs. Removed the moment Sceneify ships `referenceImageUrls` on the public preset endpoint.

If a preset's category has no fallback set, `FILMSTRIP_BY_CATEGORY` returns the `default` bucket — five neutral lifestyle tiles. Never returns empty.

#### `src/app/try/try-flow.tsx` — modified

Replaces the existing wait/spinner branch (whatever currently sits between submit and result) with a mount of `<ProgressScreen />`. The submit handler:

1. Posts to `/api/try/start` with the file and slug.
2. On 200, swaps to the progress screen with the returned `jobId`, `attributes`, `preset`, and `startedAt`.
3. Progress screen opens an `EventSource` to `/api/try/jobs/[jobId]/events`. On `done`, calls `onDone` which routes to the existing result step. On `error`, switches to a single retry CTA.

### Hook: `src/lib/progress/use-progress.ts`

Encapsulates the EventSource wiring, reconnection with `Last-Event-ID`, and the caption-rotation timer. Returns `{ phaseId, currentLine, isHighlightingFilmstrip, status }`. Page component stays declarative.

## Data flow

```
client                         server
──────                         ──────
upload + slug ──────────────►  /api/try/start
                                  │
                                  ├─► Blob.put
                                  ├─► extractAttributes (cached)
                                  └─► sceneify.createGeneration
                               ◄── { jobId, startedAt, attributes, preset }

EventSource open ───────────►  /api/try/jobs/[jobId]/events
                                  │
                                  │  loop every 1.5s:
                                  │    gen = sceneify.getGeneration(jobId)
                                  │    emit phase (if changed)
                                  │  every 1s: emit tick
                                  │
                                  │  on gen.status === 'succeeded':
                                  │    fetch outputUrl
                                  │    applyWatermark
                                  │    storeWatermarked
                                  │    emit done
                                  │  on gen.status === 'failed':
                                  │    emit error
                               ◄── done { outputUrl }

route to result step
```

## Error handling

| Failure                              | Behavior                                                                                                |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Blob upload fails                    | `/api/try/start` returns 500. Existing error handling in try-flow takes over.                           |
| `extractAttributes` fails or low-conf| `/api/try/start` returns `attributes: null`. Strings fall back to `personal: false` variants.            |
| `sceneify.createGeneration` fails    | `/api/try/start` returns the existing `SceneifyError` shape (preserves current error UX).               |
| SSE connection drops                 | Client reconnects with `Last-Event-ID`. Server resumes phase emission from the latest sceneify status.  |
| Sceneify generation `failed`         | `error` SSE event with `retryable: true`. Screen swaps to "Try again" with retry button.                |
| Sceneify exceeds 90s                 | Client pins on `finishing` phase, picks the "running slow" line once, continues normal rotation.        |
| Watermark/storage failure post-gen   | `error` event, `retryable: false`. We log; user sees "Something went wrong, we got an alert."           |

No silent failures. Every failure path emits a typed event the client renders explicitly.

## Telemetry (PostHog)

Instrumented inline per the project rule that PostHog goes alongside feature code:

- `try_progress_started` — `{ jobId, presetSlug, hasAttributes: bool }`
- `try_progress_phase` — `{ jobId, phaseId, elapsedMs }` (sampled to first occurrence per phase per job)
- `try_progress_completed` — `{ jobId, totalMs, presetSlug }`
- `try_progress_abandoned` — `{ jobId, lastPhaseId, elapsedMs }` fired on `visibilitychange` → hidden, debounced
- `try_progress_error` — `{ jobId, message, retryable }`

These let us measure the actual goal: drop-off rate during the wait, broken down by phase.

## Testing

### Unit (Vitest)

- `extract-attributes.test.ts` — mocked Gateway response; schema validation; cache hit/miss; low-confidence returns null; timeout returns null.
- `progress/strings.test.ts` — `phaseAtElapsed` boundaries; cumulative weight math; pin-to-finishing past totalEstMs; `pickLine` slot interpolation; missing-slot graceful collapse; no-immediate-repeat cycler; `personal` preference when attributes present.

### E2E (Playwright)

- `e2e/try-progress.spec.ts`:
  1. Upload a fixture flatlay, pick a scene.
  2. Assert progress screen mounts within 3s with the user photo, 5 filmstrip tiles, and a caption.
  3. Assert the caption changes at least 3 times in 12s (no fake — drives a mocked Sceneify that takes 20s).
  4. Assert filmstrip highlight transitions occur (CSS class assertion).
  5. Assert completion swaps to the existing result component with a watermarked image.
  6. Error path: mock Sceneify returns `failed`, assert retry CTA renders.

Mocked Sceneify uses a test-only env switch: `SCENEIFY_API_URL` points at a local Next route under `e2e/fixtures/sceneify-mock` that returns a controllable progression (`pending` for N seconds, then `succeeded` with a fixture image). Same approach used by existing e2e tests — no MSW dependency.

## Files

**New:**
- `src/app/api/try/start/route.ts`
- `src/app/api/try/jobs/[jobId]/events/route.ts`
- `src/lib/ai/extract-attributes.ts`
- `src/lib/progress/strings.ts`
- `src/lib/progress/job-store.ts`
- `src/lib/progress/filmstrip-fallback.ts`
- `src/lib/progress/use-progress.ts`
- `src/app/try/progress-screen.tsx`
- `public/filmstrip/<category>/0[1-5].jpg` — stock fallback assets (5 categories × 5 tiles)
- `src/lib/ai/extract-attributes.test.ts`
- `src/lib/progress/strings.test.ts`
- `e2e/try-progress.spec.ts`

**Modified:**
- `src/app/try/try-flow.tsx` — swap the wait branch to mount `<ProgressScreen />`
- `src/lib/sceneify/types.ts` — no change expected, but verify `SceneifyGeneration.status` is consumed correctly

**Deleted:**
- `src/app/api/try/generate/route.ts` — replaced by `start` + `events` pair

## Out of scope (next iterations)

- Adding `referenceImageUrls` to `SceneifyPublicPreset` (option a) — unblocks dropping the stock filmstrip.
- Reusing `<ProgressScreen />` for the authenticated paid flow.
- Persisting attributes per upload for downstream prompt enrichment in the paid flow.
- Browser notification + tab-title flash on completion (`(✓) Verceldrop`).

## Risks

- **Gateway latency on the VLM call** could push `/api/try/start` past 2s. If real-world p95 exceeds 3s, we move the VLM call inside the SSE stream so the start route returns immediately and the first-phase strings are preset-only until VLM resolves.
- **Sceneify polling cost.** 1.5s polling × 70s = ~47 reads per generation. Fine at MVP traffic; revisit if it hits 100 concurrent.
- **In-memory `job-store`** loses entries on instance recycle. Worst case: a recycled instance returns 404 on the events endpoint; client falls back to "we lost the connection — refresh to see your result." Acceptable for MVP because Sceneify still produces the image.
