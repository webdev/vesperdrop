import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("/try progress UX (mocked Sceneify)", () => {
  // TODO(e2e): full flow needs more env scaffolding. The streaming /api/try/generate
  // route calls listScenes() against Postgres which isn't up in e2e, and parallel
  // multipart POSTs of the same FormData surface a body-reuse error. Hooks (mock
  // routes for /api/internal/generations + /api/public/presets, fixture flatlay,
  // data-testid attributes, middleware bypass via E2E_SCENEIFY_MOCK) are committed
  // so this can be unblocked next session by also mocking listScenes() under the
  // E2E flag and re-reading the file blob per-stream.
  test.skip("renders progress screen and completes the batch", async ({ page }) => {
    await page.goto("/try");

    await page.setInputFiles(
      'input[type="file"]',
      path.join("e2e", "fixtures", "test-flatlay.jpg"),
    );

    const sceneCards = page.locator('[data-testid="scene-card"]');
    await sceneCards.first().waitFor({ state: "visible", timeout: 10_000 });
    await sceneCards.nth(0).click();
    await sceneCards.nth(1).click();
    await sceneCards.nth(2).click();

    await page.locator('[data-testid="generate-button"]').click();

    await expect(page.locator('img[alt="your upload"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[aria-label*="generating"]')).toHaveCount(3, { timeout: 8_000 });

    // Wait for the mock's 4s delay × 3 streams (but they run in parallel, so ~4s).
    // Each stream then watermarks and stores; allow generous headroom on slow CI.
    await expect(page.locator('img[alt="your upload"]')).toBeHidden({ timeout: 60_000 });
  });

  test("partial failure shows inline retry on the failing tile", () => {
    test.skip(true, "requires per-call mock control; track in follow-up");
  });
});
