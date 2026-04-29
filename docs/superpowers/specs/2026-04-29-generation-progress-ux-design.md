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
upload  ─►  POST /api/try/generate  (streaming response, SSE-formatted)
              │
              │   Phase 1 (sync, ~1.5–2s):
              │     ├─► Vercel Blob put
              │     └─► flush  event: ready  data: { startedAt, attributes, preset }
              │
              │   Phase 2 (parallel, ~70s):
              │     ├─► extractAttributes()  (Gemini Flash via Gateway)  ──┐
              │     │   when it lands → flush  event: attributes  data: {…}│
              │     │                                                       │
              │     └─► generateViaSceneify()                               │
              │         while running → tick/phase events on a timer       │
              │         on resolve → fetch, applyWatermark, storeWatermarked│
              │         flush  event: done  data: { outputUrl }            ─┘
              │
              │   On any error → flush  event: error  data: {…}; close stream
```

The route returns a `ReadableStream` body with `Content-Type: text/event-stream`. The client reads it with `fetch` + a small SSE-from-stream parser (no `EventSource`, since that's GET-only). Everything runs in a single execution context — no cross-instance handoff, no job-store, no client reconnection logic.

The current `POST /api/try/generate` route is rewritten in place. No backwards-compat shim — `/try` is the only caller and we update it in the same change.

## Architecture

### Endpoint

#### `POST /api/try/generate` — `src/app/api/try/generate/route.ts` (rewritten)

Accepts the same multipart form (`file`, `sceneSlug`). Reuses the existing rate limiter and validation block. Returns a streaming response.

**Stream lifecycle:**

1. Validate input + rate limit. On failure, return non-streaming JSON error (existing behavior).
2. Upload to Blob (existing path) → `sourceUrl`.
3. Open `ReadableStream` with `text/event-stream` headers. From this point, all errors flow through the stream rather than HTTP status.
4. Emit `ready` with `{ startedAt, preset }`. The `startedAt` (unix ms) drives elapsed-time math on the client.
5. Kick off two awaitables in parallel:
   - `extractAttributes(bytes, mimeType)` — when it resolves, emit `attributes` event with the result (or `null` if low-confidence/failed). The client can swap from preset-only strings to personal strings mid-wait.
   - `generateViaSceneify({...})` — the existing OIDC-authed sync wrapper.
6. While `generateViaSceneify` is in flight, a setInterval emits:
   - `tick` event every 1s with `{ elapsedMs }` for the caption rotator.
   - `phase` event each time the elapsed-time-derived phase id changes.
7. On `generateViaSceneify` resolve: fetch `outputUrl`, `applyWatermark`, `storeWatermarked` (existing helpers), then emit `done` with the watermarked URL.
8. On any thrown error: emit `error` with `{ message, retryable }`. SceneifyError preserves its `detail`.
9. Close the stream.

**Event format (SSE-shaped, raw bytes):**

```
event: ready
data: {"startedAt":1714435200000,"preset":{"slug":"linen-chair","name":"Linen Chair","mood":"calm","palette":["#d8c9b8","#735e4b"],"heroImageUrl":"...","category":"lifestyle-flat"}}

event: attributes
data: {"garment":"linen shirt","color":"navy","material":"linen","confidence":"high"}

event: tick
data: {"elapsedMs":18400}

event: phase
data: {"id":"composing","elapsedMs":18400,"totalEstMs":70000}

event: done
data: {"outputUrl":"https://blob.vercel-storage.com/.../watermarked.png"}

event: error
data: {"message":"sceneify 502","retryable":true}
```

Each event is two lines (`event:` + `data:`) followed by a blank line. Standard SSE framing.

**Response headers:**

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` prevents any intermediate proxy from buffering. `runtime = 'nodejs'` and `maxDuration = 300` (existing).

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
- Timeout 4s with 1 retry. On total failure, returns `null` — never throws into the streaming route.

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

#### `src/lib/progress/sse-encoder.ts`

Pure helper that turns `(eventName, data)` into the SSE-framed bytes (`event: …\ndata: …\n\n`). Used by the streaming route for every emit. Trivial but extracted so it's testable and so the route logic stays readable.

### Client components

#### `src/app/try/progress-screen.tsx` — new

