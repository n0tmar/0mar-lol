import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { countAllComments, listAllComments } from "@/lib/db";
import { DashCommentsBoard } from "@/components/dash-comments-board";
import { MarkCommentsSeen } from "@/components/mark-comments-seen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "التعليقات",
  robots: { index: false, follow: false },
};

export default async function DashboardComments() {
  await requireAdmin();
  const comments = listAllComments().map((c) => ({ ...c }));
  const total = countAllComments();

  const grouped = new Map<string, (typeof comments)[number][]>();
  for (const c of comments) {
    const key = c.post_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  const posts = Array.from(grouped.entries()).map(([postId, items]) => ({
    postId,
    postTitle: items[0].post_title ?? "—",
    comments: items,
  }));

  return (
    <div className="dash-page">
      <MarkCommentsSeen />
      <h1 className="dash-page__title">التعليقات</h1>
      {comments.length === 0 ? (
        <p className="dash-empty">لا تعليقات حتى الآن.</p>
      ) : (
        <>
          {total > comments.length && (
            <p className="dash-comments__note">
              عرض آخر {comments.length} تعليق من أصل {total}.
            </p>
          )}
          <DashCommentsBoard posts={posts} />
        </>
      )}
    </div>
  );
}
