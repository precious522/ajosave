import { test, expect } from "@playwright/test";
import { mockAuthSession } from "../helpers/auth";

const MOCK_PROFILE = {
  phone: "+2348012345678",
  displayName: "Test User",
  stellarPublicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  reputationScore: 75,
  contributionStats: { total: 12, confirmed: 11, missed: 1 },
};

const MOCK_REFERRAL = {
  referralCode: "TESTCODE123",
  referralCount: 3,
  referredBy: null,
};

test.describe("Visual: Profile page", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockAuthSession(context, page);

    await page.route("/api/v1/profile", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_PROFILE }),
      })
    );

    await page.route("/api/referral", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_REFERRAL }),
      })
    );

    // Mock Stellar balance so the page doesn't hang on a real network call
    await page.route("/api/stellar/balance*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { balance: "250.00", hasTrustline: true } }),
      })
    );
  });

  test("profile page matches snapshot", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("profile.png", { fullPage: true });
  });
});