The wait screen. Mounts as soon as the user submits — it owns the streaming `fetch` to `/api/try/generate` for its lifetime. Props:

```ts
{
  file: File;                  // the upload
  sceneSlug: string;
  userPhotoUrl: string;        // local object URL for instant display
  onDone: (outputUrl: string) => void;
  onError: (msg: string, retryable: boolean) => void;
}
```

The `startedAt`, `preset`, and `attributes` come in over the stream as the `ready` and `attributes` events. Until `ready` arrives (~1.5–2s), the screen shows a brief skeleton with the user photo only.

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

Replaces the existing wait/spinner branch with a mount of `<ProgressScreen />`. The submit handler stops calling `/api/try/generate` directly — it just hands the `file` and `sceneSlug` to `<ProgressScreen />`, which owns the streaming request from there. On `onDone(outputUrl)` the flow advances to the existing result step. On `onError` it switches to a single retry CTA that remounts `<ProgressScreen />` with the same inputs.

### Hook: `src/lib/progress/use-progress.ts`

Encapsulates the streaming `fetch`, the SSE-from-stream parser, and the caption-rotation timer. Input: `{ file, sceneSlug }`. Returns `{ status, preset, attributes, phaseId, currentLine, isHighlightingFilmstrip, outputUrl, error }`. The page component stays declarative.

The SSE parser is ~30 lines: read from `response.body.getReader()`, accumulate text, split on `\n\n`, parse each frame's `event:` and `data:` lines, dispatch to a callback. No external dependency.

## Data flow

```
client                                      server
──────                                      ──────
upload + slug  ──fetch POST stream──►  /api/try/generate
                                            │
                                            │  validate + rate-limit
                                            │  Blob.put → sourceUrl
                                            │
                                            │ ◄── flush ready { startedAt, preset }
                                            │
                                            │  Promise.all:
                                            │   ├─ extractAttributes()
                                            │   │   on resolve: ◄── flush attributes {…}
                                            │   └─ generateViaSceneify()
                                            │       (in flight)
                                            │
                                            │  setInterval 1s:
                                            │   ◄── flush tick { elapsedMs }
                                            │   if phase changed:
                                            │     ◄── flush phase {…}
                                            │
                                            │  on generateViaSceneify resolve:
                                            │     fetch outputUrl
                                            │     applyWatermark
                                            │     storeWatermarked
                                            │   ◄── flush done { outputUrl }
                                            │     close stream
                                            │
                                            │  on any throw:
                                            │   ◄── flush error { message, retryable }
                                            │     close stream
```

Single execution context, single open connection. No cross-instance state, no reconnection logic.

## Error handling

| Failure                              | Behavior                                                                                                |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Validation / rate limit              | Non-streaming JSON error with the existing status codes (400, 429). Stream never opens.                 |
| Blob upload fails                    | Non-streaming 500 (this happens before the stream opens).                                               |
| `extractAttributes` fails or low-conf| `attributes` event emits `null`. Strings fall back to `personal: false` variants. Stream continues.      |
| `generateViaSceneify` throws         | `error` event with the SceneifyError `message` + `retryable: true` for 5xx, `false` for 4xx. Close.     |
| Stream connection drops mid-flight   | Client surfaces a generic "connection lost" error with a retry CTA. We do not attempt to resume — the   |
|                                      | retry remounts `<ProgressScreen />` and reposts the file.                                               |
| Sceneify exceeds 90s                 | Client pins on `finishing` phase, picks the "running slow" line once, continues normal rotation.        |
| Watermark/storage failure post-gen   | `error` event, `retryable: false`. Log + alert. User sees "Something went wrong on our end."            |

No silent failures. Every failure path emits a typed event the client renders explicitly.

## Telemetry (PostHog)

Instrumented inline per the project rule that PostHog goes alongside feature code:

A `clientJobId` is generated on the client (UUID v4) the moment `<ProgressScreen />` mounts, used purely as a correlation key for telemetry — it is not persisted server-side.

