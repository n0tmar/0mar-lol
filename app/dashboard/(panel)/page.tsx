import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getPostTitleMap, listDashboardPosts } from "@/lib/db";
import { DashboardPosts } from "@/components/dashboard-posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "المنشورات",
  robots: { index: false, follow: false },
};

export default async function DashboardPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; edited?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const posts = listDashboardPosts().map((p) => ({ ...p }));
  const idMap = { ...getPostTitleMap() };

  return (
    <>
      {params.created && (
        <p className="dash-alert dash-alert--spaced" role="status">تمت إضافة المنشور.</p>
      )}
      {params.edited && (
        <p className="dash-alert dash-alert--spaced" role="status">تم حفظ التعديلات.</p>
      )}
      {params.error && (
        <p className="dash-alert dash-alert--error dash-alert--spaced" role="alert">
          {decodeURIComponent(params.error)}
        </p>
      )}
      <DashboardPosts posts={posts} idMap={idMap} />
    </>
  );
}
