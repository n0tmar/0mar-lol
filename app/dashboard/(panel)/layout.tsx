import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { countCommentsSince } from "@/lib/db";
import { DashTabs } from "@/components/dash-tabs";
import { IconExternalLink, IconLogout } from "@/components/icons";
import { AdminPushNotifications } from "@/components/admin-push-notifications";
import { getVapidPublicKey } from "@/lib/push";
import {
  dashboardBasePath,
  publicSiteRoot,
} from "@/lib/dashboard-host";
import { dashboardTabHref } from "@/lib/dashboard-nav";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [seenRaw, base] = await Promise.all([
    (await cookies()).get("omar_comments_seen")?.value,
    dashboardBasePath(),
  ]);
  const seen = Number(seenRaw);
  // No cookie or seen=0 => everything counts as new (first visit).
  const newComments = Number.isFinite(seen) && seen > 0 ? countCommentsSince(seen) : countCommentsSince(0);
  const vapidPublicKey = getVapidPublicKey();
  const publicRoot = publicSiteRoot();

  return (
    <main className="dashboard-layout" dir="rtl">
      <aside className="dash-sidebar">
        <div className="dash-sidebar__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar.jpg" alt="" width={32} height={32} />
          <span>لوحة التحكم</span>
        </div>
        <div className="dash-mobile-actions">
          <a href={publicRoot} target="_blank" rel="noreferrer" aria-label="فتح الموقع">
            <IconExternalLink size={18} />
          </a>
          <form action="/api/admin/logout" method="post">
            <button type="submit" aria-label="تسجيل الخروج">
              <IconLogout size={18} />
            </button>
          </form>
        </div>
        <nav className="dash-sidebar__nav">
          <Link href={dashboardTabHref("new", base)}>منشور جديد</Link>
          <Link href={dashboardTabHref("posts", base)}>المنشورات</Link>
          <Link href={dashboardTabHref("comments", base)}>
            التعليقات
            {newComments > 0 && <span className="dash-badge">{newComments}</span>}
          </Link>
          <Link href={dashboardTabHref("supporters", base)}>الداعمين</Link>
          <Link href={dashboardTabHref("subscribers", base)}>تنبيهات البريد</Link>
        </nav>
        <AdminPushNotifications publicKey={vapidPublicKey} />
        <div className="dash-sidebar__bottom">
          <a href={publicRoot} target="_blank" rel="noreferrer">فتح الموقع</a>
          <form action="/api/admin/logout" method="post">
            <button type="submit">تسجيل الخروج</button>
          </form>
        </div>
      </aside>
      <div className="dash-content">{children}</div>
      <DashTabs badge={newComments} base={base} />
    </main>
  );
}
