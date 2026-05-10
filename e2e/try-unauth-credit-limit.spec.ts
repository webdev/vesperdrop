import { test, expect } from "@playwright/test";
import path from "node:path";

// Unauth visitors get exactly one free preview. Picking N scenes still
// fires N concurrent /api/try/generate calls — the first acquires the
// IP's only rate-limit slot and succeeds, the rest 429 with code
// "credit_limit_reached" and the tile renders a sign-up nudge instead
// of the generic "RESHOOT NEEDED" copy.
//
// This test pins that contract so accidental relaxations of the limit
// (e.g. dropping back to 3/hour, or the rate-limit bypass that briefly
// existed for E2E_SCENEIFY_MOCK) fail loudly.

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

  test("3 picks → 1 succeeds, 2 fail with credit_limit_reached", async ({
    page,
  }) => {
    await page.goto("/try", { waitUntil: "networkidle" });

    await page.setInputFiles(
      'input[type="file"]',
      path.join("e2e", "fixtures", "test-flatlay.jpg"),
    );

    const sceneCards = page.locator('[data-testid="scene-card"]');
    await sceneCards.first().waitFor({ state: "visible", timeout: 20_000 });
    // Pick three different scenes — any three will do; the rate-limit
    // contract is independent of which scenes you pick.
    await sceneCards.nth(0).click();
    await sceneCards.nth(1).click();
    await sceneCards.nth(2).click();

    await page.locator('[data-testid="generate-button"]').click();
    await expect(page).toHaveURL(/\/try\?.*step=develop/, { timeout: 10_000 });
    await expect(page.getByRole("dialog")).toBeHidden();

    // Wait until every tile has either succeeded or failed. We poll on
    // data-tile-status instead of a single signal because we expect a
    // mix of statuses — there is no single "all-done" event the UI
    // exposes when one succeeds and others 429.
    const tiles = page.locator('[data-testid="develop-tile"]');
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

    // The user-visible copy on the credit-limited tiles should be the
    // sign-up nudge, not the generic "RESHOOT NEEDED" string.
    await expect(
      page.getByTestId("tile-credit-limit").first(),
    ).toBeVisible();
    await expect(page.getByText(/RESHOOT NEEDED/i)).toHaveCount(0);
  });
});
