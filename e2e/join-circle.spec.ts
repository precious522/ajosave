import { test, expect } from "@playwright/test";

const AUTH_COOKIE = {
  name: "next-auth.session-token",
  value: "e2e-test-session",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

const CIRCLE_ID = "circle-xyz";

test.describe("Join Circle", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([AUTH_COOKIE]);

    await page.route("/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "user-2", name: "Test User", phone: "+2348099999999" },
          expires: "2099-01-01",
        }),
      })
    );

    // Mock circle detail page data
    await page.route(`/api/circles/${CIRCLE_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: CIRCLE_ID,
            name: "Open Ajo",
            status: "open",
            contributionNgn: 10000,
            maxMembers: 5,
            currentCycle: 0,
            cycleFrequency: "monthly",
            creatorId: "user-1",
          },
        }),
      })
    );
  });

  test("join button visible for open circle non-member", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE_ID}`);
    await expect(page.getByRole("button", { name: /join circle/i })).toBeVisible();
  });

  test("join succeeds and shows confirmation", async ({ page }) => {
    await page.route(`/api/circles/${CIRCLE_ID}/join`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );

    await page.goto(`/circles/${CIRCLE_ID}`);
    await page.getByRole("button", { name: /join circle/i }).click();

    // Expect success feedback (toast or inline message)
    await expect(page.getByText(/joined/i)).toBeVisible();
  });

  test("join shows error when circle is full", async ({ page }) => {
    await page.route(`/api/circles/${CIRCLE_ID}/join`, (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Circle is full" }),
      })
    );

    await page.goto(`/circles/${CIRCLE_ID}`);
    await page.getByRole("button", { name: /join circle/i }).click();

    await expect(page.getByText(/circle is full/i)).toBeVisible();
  });
});
