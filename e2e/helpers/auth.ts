import type { BrowserContext, Page } from "@playwright/test";

/** Simulates an authenticated session — mirrors the pattern used across all e2e specs. */
export const AUTH_COOKIE = {
  name: "next-auth.session-token",
  value: "e2e-test-session",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

export const SESSION_RESPONSE = {
  user: { id: "user-1", name: "Test User", phone: "+2348012345678" },
  expires: "2099-01-01",
};

/**
 * Sets up a mocked authenticated session on the given context + page.
 * Call this in beforeEach for any test that requires auth.
 */
export async function mockAuthSession(context: BrowserContext, page: Page): Promise<void> {
  await context.addCookies([AUTH_COOKIE]);
  await page.route("/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SESSION_RESPONSE),
    })
  );
}
