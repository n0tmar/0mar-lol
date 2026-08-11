import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  countApprovedComments,
  getLikeState,
  getPost,
  getPostTitleMap,
  getVisitorName,
  listApprovedComments,
} from "@/lib/db";
import { PostDetail } from "@/components/post-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getPost(id);
  if (!post) return { title: "منشور" };
  return { title: post.title, robots: { index: false, follow: false } };
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ comments?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const post = getPost(id);
  if (!post || post.published !== 1) {
    notFound();
  }

  const cookieStore = await cookies();
  const visitorId = cookieStore.get("omar_visitor_id")?.value;
  const like = getLikeState(id, visitorId);
  const comments = listApprovedComments(id, 30, 0).map((c) => ({ ...c }));
  const commentTotal = countApprovedComments(id);
  const visitorName = visitorId ? getVisitorName(visitorId) : null;
  const idMap = getPostTitleMap();

  return (
    <PostDetail
      post={{
        ...post,
        like_count: like.count,
        liked: like.liked,
        comments,
        comment_total: commentTotal,
      }}
      idMap={idMap}
      visitorName={visitorName}
      initialCommentsOpen={query.comments === "1"}
    />
  );
}
