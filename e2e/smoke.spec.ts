import { test, expect } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("Darkroom");
});

test("pricing page shows plan numbers", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("body")).toContainText("Free");
  await expect(page.locator("body")).toContainText("Pro");
});
