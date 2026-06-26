import { test, expect } from "@playwright/test";
import { mockAuthSession } from "../helpers/auth";

const MOCK_CIRCLES = [
  {
    id: "circle-1",
    name: "My Savings Circle",
    status: "active",
    contributionFiat: 15000,
    contributionCurrency: "NGN",
    circleType: "public",
    maxMembers: 5,
    memberCount: 5,
    currentCycle: 2,
    cycleFrequency: "monthly",
    creatorId: "user-1",
  },
];

test.describe("Visual: Dashboard page", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockAuthSession(context, page);

    // Mock the user's circles for a deterministic render
    await page.route("/api/circles/my*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_CIRCLES }),
      })
    );
  });

  test("dashboard page matches snapshot", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("dashboard.png", { fullPage: true });
  });
});
