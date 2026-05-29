import { test, expect } from "@playwright/test";

const AUTH_COOKIE = {
  name: "next-auth.session-token",
  value: "e2e-test-session",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

const CIRCLE_ID = "circle-active";

test.describe("Contribute", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([AUTH_COOKIE]);

    await page.route("/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "user-3", name: "Member User", phone: "+2348011111111" },
          expires: "2099-01-01",
        }),
      })
    );
  });

  test("contribute button visible for active circle member", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE_ID}`);
    await expect(page.getByRole("button", { name: /contribute now/i })).toBeVisible();
  });

  test("contribute redirects to Paystack on success", async ({ page }) => {
    const paystackUrl = "https://checkout.paystack.com/test-ref";

    await page.route(`/api/circles/${CIRCLE_ID}/contribute`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { authorizationUrl: paystackUrl },
        }),
      })
    );

    // Intercept the navigation to Paystack so the test doesn't actually leave
    let navigatedTo = "";
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigatedTo = frame.url();
    });

    await page.goto(`/circles/${CIRCLE_ID}`);
    await page.getByRole("button", { name: /contribute now/i }).click();

    // Wait briefly for the redirect to be triggered
    await page.waitForTimeout(500);
    expect(navigatedTo).toContain("paystack");
  });

  test("shows error toast when contribute API fails", async ({ page }) => {
    await page.route(`/api/circles/${CIRCLE_ID}/contribute`, (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Already contributed this cycle" }),
      })
    );

    await page.goto(`/circles/${CIRCLE_ID}`);
    await page.getByRole("button", { name: /contribute now/i }).click();

    await expect(page.getByText(/already contributed/i)).toBeVisible();
  });
});
