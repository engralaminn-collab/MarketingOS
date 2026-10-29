import type { NextConfig } from "next";

/**
 * Baseline browser-hardening headers.
 *
 * The app is an authenticated SPA served from the same origin; it makes no
 * cross-origin browser requests (all provider calls happen server-side), so the
 * policy can stay tight. `script-src` needs `'unsafe-inline'` for Next.js's
 * inline bootstrap payload — a nonce-based policy would require a middleware
 * rewrite of every request. No `'unsafe-eval'` is allowed in production.
 *
 * Content-Security-Policy is only emitted from a production build: the dev
 * server relies on eval-based HMR, and shipping a policy that breaks local
 * development teaches people to disable it.
 */
const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  ...(isProduction
    ? [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "media-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "21.0.4.113", "*.e2b.app", "*.e2b.dev"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses are never cacheable; several endpoints return
        // tenant-scoped data that a shared cache must not reuse.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
