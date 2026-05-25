import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generations, tryIntents, unlockBatches } from "@/lib/db/schema";
import { emailLinkBaseUrl } from "./base-url";
import { sendPhotosEmail, type PhotoForEmail } from "./send-photo";

// Email-during-generation deferred send (VES-46).
//
// The /try email-during-generation flow lets a visitor drop their email
// WHILE generation is still running. At that moment the run may not be
// finalized and not all tiles have succeeded, so we cannot send yet —
// we stash `pending_email` on the unlock_batches row (keyed by the
// client-minted token) and call flushPendingBatchEmail once
// finalize-batch commits. This is the "deferred send keyed on finalize"
// mechanism (Option 1 in VES-46): it works even after the tab closes
// because the trigger is server-side, not a client re-call.
//
// Idempotency: emailSentAt is the latch. We atomically compare-and-set
// it from NULL → now() inside a transaction; only the winning caller
// (single row updated) actually sends. Concurrent finalize retries,
// duplicate submits, or a late post-completion email-photo call all
// converge on a single email.

export type FlushResult =
  | { status: "sent"; emailId: string }
  | { status: "no_pending_email" }
  | { status: "already_sent" }
  | { status: "no_photos" }
  | { status: "provider_not_configured" }
  | { status: "send_failed"; message?: string };

/**
 * Attempt to send the watermark-free photos for a batch that has a
 * `pending_email` stashed on it. Safe to call multiple times — the
 * `email_sent_at` latch guarantees at most one email per batch.
 *
 * Resolves the batch by its token. The batch must have a linked run
 * (finalize-batch sets `runId`) so we can read the succeeded
 * generations. If the run isn't linked yet (email arrived before
 * finalize), this returns `no_photos` and the caller should retry once
 * finalize has run.
 */
export async function flushPendingBatchEmail(
  token: string,
): Promise<FlushResult> {
  // Atomic claim: flip email_sent_at NULL → now() only if there is a
  // pending_email and it hasn't been sent. The RETURNING row tells us
  // we won the race and gives us the email + runId to send against. We
  // optimistically set email_sent_at BEFORE sending so a concurrent
  // caller can't also claim it; if the send then fails we roll the
  // latch back (see below) so a later retry can pick it up.
  const claim = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(unlockBatches)
      .set({
        emailSentAt: new Date(),
        emailSendAttempts: sql`${unlockBatches.emailSendAttempts} + 1`,
      })
      .where(
        and(
          eq(unlockBatches.token, token),
          isNull(unlockBatches.emailSentAt),
        ),
      )
      .returning({
        pendingEmail: unlockBatches.pendingEmail,
        runId: unlockBatches.runId,
      });
    return row ?? null;
  });

  if (!claim) {
    // Either no row, already sent (latch set), or no race won. Decide
    // which by reading the row back.
    const [existing] = await db
      .select({
        pendingEmail: unlockBatches.pendingEmail,
        emailSentAt: unlockBatches.emailSentAt,
      })
      .from(unlockBatches)
      .where(eq(unlockBatches.token, token))
      .limit(1);
    if (!existing || !existing.pendingEmail) return { status: "no_pending_email" };
    return { status: "already_sent" };
  }

  if (!claim.pendingEmail) {
    // We claimed the latch on a batch with no pending email — undo so
    // we don't permanently block a future email submission on this batch.
    await releaseLatch(token);
    return { status: "no_pending_email" };
  }

  const photos = await loadSucceededPhotos(claim.runId);
  if (photos.length === 0) {
    // Generation hasn't produced any succeeded tiles yet (email arrived
    // before finalize, or every tile failed). Release the latch so a
    // later flush (post-finalize) can retry. Partial-failure with ≥1
    // success still sends what succeeded — we only bail on zero.
    await releaseLatch(token);
    return { status: "no_photos" };
  }

  const siteUrl = emailLinkBaseUrl();
  const sendResult = await sendPhotosEmail({
    to: claim.pendingEmail,
    photos,
    batchUrl: `${siteUrl}/try`,
  });

  if (!sendResult.ok && sendResult.reason === "no_api_key") {
    // Resend unconfigured (dev/preview without a key). Release the
    // latch so a properly-configured environment can still deliver
    // later; this is a graceful no-send, not a failure.
    await releaseLatch(token);
    return { status: "provider_not_configured" };
  }
  if (!sendResult.ok) {
    await releaseLatch(token);
    return { status: "send_failed", message: sendResult.message };
  }

  return { status: "sent", emailId: sendResult.id };
}

