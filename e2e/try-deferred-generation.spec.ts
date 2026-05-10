import { test, expect, type APIRequestContext } from "@playwright/test";
import path from "node:path";

// End-to-end test for the "freemium funnel" flow:
//   1. Anyone can upload + generate without an account (watermarked previews).
//   2. The conversion gate appears at download time, not generation.
//   3. Sign-up sends an email confirmation; the link routes to /app/library.
//   4. /app/library's claim-handler reads vd_pending_batch from localStorage,
//      POSTs to /api/try/claim, and the library shows the claimed batch.
//
// Each assertion below corresponds to an intent-revealing point in the funnel
// — the test serves as both regression coverage AND living documentation of
// what the gate boundaries are. If the gate moves (e.g. generation becomes
// auth-gated again), the failing assertion tells you which step regressed.
//
// Requirements to run (all local):
//   pnpm db:start      # Supabase + Mailpit + Postgres
//   pnpm db:migrate    # apply migrations including try_intents
//   pnpm exec playwright test e2e/try-deferred-generation.spec.ts
//   (playwright.config.ts spawns a dev server on :3001 with the
//    Sceneify mock + local Supabase keys baked in)
//
// supabase/config.toml must have [auth.email] enable_confirmations = true so
// that signUp returns no session and the "Check your inbox" panel renders.

// Modern Supabase ships Mailpit as the local mail catcher (older versions
// shipped Inbucket). The legacy /api/v1/mailbox/<name> endpoint no longer
// exists — Mailpit exposes a search API instead. The poller below queries
// `to:<email>` and returns the matching message with its HTML body.
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitMessageSummary = {
  ID: string;
  To: Array<{ Name: string; Address: string }>;
  From: { Name: string; Address: string };
  Subject: string;
  Created: string;
  Snippet: string;
};

type MailpitMessage = {
  ID: string;
  To: Array<{ Name: string; Address: string }>;
  From: { Name: string; Address: string };
  Subject: string;
  HTML: string;
  Text: string;
  Date: string;
};

