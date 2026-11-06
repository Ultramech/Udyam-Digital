import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets a second dev server (e.g. for e2e tests) run beside your own without sharing .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components is off: this app is session/DB driven (cookies, per-user state), not cacheable.
  serverExternalPackages: ["sharp", "@libsql/client", "libsql"],
  // migrations are read from disk at runtime in dev/tests; make sure serverless bundles include them too
  outputFileTracingIncludes: { "/api/**": ["./drizzle/**/*"] },
  poweredByHeader: false,
  // dev only: let pages opened through the `npm run tunnel` URL use hot reload (production has no dev server)
  allowedDevOrigins: ["*.trycloudflare.com"],
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      // camera: document photos; microphone: voice notes in the advisor; nothing else
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
    ];
    return [
      { source: "/:path*", headers: security },
      // personal data never sits in shared caches
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
