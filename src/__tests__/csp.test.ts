describe("CSP header builder", () => {
  it("builds a nonce-based report-only policy", () => {
    const nonce = "abc123";
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https://unpkg.com",
      "connect-src 'self' https://horizon.stellar.org https://horizon-testnet.stellar.org https://api.paystack.co https://api.ng.termii.com https://*.ingest.sentry.io",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain(`script-src 'self' 'nonce-${nonce}'`);
    expect(policy).toContain("img-src 'self' data: https:");
  });
});
