import { put } from "@vercel/blob";
import { after } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { cookies } from "next/headers";
import { generateViaSceneify, SceneifyError } from "@/lib/ai/sceneify";
import { extractAttributes } from "@/lib/ai/extract-attributes";
import { applyWatermark } from "@/lib/watermark";
import { storeWatermarked, storeRawPreview } from "@/lib/storage";
import { encodeSse } from "@/lib/progress/sse-encoder";
import { phaseAtElapsed, type PhaseId } from "@/lib/progress/strings";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ANON_COOKIE_MAX_AGE_SECONDS,
  ANON_COOKIE_NAME,
  getOrCreateAnonCredit,
  tryConsumeAnonCredit,
} from "@/lib/db/anon-credits";
import { tryConsumeQuota } from "@/lib/db/quota";
import {
  recordTileSuccess,
  recordTileFailure,
  maybeFinalizeBatch,
  runFinalizeGrace,
} from "@/lib/db/try-batch";
import { env } from "@/lib/env";

// 32-hex client-minted batch token (`/try/b/<token>`). When present, this
// tile is persisted server-side as it completes so the batch can finalize +
// flush a mid-generation email even if the client never calls finalize-batch
// (tab-closed case — VES-53). Absent → legacy stream-only behavior.
const TOKEN_REGEX = /^[0-9a-f]{32}$/i;

export const runtime = "nodejs";
export const maxDuration = 300;

const TOTAL_EST_MS = 70_000;
const MOCK_GEN_DURATION_MS = 14_000;
const MOCK_OUTPUT_URL =
  "https://placehold.co/1024x1024/1b1915/f4f0e8.png?text=MOCK+GEN";
const MOCK_SOURCE_URL =
  "https://placehold.co/1024x1024/cccccc/333333.png?text=MOCK+SOURCE";