- `try_progress_started` — `{ clientJobId, presetSlug }`
- `try_progress_attributes` — `{ clientJobId, hasAttributes: bool }` (fired when the `attributes` event arrives)
- `try_progress_phase` — `{ clientJobId, phaseId, elapsedMs }` (sampled to first occurrence per phase per job)
- `try_progress_completed` — `{ clientJobId, totalMs, presetSlug }`
- `try_progress_abandoned` — `{ clientJobId, lastPhaseId, elapsedMs }` fired on `visibilitychange` → hidden, debounced
- `try_progress_error` — `{ clientJobId, message, retryable }`

These let us measure the actual goal: drop-off rate during the wait, broken down by phase.

## Testing

### Unit (Vitest)

- `extract-attributes.test.ts` — mocked Gateway response; schema validation; cache hit/miss; low-confidence returns null; timeout returns null.
- `progress/strings.test.ts` — `phaseAtElapsed` boundaries; cumulative weight math; pin-to-finishing past totalEstMs; `pickLine` slot interpolation; missing-slot graceful collapse; no-immediate-repeat cycler; `personal` preference when attributes present.
- `progress/sse-encoder.test.ts` — encodes `(event, data)` to the exact byte sequence with proper newlines; handles JSON-serializable payloads; rejects payloads with embedded `\n\n`.
- `progress/sse-parser.test.ts` (client-side parser exported from `use-progress`) — chunks split mid-frame; multi-byte UTF-8 split across chunks; multiple events in one chunk; empty data lines.

### E2E (Playwright)

- `e2e/try-progress.spec.ts`:
  1. Upload a fixture flatlay, pick a scene.
  2. Assert progress screen mounts within 1s with the user photo (preset/filmstrip may not be visible yet).
  3. Assert filmstrip and caption appear within 3s once the `ready` event lands.
  4. Assert the caption changes at least 3 times in 12s (mocked Sceneify takes 20s in this test).
  5. Assert filmstrip highlight transitions occur (CSS class assertion).
  6. Assert completion swaps to the existing result component with a watermarked image.
  7. Error path: mock Sceneify throws 502, assert retry CTA renders.

Mocked Sceneify uses a test-only env switch: `SCENEIFY_API_URL` points at a local Next route under `e2e/fixtures/sceneify-mock` that returns a controllable single-shot response (delay N ms, then 200 with a fixture image URL, or 502 for the error case). Same approach used by existing e2e tests — no MSW dependency.

## Files

**New:**
- `src/lib/ai/extract-attributes.ts`
- `src/lib/ai/extract-attributes.test.ts`
- `src/lib/progress/strings.ts`
- `src/lib/progress/strings.test.ts`
- `src/lib/progress/sse-encoder.ts`
- `src/lib/progress/sse-encoder.test.ts`
- `src/lib/progress/sse-parser.ts` (client-side; consumed by `use-progress`)
- `src/lib/progress/sse-parser.test.ts`
- `src/lib/progress/filmstrip-fallback.ts`
- `src/lib/progress/use-progress.ts`
- `src/app/try/progress-screen.tsx`
- `public/filmstrip/<category>/0[1-5].jpg` — stock fallback assets (categories enumerated from seeded scenes)
- `e2e/fixtures/sceneify-mock/route.ts` — controllable mock for e2e
- `e2e/try-progress.spec.ts`

**Modified:**
- `src/app/api/try/generate/route.ts` — rewritten as a streaming response
- `src/app/try/try-flow.tsx` — swap the wait branch to mount `<ProgressScreen />`

## Out of scope (next iterations)

- Adding `referenceImageUrls` to `SceneifyPublicPreset` (option a) — unblocks dropping the stock filmstrip.
- Reusing `<ProgressScreen />` for the authenticated paid flow.
- Persisting attributes per upload for downstream prompt enrichment in the paid flow.
- Browser notification + tab-title flash on completion (`(✓) Verceldrop`).

## Risks

- **Gateway latency on the VLM call.** Already handled by streaming — the `attributes` event arrives whenever Gemini responds, and strings degrade gracefully to preset-only until then.
- **Long-lived stream cost on Fluid Compute.** 70s of an open SSE response is fine on Vercel — `maxDuration` is already 300s on this route — but the function is held open the whole time. Active CPU is near zero between events, so cost stays close to a single sync invocation.
- **No SSE reconnect.** If the client's network drops mid-flight we surface a retry CTA rather than trying to resume. A resume protocol would require a server-side job store, which the streaming design specifically eliminates. Tradeoff accepted.