export type StashPendingInput = {
  token: string;
  email: string;
  /** Source URL for the try_intents conversion record. */
  sourceUrl: string;
  pickedScenes: string[];
  userId?: string | null;
};

export type StashPendingResult = { intentId: string };

/**
 * Persist a pending email submitted mid-generation. Upserts the
 * unlock_batches row keyed by the client-minted token so the email
 * survives until finalize-batch links the run, then writes the
 * try_intents conversion record (§15a). Idempotent on re-submit: a
 * second call for the same token overwrites pending_email only while
 * the batch hasn't already sent (email_sent_at IS NULL), so a duplicate
 * submit after delivery does not re-queue a second email.
 *
 * Both writes run in one transaction — no orphan intent without a
 * stashed email, and no stashed email without the ads conversion record
 * (CLAUDE.md §10).
 */
export async function stashPendingEmail(
  input: StashPendingInput,
): Promise<StashPendingResult> {
  const email = input.email.toLowerCase();
  return db.transaction(async (tx) => {
    // Upsert the batch stub. ON CONFLICT (token) updates pending_email
    // ONLY when not yet sent — a duplicate submit after delivery is a
    // no-op on the latch. `generations` is required NOT NULL; for a
    // brand-new stub we seed an empty array (finalize-batch overwrites
    // it with the real JSONB payload).
    await tx
      .insert(unlockBatches)
      .values({
        token: input.token,
        generations: [],
        userId: input.userId ?? null,
        pendingEmail: email,
      })
      .onConflictDoUpdate({
        target: unlockBatches.token,
        set: { pendingEmail: email },
        setWhere: isNull(unlockBatches.emailSentAt),
      });

    const [intent] = await tx
      .insert(tryIntents)
      .values({
        email,
        sourceUrl: input.sourceUrl,
        sourceName: "user-upload",
        sourceMimeType: "image/png",
        pickedScenes: input.pickedScenes,
      })
      .returning({ id: tryIntents.id });

    return { intentId: intent.id };
  });
}

// Read the watermark-free photos for a run. raw_url is the
// un-watermarked HD; output_url is the watermarked fallback. Mirrors
// the immediate-send path in /api/try/email-photo.
async function loadSucceededPhotos(
  runId: string | null,
): Promise<PhotoForEmail[]> {
  if (!runId) return [];
  const rows = await db
    .select({
      presetId: generations.presetId,
      rawUrl: generations.rawUrl,
      outputUrl: generations.outputUrl,
      status: generations.status,
    })
    .from(generations)
    .where(eq(generations.runId, runId));

  return rows
    .filter((r) => r.status === "succeeded")
    .map((r) => ({ presetId: r.presetId, url: r.rawUrl ?? r.outputUrl }))
    .filter((p): p is PhotoForEmail => !!p.url);
}

// Reset email_sent_at to NULL so a future flush can retry. Used when we
// claimed the latch but couldn't actually send (no photos yet, provider
// unconfigured, transient send failure). We do NOT decrement
// emailSendAttempts — it's a monotonic observability counter.
async function releaseLatch(token: string): Promise<void> {
  await db
    .update(unlockBatches)
    .set({ emailSentAt: null })
    .where(eq(unlockBatches.token, token));
}
