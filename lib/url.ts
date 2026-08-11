import type { NextRequest } from "next/server";

// Build an absolute URL from the request headers (Host + X-Forwarded-Proto).
// Next derives request.url from the server's own listen address
// (localhost:3100) when behind a proxy, which breaks redirects.
export function absoluteUrl(request: NextRequest, path: string): URL {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost";
  return new URL(path, `${proto}://${host}`);
}
