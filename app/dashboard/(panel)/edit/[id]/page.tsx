import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostComposer } from "@/components/post-composer";
import { requireAdmin } from "@/lib/auth";
import { getPost, getPostTitleMap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تعديل منشور",
  robots: { index: false, follow: false },
};

export default async function EditPost({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const post = getPost(id);
  if (!post) notFound();

  const idMap = getPostTitleMap();

  return (
    <div className="dash-page dash-page--wide">
      <h1 className="dash-page__title">تعديل المنشور</h1>
      {sp.created && <p className="dash-alert">تمت إضافة المنشور.</p>}
      {sp.error && (
        <p className="dash-alert dash-alert--error">
          {decodeURIComponent(sp.error)}
        </p>
      )}
      <PostComposer idMap={idMap} post={{ ...post }} />
    </div>
  );
}
