import { test, expect } from "@playwright/test";

/**
 * Visual regression tests for the public landing page.
 * No auth required — these pages are publicly accessible.
 */
test.describe("Visual: Home page", () => {
  test("full page matches snapshot", async ({ page }) => {
    await page.goto("/");
    // Wait for fonts and images to settle
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home-full.png", { fullPage: true });
  });

  test("hero section matches snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hero = page.locator("section").first();
    await expect(hero).toHaveScreenshot("home-hero.png");
  });
});
