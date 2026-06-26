import { test, expect } from "@playwright/test";

test.describe("OTP Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
  });

  test("shows phone step by default", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/phone number/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send code/i })).toBeVisible();
  });

  test("advances to OTP step after submitting phone", async ({ page }) => {
    // Intercept the send-otp API so we don't need a real SMS service
    await page.route("/api/auth/send-otp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    );

    await page.getByLabel(/phone number/i).fill("8012345678");
    await page.getByRole("button", { name: /send code/i }).click();

    await expect(page.getByRole("heading", { name: /enter your otp/i })).toBeVisible();
    await expect(page.getByLabel(/6-digit code/i)).toBeVisible();
  });

  test("shows error when send-otp fails", async ({ page }) => {
    await page.route("/api/auth/send-otp", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Invalid phone number" }),
      })
    );

    await page.getByLabel(/phone number/i).fill("0000000000");
    await page.getByRole("button", { name: /send code/i }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid phone number");
  });

  test("verify button disabled until 6 digits entered", async ({ page }) => {
    await page.route("/api/auth/send-otp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    );

    await page.getByLabel(/phone number/i).fill("8012345678");
    await page.getByRole("button", { name: /send code/i }).click();

    const verifyBtn = page.getByRole("button", { name: /verify/i });
    await expect(verifyBtn).toBeDisabled();

    await page.getByLabel(/6-digit code/i).fill("12345");
    await expect(verifyBtn).toBeDisabled();

    await page.getByLabel(/6-digit code/i).fill("123456");
    await expect(verifyBtn).toBeEnabled();
  });

  test("shows error on invalid OTP", async ({ page }) => {
    await page.route("/api/auth/send-otp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    );
    await page.route("/api/auth/callback/credentials", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "CredentialsSignin" }),
      })
    );

    await page.getByLabel(/phone number/i).fill("8012345678");
    await page.getByRole("button", { name: /send code/i }).click();
    await page.getByLabel(/6-digit code/i).fill("000000");
    await page.getByRole("button", { name: /verify/i }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid or expired/i);
  });
});
