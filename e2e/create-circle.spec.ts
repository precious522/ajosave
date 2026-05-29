import { test, expect } from "@playwright/test";

// Simulate an authenticated session cookie so protected pages load
const AUTH_COOKIE = {
  name: "next-auth.session-token",
  value: "e2e-test-session",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

test.describe("Create Circle", () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock the session endpoint so the app treats us as logged in
    await context.addCookies([AUTH_COOKIE]);
    await page.route("/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "user-1", name: "Test User", phone: "+2348012345678" },
          expires: "2099-01-01",
        }),
      })
    );
  });

  test("create circle form renders required fields", async ({ page }) => {
    await page.goto("/circles/create");
    await expect(page.getByLabel(/circle name/i)).toBeVisible();
    await expect(page.getByLabel(/contribution/i)).toBeVisible();
    await expect(page.getByLabel(/max members/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create circle/i })).toBeVisible();
  });

  test("submits form and redirects on success", async ({ page }) => {
    await page.route("/api/circles", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { id: "circle-abc" } }),
      })
    );

    await page.goto("/circles/create");
    await page.getByLabel(/circle name/i).fill("Test Ajo Circle");
    await page.getByLabel(/contribution/i).fill("5000");
    await page.getByLabel(/max members/i).fill("5");
    await page.getByRole("button", { name: /create circle/i }).click();

    await expect(page).toHaveURL(/\/circles\/circle-abc/);
  });

  test("shows validation error for missing fields", async ({ page }) => {
    await page.goto("/circles/create");
    await page.getByRole("button", { name: /create circle/i }).click();
    // HTML5 required validation or custom error message
    const nameInput = page.getByLabel(/circle name/i);
    await expect(nameInput).toBeFocused();
  });

  test("shows error toast when API fails", async ({ page }) => {
    await page.route("/api/circles", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Name already taken" }),
      })
    );

    await page.goto("/circles/create");
    await page.getByLabel(/circle name/i).fill("Duplicate Circle");
    await page.getByLabel(/contribution/i).fill("5000");
    await page.getByLabel(/max members/i).fill("5");
    await page.getByRole("button", { name: /create circle/i }).click();

    await expect(page.getByText(/name already taken/i)).toBeVisible();
  });
});
