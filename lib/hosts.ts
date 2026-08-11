/**
 * Host-based routing between the public site (PUBLIC_HOST) and the dashboard
 * subdomain (DASHBOARD_HOST).
 *
 * When both env vars are unset (local dev, integration tests) the app keeps
 * the legacy single-host layout: dashboard at /dashboard.
 *
 * Pure helpers only — safe to import from proxy.ts and route handlers.
 */

export function normalizeHostName(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return value.split(":")[0].toLowerCase();
}

export function dashboardHostName(): string | null {
  return process.env.DASHBOARD_HOST?.trim().toLowerCase() || null;
}

export function publicHostName(): string | null {
  return process.env.PUBLIC_HOST?.trim().toLowerCase() || null;
}

/** True when the given host name (Host / X-Forwarded-Host) is the dashboard subdomain. */
export function isDashboardHostForHostName(
  value: string | null | undefined,
): boolean {
  const dashboard = dashboardHostName();
  return !!dashboard && normalizeHostName(value) === dashboard;
}
