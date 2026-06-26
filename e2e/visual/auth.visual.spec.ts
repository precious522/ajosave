import { test, expect } from "@playwright/test";

/**
 * Visual regression tests for the authentication pages.
 */
test.describe("Visual: Auth / Login page", () => {
  test("login page — phone step matches snapshot", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("auth-login-phone-step.png", { fullPage: true });
  });

  test("login page — OTP step matches snapshot", async ({ page }) => {
    // Intercept send-otp so we can advance to the OTP step without a real SMS
    await page.route("/api/auth/send-otp", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );

    await page.goto("/auth/login");
    await page.getByLabel(/phone number/i).fill("8012345678");
    await page.getByRole("button", { name: /send code/i }).click();

    // Wait for the OTP step to render
    await expect(page.getByRole("heading", { name: /enter your otp/i })).toBeVisible();
    await expect(page).toHaveScreenshot("auth-login-otp-step.png", { fullPage: true });
  });
});
