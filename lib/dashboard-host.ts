import "server-only";

import { headers } from "next/headers";
import {
  isDashboardHostForHostName,
  publicHostName,
} from "@/lib/hosts";

/**
 * URL prefix of the dashboard on the current host: "" on the dashboard
 * subdomain (dashboard routes live at the root), "/dashboard" elsewhere.
 */
export async function dashboardBasePath(): Promise<string> {
  return (await isDashboardHostRequest()) ? "" : "/dashboard";
}

export async function isDashboardHostRequest(): Promise<boolean> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-host");
  const host = forwarded ?? store.get("host");
  return isDashboardHostForHostName(host);
}

/**
 * Root URL of the public site. Falls back to "/" in dev, where there is no
 * subdomain split and the public site is the current host.
 */
export function publicSiteRoot(): string {
  const host = publicHostName();
  return host ? `https://${host}/` : "/";
}
