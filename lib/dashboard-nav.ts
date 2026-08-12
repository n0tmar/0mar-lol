export type DashboardTabId =
  | "posts"
  | "new"
  | "comments"
  | "supporters"
  | "subscribers";

/**
 * Dashboard routes live at /dashboard on the public host and at the root on
 * the dashboard subdomain (dashboard.0mar.lol). `base` is the dashboard URL
 * prefix for the current host: "/dashboard" or "".
 */
export function dashboardTabHref(id: DashboardTabId, base: string): string {
  if (id === "posts") return base || "/";
  return `${base}/${id}`;
}

export function isDashboardTabActive(
  pathname: string,
  id: DashboardTabId,
  base: string,
): boolean {
  const href = dashboardTabHref(id, base);

  if (id === "posts") {
    // The edit page belongs to the posts tab on both layouts.
    return pathname === href || pathname.startsWith(`${base}/edit/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
