"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconComment, IconEdit, IconText } from "@/components/icons";
import {
  isDashboardTabActive,
  type DashboardTabHref,
} from "@/lib/dashboard-nav";

export function DashTabs({ badge }: { badge: number }) {
  const pathname = usePathname();

  const tabs: {
    href: DashboardTabHref;
    label: string;
    icon: typeof IconText;
  }[] = [
    { href: "/dashboard", label: "المنشورات", icon: IconText },
    { href: "/dashboard/new", label: "منشور جديد", icon: IconEdit },
    { href: "/dashboard/comments", label: "التعليقات", icon: IconComment },
  ];

  return (
    <nav className="dash-tabs" aria-label="أقسام لوحة التحكم">
      {tabs.map((tab) => {
        const active = isDashboardTabActive(pathname, tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`dash-tab ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="dash-tab__icon">
              <Icon size={20} />
              {tab.href === "/dashboard/comments" && badge > 0 && (
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
