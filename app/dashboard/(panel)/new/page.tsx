import type { Metadata } from "next";
import { PostComposer } from "@/components/post-composer";
import { requireAdmin } from "@/lib/auth";
import { getPostTitleMap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "منشور جديد",
  robots: { index: false, follow: false },
};

export default async function NewPost({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const idMap = getPostTitleMap();

  return (
    <div className="dash-page dash-page--wide">
      <h1 className="dash-page__title">منشور جديد</h1>
      {params.created && <p className="dash-alert">تمت إضافة المنشور.</p>}
      {params.error && <p className="dash-alert dash-alert--error">{decodeURIComponent(params.error)}</p>}
      <PostComposer idMap={idMap} />
    </div>
  );
}
