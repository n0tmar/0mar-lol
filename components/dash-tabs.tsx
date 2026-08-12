"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconComment, IconEdit, IconHeart, IconText } from "@/components/icons";
import {
  dashboardTabHref,
  isDashboardTabActive,
  type DashboardTabId,
} from "@/lib/dashboard-nav";

export function DashTabs({ badge, base }: { badge: number; base: string }) {
  const pathname = usePathname();

  const tabs: {
    id: DashboardTabId;
    label: string;
    icon: typeof IconText;
  }[] = [
    { id: "posts", label: "المنشورات", icon: IconText },
    { id: "new", label: "منشور جديد", icon: IconEdit },
    { id: "comments", label: "التعليقات", icon: IconComment },
    { id: "supporters", label: "الداعمين", icon: IconHeart },
  ];

  return (
    <nav className="dash-tabs" aria-label="أقسام لوحة التحكم">
      {tabs.map((tab) => {
        const href = dashboardTabHref(tab.id, base);
        const active = isDashboardTabActive(pathname, tab.id, base);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`dash-tab ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="dash-tab__icon">
              <Icon size={20} />
              {tab.id === "comments" && badge > 0 && (
                <span className="dash-tab__badge">{badge}</span>
              )}
            </span>
            <span className="dash-tab__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
