import { NextResponse, type NextRequest } from "next/server";
import {
  dashboardHostName,
  normalizeHostName,
  publicHostName,
} from "@/lib/hosts";

/**
 * Host-based routing (Next 16 proxy, Node.js runtime by default).
 *
 * - dashboard.0mar.lol (DASHBOARD_HOST): dashboard routes live at the root —
 *   "/" renders the posts panel; "/comments", "/supporters", "/new",
 *   "/edit/:id" and "/login" map to their /dashboard/* pages. Legacy
 *   /dashboard/* URLs are permanently redirected to the clean root URLs, and
 *   anything that is not
 *   a dashboard route goes back to the public site.
 * - 0mar.lol (PUBLIC_HOST): /dashboard/* is permanently redirected to the
 *   dashboard subdomain.
 * - Unknown hosts (localhost, tests): passthrough, dashboard stays at
 *   /dashboard (legacy layout).
 *
 * API routes, static assets and the service worker are always passthrough:
 * the same Next instance serves both hosts, and the dashboard subdomain
 * needs its own /sw.js for Web Push.
 */
const REWRITE_MARKER = "x-omar-internal-rewrite";

export function proxy(request: NextRequest) {
  // Internal rewrites re-enter the proxy with the target path — pass them
  // through, or /dashboard rewrites would bounce back to the root forever.
  if (request.headers.get(REWRITE_MARKER)) return;

  const dashboardHost = dashboardHostName();
  const publicHost = publicHostName();
  if (!dashboardHost || !publicHost) return; // dev / tests: single-host layout

  const host = normalizeHostName(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  const { pathname } = request.nextUrl;
  if (!host || pathname.startsWith("/api/")) return;

  if (host === dashboardHost) {
    // Canonical dashboard routes at the subdomain root.
    if (pathname === "/") return rewriteTo(request, "/dashboard");
    if (pathname === "/login") return rewriteTo(request, "/dashboard/login");
    if (pathname === "/comments") return rewriteTo(request, "/dashboard/comments");
    if (pathname === "/supporters") return rewriteTo(request, "/dashboard/supporters");
    if (pathname === "/new") return rewriteTo(request, "/dashboard/new");
    if (pathname.startsWith("/edit/")) {
      return rewriteTo(request, `/dashboard${pathname}`);
    }

    // Legacy /dashboard/* URLs (old links, API redirects) → clean root URLs.
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      const target =
        pathname === "/dashboard" ? "/" : pathname.slice("/dashboard".length);
      return redirectToHost(request, dashboardHost, target);
    }

    // Everything else belongs to the public site.
    return redirectToHost(request, publicHost, pathname);
  }

  // Public site: /dashboard/* moved to the dashboard subdomain.
  if (
    host === publicHost &&
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
  ) {
    const target =
      pathname === "/dashboard" ? "/" : pathname.slice("/dashboard".length);
    return redirectToHost(request, dashboardHost, target);
  }
}

function rewriteTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  // Carry the original headers (cookies, host) into the internal request.
  const headers = new Headers(request.headers);
  headers.set(REWRITE_MARKER, "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

function redirectToHost(request: NextRequest, host: string, pathname: string) {
  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.hostname = host;
  url.port = "";
  url.pathname = pathname;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|icons/|avatars/|fonts/|sw\\.js|favicon\\.png|favicon\\.ico|avatar\\.jpg|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml).*)",
  ],
};