async function pollMailpitForLatest(
  request: APIRequestContext,
  toAddress: string,
  { timeoutMs = 15_000, intervalMs = 500 } = {},
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  const query = `to:"${toAddress}"`;
  while (Date.now() < deadline) {
    try {
      const res = await request.get(
        `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}&limit=1`,
      );
      if (res.ok()) {
        const data = (await res.json()) as {
          messages: MailpitMessageSummary[];
        };
        if (data.messages.length > 0) {
          const latest = data.messages[0];
          const detail = await request.get(
            `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(latest.ID)}`,
          );
          if (detail.ok()) {
            return (await detail.json()) as MailpitMessage;
          }
        }
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Mailpit message for "${toAddress}" never arrived within ${timeoutMs}ms.${
      lastErr ? ` Last error: ${String(lastErr)}` : ""
    }`,
  );
}

function extractConfirmationURL(html: string): string {
  // The confirmation template (supabase/templates/confirmation.html) emits
  // two <a href="{{ .ConfirmationURL }}"> tags pointing at Supabase's
  // /auth/v1/verify endpoint. We grab the first one and ignore the static
  // "vesperdrop.com" footer link.
  const match = html.match(/href="(https?:\/\/[^"]+\/auth\/v1\/verify[^"]*)"/);
  if (!match) {
    throw new Error(
      `No /auth/v1/verify link found in confirmation email. Body excerpt:\n${html.slice(0, 600)}`,
    );
  }
  // HTML entity-decode so `&amp;` query separators become `&` — without
  // this Supabase rejects with `Verify requires a verification type`
  // because `amp;type=signup` is not the parameter it's looking for.
  return match[1]
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x3D;/gi, "=");
}

test.describe("/try freemium funnel", () => {
  // The full conversion-gate happy path — the most important assertion
  // is that generation runs WITHOUT auth and that the download click is
  // what triggers the AuthModal. Everything else flows from there.
  // Bumped per-test timeout to 90s to accommodate mock generation
  // (~18s) + Inbucket round-trip (~5-15s) + claim handler (~few s) +
  // headroom for first-request Turbopack compile on a cold dev server.
  test.setTimeout(90_000);
  test("unauth generates → download click gates on signup → email confirm lands on library + claims batch", async ({
    page,
    request,
  }) => {
    // Fresh email each run so Supabase doesn't reject as already-registered
    // and Inbucket has a clean mailbox for this test only.
    const localPart = `vd-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `${localPart}@example.com`;
    const password = "playwright-test-password-1";

    // ── Step 1: unauth upload ───────────────────────────────────────────
    // waitUntil:"networkidle" lets a cold Turbopack dev server finish
    // compiling /try before we drive the page; otherwise the first run
    // after `pnpm dev` flakes when scene cards take > 10s to render.
    await page.goto("/try", { waitUntil: "networkidle" });

    await page.setInputFiles(
      'input[type="file"]',
      path.join("e2e", "fixtures", "test-flatlay.jpg"),
    );

    // ── Step 2: pick a single scene ─────────────────────────────────────
    // 20s tolerates the rare slow case where listScenes() blocks behind
    // a fresh Postgres connection. After warmup it resolves in <1s.
    const sceneCards = page.locator('[data-testid="scene-card"]');
    await sceneCards.first().waitFor({ state: "visible", timeout: 20_000 });
    await sceneCards.nth(0).click();

    // ── Step 3: click Develop. Critical assertion: no AuthModal opens.
    // This verifies the auth gate has been removed from the generation
    // path — the freemium flow must allow unauth previews.
    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    // The wizard advances to develop; AuthModal should NOT have opened.
    await expect(page).toHaveURL(/\/try\?.*step=develop/, { timeout: 10_000 });
    await expect(page.getByRole("dialog")).toBeHidden();

    // The develop header should be visible.
    await expect(page.locator("body")).toContainText(/in the\s*studio/i, {
      timeout: 10_000,
    });

    // ── Step 4: wait for the mocked Sceneify to return → previews appear.
    // The SignUpBar fixed at the bottom only renders once developDone
    // flips, which only happens after at least one generation succeeded.
    // It's the most reliable signal that "previews are ready, gate is up."
    const signUpBar = page.getByRole("region", { name: /save your batch/i });
    await expect(signUpBar).toBeVisible({ timeout: 60_000 });

    // ── Step 5: click the SignUpBar's "Create your account" CTA → modal.
    await signUpBar.getByRole("button", { name: /create your account/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // ── Step 6: submit signup with a fresh email.
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill(password);
    await dialog.getByRole("button", { name: "Create account" }).click();

    // ── Step 7: with email confirmation enabled, signUp returns no session
    // and AuthModal swaps to the ConfirmEmailPanel. The dialog should NOT
    // close (no redirect happens until the user clicks the email link).
    await expect(dialog).toContainText(/check your\s*inbox/i, {
      timeout: 10_000,
    });
    await expect(dialog).toContainText(email);

    // ── Step 8: pull the confirmation email out of Mailpit.
    const message = await pollMailpitForLatest(request, email);
    expect(message.Subject.toLowerCase()).toContain("confirm");
    const confirmationURL = extractConfirmationURL(message.HTML);

    // ── Step 9: follow the link in the SAME browser context so the
    // session cookies set by /api/auth/callback are available — and
    // localStorage from step 4 (where DevelopStep wrote vd_pending_batch)
    // is also still there. This is the critical bit: the claim page
    // reads localStorage on mount, so it MUST survive the navigation.
    await page.goto(confirmationURL);

    // ── Step 10: /app/claim is the post-confirm landing page. It
    // hydrates the previews from localStorage (instant) and posts to
    // /api/try/claim in the background to persist the batch. Wait for
    // the URL first, then for the saved-state signal.
    await page.waitForURL(/\/app\/claim/, { timeout: 20_000 });
    await expect(page.getByTestId("claim-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("claim-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 20_000 },
    );

    // ── Step 11: localStorage should have been cleared once the claim
    // succeeded — the page is single-shot.
    const pendingBatchAfterClaim = await page.evaluate(() =>
      window.localStorage.getItem("vd_pending_batch"),
    );
    expect(pendingBatchAfterClaim).toBeNull();

    // ── Step 12: download buttons should be present for each tile —
    // this is the whole point of /app/claim, the user lands directly
    // on a page where they can grab their previews.
    const downloads = page.getByTestId("claim-download");
    await expect(downloads.first()).toBeVisible();
    expect(await downloads.count()).toBeGreaterThan(0);
  });

  // Targeted regression test: if anyone re-adds an auth gate to the
  // generation path, this fails fast without needing the full Inbucket
  // round-trip. Intentionally narrower than the test above.
  test("unauth user reaches develop step without seeing AuthModal", async ({ page }) => {
    // Same cold-Turbopack accommodation as the long happy-path test.
    await page.goto("/try", { waitUntil: "networkidle" });
    await page.setInputFiles(
      'input[type="file"]',
      path.join("e2e", "fixtures", "test-flatlay.jpg"),
    );
    const sceneCards = page.locator('[data-testid="scene-card"]');
    await sceneCards.first().waitFor({ state: "visible", timeout: 20_000 });
    await sceneCards.nth(0).click();
    await page.locator('[data-testid="generate-button"]').click();

    await expect(page).toHaveURL(/\/try\?.*step=develop/, { timeout: 10_000 });
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
