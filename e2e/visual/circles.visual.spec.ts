import { test, expect } from "@playwright/test";
import { mockAuthSession } from "../helpers/auth";

const MOCK_CIRCLES = [
  {
    id: "circle-1",
    name: "Lagos Savers",
    status: "open",
    contributionFiat: 10000,
    contributionCurrency: "NGN",
    circleType: "public",
    maxMembers: 5,
    memberCount: 2,
    currentCycle: 0,
    cycleFrequency: "monthly",
    creatorId: "user-99",
  },
  {
    id: "circle-2",
    name: "Abuja Circle",
    status: "open",
    contributionFiat: 25000,
    contributionCurrency: "NGN",
    circleType: "public",
    maxMembers: 10,
    memberCount: 7,
    currentCycle: 3,
    cycleFrequency: "weekly",
    creatorId: "user-88",
  },
];

test.describe("Visual: Circles browse page", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockAuthSession(context, page);

    // Mock the circles listing API so the page renders deterministically
    await page.route("/api/circles*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_CIRCLES, total: MOCK_CIRCLES.length }),
      })
    );
  });

  test("circles list page matches snapshot", async ({ page }) => {
    await page.goto("/circles");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("circles-list.png", { fullPage: true });
  });
});

test.describe("Visual: Circle detail page", () => {
  const CIRCLE_ID = "circle-1";

  test.beforeEach(async ({ page, context }) => {
    await mockAuthSession(context, page);

    await page.route(`/api/circles/${CIRCLE_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_CIRCLES[0] }),
      })
    );
  });

  test("circle detail page matches snapshot", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE_ID}`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("circle-detail.png", { fullPage: true });
  });
});

test.describe("Visual: Create circle page", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockAuthSession(context, page);
  });

  test("create circle form matches snapshot", async ({ page }) => {
    await page.goto("/circles/create");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("circle-create.png", { fullPage: true });
  });
});
