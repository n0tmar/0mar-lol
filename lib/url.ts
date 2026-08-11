import { NextRequest } from "next/server";
import { isDashboardHostForHostName } from "@/lib/hosts";

// Build an absolute URL from the request headers (Host + X-Forwarded-Proto).
// Next derives request.url from the server's own listen address
// (localhost:3100) when behind a proxy, which breaks redirects.
export function absoluteUrl(request: NextRequest, path: string): URL {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost";
  return new URL(path, `${proto}://${host}`);
}

/**
 * Redirect target for dashboard-facing responses: root on the dashboard
 * subdomain (dashboard routes live at /), "/dashboard" on the public host.
 * `path` is the subdomain-root path, e.g. "" or "/comments?replied=1".
 */
export function dashboardRedirectUrl(
  request: NextRequest,
  path: string,
): URL {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded ?? request.headers.get("host");
  const base = isDashboardHostForHostName(host) ? "" : "/dashboard";
  return absoluteUrl(request, `${base}${path}`);
}
