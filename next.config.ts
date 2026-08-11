import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/qr/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  poweredByHeader: false,
  // sharp ships native binaries (libvips DLLs/.so) that turbopack's
  // standalone tracing drops — without them the admin upload route
  // crashes at runtime (ERR_DLOPEN_FAILED). Force-trace them.
  outputFileTracingIncludes: {
    "/api/admin/posts": ["./node_modules/@img/**/*"],
  },
  // The live data directory must never be traced into the standalone bundle
  // (it is a runtime volume, not build content).
  outputFileTracingExcludes: {
    "*": ["./data/**", "./data/*"],
  },
};

export default nextConfig;
