import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
