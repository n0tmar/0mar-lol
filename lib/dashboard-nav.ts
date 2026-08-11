export type DashboardTabHref =
  | "/dashboard"
  | "/dashboard/new"
  | "/dashboard/comments";

export function isDashboardTabActive(
  pathname: string,
  href: DashboardTabHref,
): boolean {
  if (href === "/dashboard") {
    return pathname === href || pathname.startsWith("/dashboard/edit/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