function jsonError(
  message: string,
  status: number,
  code?: string,
) {
  return new Response(
    JSON.stringify(code ? { error: message, code } : { error: message }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

function buildMockStream(slug: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastPhase: PhaseId | null = null;
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          closed = true;
        }
      };

      send("ready", { startedAt });
      send("source", { url: MOCK_SOURCE_URL });
      send("attributes", null);

      const tickInterval = setInterval(() => {
        if (closed) return;
        const elapsedMs = Date.now() - startedAt;
        send("tick", { elapsedMs });
        const phase = phaseAtElapsed(elapsedMs, MOCK_GEN_DURATION_MS);
        if (phase !== lastPhase) {
          lastPhase = phase;
          send("phase", { id: phase, elapsedMs, totalEstMs: MOCK_GEN_DURATION_MS });
        }
      }, 1000);

      try {
        await new Promise((r) => setTimeout(r, MOCK_GEN_DURATION_MS));
        clearInterval(tickInterval);
        send("done", { outputUrl: MOCK_OUTPUT_URL, sceneSlug: slug });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
}

export async function POST(req: Request) {
  // Unauthed generation is allowed by design — the funnel is:
  //   upload → generate (unauth, watermarked previews)
  //   → claim via inline OTP → Stripe unlock for HD
  // The download CTA is the conversion gate, not generation. Auth
  // state is resolved early so we can route to the right credit
  // ledger (per-profile quota_units vs cookie-keyed anon_credits).
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email ?? null;
  const isAuthed = Boolean(userData.user);
  const cookieStore = await cookies();
  const isMockMode = process.env.E2E_SCENEIFY_MOCK === "1";

  // Decide up-front whether this request will be served by the mock
  // branch below. The mock branch skips Sceneify entirely, so when it's
  // going to serve we also bypass the credit gate — otherwise repeat
  // dev iterations burn through the 3-credit anon allowance and start
  // returning 402 even though no real generation cost is incurred.
  const mockEnabled = process.env.VERCEL_ENV !== "production";
  const wantsMock = mockEnabled && cookieStore.get("vd_mock_gen")?.value === "1";
  const isLocalDev =
    process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV;
  const mockBypassAdmin = wantsMock && isLocalDev;
  const isAdmin = wantsMock ? isAdminEmail(userEmail) : false;
  const willServeMock = wantsMock && (isAdmin || mockBypassAdmin);

  // Credit gate — replaces the old per-IP hourly bucket which was
  // trivially defeated by VPN rotators and punished office NAT users.
  // Authed:   1 quota_unit per generation (atomic RPC).
  // Unauth:   1 anon_credit per generation, keyed on cookie+DB row.
  // Mock:     skipped entirely so devs can iterate freely.
  if (!isMockMode && !willServeMock) {
    if (isAuthed && userData.user) {
      const ok = await tryConsumeQuota(userData.user.id, 1);
      if (!ok) {
        return jsonError(
          "Out of credits. Upgrade your plan to keep generating.",
          402,
          "quota_exhausted",
        );
      }
    } else {
      const cookieAnonId = cookieStore.get(ANON_COOKIE_NAME)?.value;
      const { anonId, created } = await getOrCreateAnonCredit(cookieAnonId);
      if (created) {
        cookieStore.set(ANON_COOKIE_NAME, anonId, {
          maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });
      }
      const consumed = await tryConsumeAnonCredit(anonId);
      if (!consumed) {
        return jsonError(
          "You've used your free previews. Sign up to keep generating.",
          402,
          "credit_limit_reached",
        );
      }
    }
  }

  const form = await req.formData();
  const file = form.get("file");
  const sceneSlug = form.get("sceneSlug");
  const castingRaceField = form.get("castingRace");

  // Server-side persistence metadata (VES-53). Optional + best-effort: a
  // missing/invalid token simply falls back to the legacy stream-only path,
  // so older clients keep working. When present we persist this tile to the
  // batch keyed by `token` so a closed tab still produces a deliverable
  // batch + flushes the deferred email.
  const tokenField = form.get("token");
  const sceneNameField = form.get("sceneName");
  const isFreePreviewField = form.get("isFreePreview");
  const batchSizeField = form.get("batchSize");
  const batchToken =
    typeof tokenField === "string" && TOKEN_REGEX.test(tokenField)
      ? tokenField
      : null;
  const batchSize =
    typeof batchSizeField === "string" && /^[1-9][0-9]?$/.test(batchSizeField)
      ? Number(batchSizeField)
      : null;
  const sceneNameForPersist =
    typeof sceneNameField === "string" && sceneNameField.length > 0
      ? sceneNameField.slice(0, 200)
      : null;
  const isFreePreview = isFreePreviewField === "1";

  // Casting race is forwarded as a single FormData field, validated
  // against the sceneify vocabulary. The client picks ONE race per
  // batch (not per tile) and sends the same value on each tile's call
  // so the 3 shots in a batch render with a consistent model identity.
  // Unknown / missing values are accepted as "no casting target" rather
  // than rejected — sceneify falls back to its default sampler.
  const CASTING_RACES = [
    "white",
    "black",
    "east_asian",
    "south_asian",
    "southeast_asian",
    "latino",
    "middle_eastern",
    "mixed",
  ] as const;
  const parsed = z
    .object({
      file: z.instanceof(File),
      sceneSlug: z.string().min(1).max(100),
      castingRace: z.enum(CASTING_RACES).optional(),
    })
    .safeParse({
      file,
      sceneSlug,
      castingRace:
        typeof castingRaceField === "string" && castingRaceField.length > 0
          ? castingRaceField
          : undefined,
    });
  if (!parsed.success) return jsonError("invalid input", 400);

  const { file: photo, sceneSlug: slug, castingRace } = parsed.data;
  if (!photo.type.startsWith("image/")) return jsonError("expected an image", 400);
  if (photo.size > 40 * 1024 * 1024) return jsonError("image too large (max 40MB)", 400);

  const origin = new URL(req.url).origin;
  const key = `try-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Mock branch — cookie-gated, env-gated, decided above as
  // `willServeMock`. Skips Blob upload, VLM, Sceneify, and watermarking.
  // Streams the same ready/tick/phase cadence + a synthetic done event.
  // Disabled in production so a leaked cookie can't trigger mock there;
  // preview/staging require admin so a leaked cookie can't bypass real
  // generation costs; local `pnpm dev` drops the admin requirement so
  // any visitor — including unauth flow testers — can iterate freely.
  if (willServeMock) {
    return new Response(buildMockStream(slug), {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  }

  const bytes = Buffer.from(await photo.arrayBuffer());

  let sourceUrl: string;
  if (env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`try/${key}`, bytes, { access: "public", contentType: photo.type });
    sourceUrl = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const safeName = photo.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const filename = `${key}-${safeName}`;
    await writeFile(path.join(dir, filename), bytes);
    sourceUrl = `${origin}/uploads/${filename}`;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastPhase: PhaseId | null = null;
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          closed = true;
        }
      };

      send("ready", { startedAt });
      send("source", { url: sourceUrl });

      const tickInterval = setInterval(() => {
        if (closed) return;
        const elapsedMs = Date.now() - startedAt;
        send("tick", { elapsedMs });
        const phase = phaseAtElapsed(elapsedMs, TOTAL_EST_MS);
        if (phase !== lastPhase) {
          lastPhase = phase;
          send("phase", { id: phase, elapsedMs, totalEstMs: TOTAL_EST_MS });
        }
      }, 1000);

      const attributesPromise = extractAttributes(bytes, photo.type)
        .then((attrs) => send("attributes", attrs))
        .catch(() => send("attributes", null));

      try {
        const result = await generateViaSceneify({
          sourceUrl,
          sourceFilename: photo.name,
          sourceMimeType: photo.type,
          presetSlug: slug,
          model: "gpt-image-2",
          quality: "medium",
          callerRef: `try-${key}`,
          casting: castingRace ? { race: castingRace } : undefined,
        });

        await attributesPromise;

        const fetched = await fetch(result.outputUrl);
        if (!fetched.ok) throw new Error(`fetch generated image failed: ${fetched.status}`);
        const buf = Buffer.from(await fetched.arrayBuffer());
        const [watermarked, rawUrl] = await Promise.all([
          applyWatermark(buf, "VESPERDROP PREVIEW"),
          storeRawPreview(buf, `${key}.png`, origin),
        ]);
        const finalUrl = await storeWatermarked(watermarked, `${key}.png`, origin);

        clearInterval(tickInterval);
        // Forward focal/face data so the client can position the
        // tile image with the subject in frame. Sceneify already runs
        // face detection on every generation, so this is metadata
        // forwarding — no extra cost.
        send("done", {
          outputUrl: finalUrl,
          rawUrl,
          sceneSlug: slug,
          focalPoint: result.focalPoint ?? null,
          faceBox: result.faceBox ?? null,
        });

        // Persist this tile server-side, decoupled from the client (VES-53).
        // Scheduled via after() so it runs (and keeps the function warm on
        // Vercel) even when the visitor has closed the tab — the whole point
        // of "you can safely leave, we'll email you." When the last tile of
        // the batch settles, maybeFinalizeBatch links the run + flushes any
        // mid-generation email with zero client involvement.
        if (batchToken && batchSize) {
          after(async () => {
            try {
              const runId = await recordTileSuccess({
                token: batchToken,
                userId: userData.user?.id ?? null,
                sceneSlug: slug,
                sceneName: sceneNameForPersist ?? slug,
                isFreePreview,
                sourceUrl,
                batchSize,
                outputUrl: finalUrl,
                rawUrl,
                focalPoint: result.focalPoint ?? null,
                faceBox: result.faceBox ?? null,
              });
              const r = await maybeFinalizeBatch(batchToken, runId);
              // A success can settle the batch while an earlier retryable
              // failure is still pending its client retry — hold the flush
              // for a bounded grace, then settle regardless (VES-53).
              if (r.status === "grace") {
                await runFinalizeGrace(batchToken, runId);
              }
            } catch (err) {
              console.error("[try/generate] tile persist failed", {
                token: batchToken,
                slug,
                err,
              });
            }
          });
        }
      } catch (e) {
        clearInterval(tickInterval);
        const status = e instanceof SceneifyError ? e.status : 502;
        const message = e instanceof Error ? e.message : "generation failed";
        const retryable = status >= 500;
        console.error("[try/generate] sceneify failed", { status, message });
        send("error", { message, retryable });

        // Record the failed tile so the batch can still settle and the
        // deferred email delivers whatever succeeded, instead of hanging on
        // a tile that will never arrive (VES-53). We persist BOTH retryable
        // and terminal failures: if the tab is closed there is no client to
        // retry, so a retryable failure would otherwise leave the batch one
        // tile short of expected_tiles forever. The (run, preset) upsert is
        // CASE-guarded — a client retry that later succeeds overwrites the
        // failed row, and re-running maybeFinalizeBatch is a no-op once the
        // email latch is claimed, so this can't double-send.
        if (batchToken && batchSize) {
          after(async () => {
            try {
              const runId = await recordTileFailure({
                token: batchToken,
                userId: userData.user?.id ?? null,
                sceneSlug: slug,
                sceneName: sceneNameForPersist ?? slug,
                isFreePreview,
                sourceUrl,
                batchSize,
                error: message,
                retryable,
              });
              const r = await maybeFinalizeBatch(batchToken, runId);
              // If this retryable failure settled the batch, hold the flush
              // for a bounded grace so the client's auto-retry can land a
              // success before we email the succeeded subset. The grace
              // still settles on tab-close — there's no client to retry, so
              // the re-check just emails whatever succeeded (VES-53).
              if (r.status === "grace") {
                await runFinalizeGrace(batchToken, runId);
              }
            } catch (err) {
              console.error("[try/generate] tile failure persist failed", {
                token: batchToken,
                slug,
                err,
              });
            }
          });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
