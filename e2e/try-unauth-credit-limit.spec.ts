import { test, expect } from "@playwright/test";
import path from "node:path";

// Unauth visitors are capped at 2 scene picks. The develop step then
// auto-adds a 3rd "BONUS SHOT" tile from the catalog so the funnel
// always shows 1 free preview + 2 locked tiles behind the $9.99 unlock
// CTA. Only the first slot fires a real /api/try/generate request —
// the other two are pre-marked credit_limit_reached client-side and
// render the locked-paywall overlay (heavy blur + lock + UNLOCK FOR
// $9.99 strip) without burning the IP's hourly rate-limit slot.
//
// This test pins both contracts: the 2-pick cap, and the
// credit_limit_reached error code on the locked tiles.

// RFC 5737 documentation block — safe to spoof via x-forwarded-for so
// each test has a fresh in-memory rate-limit bucket on the dev server.
function uniqueTestIp(): string {
  const lastOctet = (Date.now() ^ Math.floor(Math.random() * 1e6)) % 254 + 1;
  return `198.51.100.${lastOctet}`;
}

test.describe("/try unauth credit limit", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueTestIp() });
  });

  test("2 picks → 3 tiles (1 free + bonus + locked), 1 succeeds, 2 credit_limit_reached", async ({
    page,
  }) => {
    await page.goto("/try", { waitUntil: "networkidle" });

    await page.setInputFiles(
      'input[type="file"]',
      path.join("e2e", "fixtures", "test-flatlay.jpg"),
    );

    const sceneCards = page.locator('[data-testid="scene-card"]');
    await sceneCards.first().waitFor({ state: "visible", timeout: 20_000 });
    // Unauth cap is 2: a 3rd click is rejected by ScenesStep before the
    // pick lands. Pick exactly 2; the bonus slot is auto-added in the
    // develop step from the remaining catalog.
    await sceneCards.nth(0).click();
    await sceneCards.nth(1).click();

    await page.locator('[data-testid="generate-button"]').click();
    await expect(page).toHaveURL(/\/try\?.*step=develop/, { timeout: 10_000 });
    await expect(page.getByRole("dialog")).toBeHidden();

    // Wait until every tile has either succeeded or failed. We poll on
    // data-tile-status instead of a single signal because we expect a
    // mix of statuses — there is no single "all-done" event the UI
    // exposes when one succeeds and others 429.
    const tiles = page.locator('[data-testid="develop-tile"]');
    // 2 picks + 1 auto-added bonus tile = 3 tiles total.
    await expect(tiles).toHaveCount(3, { timeout: 60_000 });

    await expect
      .poll(
        async () => {
          const statuses = await tiles.evaluateAll((els) =>
            els.map((el) => el.getAttribute("data-tile-status")),
          );
          return statuses.every((s) => s === "succeeded" || s === "failed");
        },
        { timeout: 60_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);

    const succeeded = page.locator(
      '[data-testid="develop-tile"][data-tile-status="succeeded"]',
    );
    const failed = page.locator(
      '[data-testid="develop-tile"][data-tile-status="failed"]',
    );
    const creditLimited = page.locator(
      '[data-testid="develop-tile"][data-error-code="credit_limit_reached"]',
    );

    await expect(succeeded).toHaveCount(1);
    await expect(failed).toHaveCount(2);
    // Both failures must be the credit-limit case specifically — a
    // generic 5xx fallback would also produce status="failed", but with
    // a different error code, and we want this contract pinned.
    await expect(creditLimited).toHaveCount(2);

    // The free-preview cream caption strip is on the succeeded tile,
    // and the locked tiles render an "UNLOCK FOR $9.99" CTA (one each).
    // The "RESHOOT NEEDED" copy must NOT appear — credit-limited tiles
    // are surfaced as paywall overlays, not generic errors.
    await expect(page.getByTestId("tile-free-preview-strip")).toBeVisible();
    await expect(page.getByTestId("tile-unlock-cta")).toHaveCount(2);
    await expect(page.getByText(/RESHOOT NEEDED/i)).toHaveCount(0);
  });
});
