import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

const cspHeader = [
  "default-src 'self'",
  // Scripts: self + Next.js inline scripts (nonce not yet wired, so unsafe-inline in report-only)
  "script-src 'self' 'unsafe-inline'",
  // Styles: self + inline (Next.js injects critical CSS)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs
  "img-src 'self' data:",
  // Fonts: self
  "font-src 'self'",
  // API / WebSocket connections restricted to known endpoints
  "connect-src 'self' https://horizon.stellar.org https://horizon-testnet.stellar.org https://api.paystack.co https://api.ng.termii.com https://*.ingest.sentry.io",
  // No plugins
  "object-src 'none'",
  // Framing: deny
  "frame-ancestors 'none'",
  // Upgrade insecure requests in production
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Report-Only first — switch to Content-Security-Policy once violations are reviewed
  { key: "Content-Security-Policy-Report-Only", value: cspHeader },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Deny framing to prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Control referrer information
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HSTS: 2-year max-age, include subdomains, preload-ready
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Disable browser features not needed by this app
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk"],
    instrumentationHook: true,
  },
  async redirects() {
    return process.env.NODE_ENV === "production"
      ? [
          {
            source: "/(.*)",
            has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
            destination: "https://www.ajosave.app/:path*",
            permanent: true,
          },
        ]
      : [];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
