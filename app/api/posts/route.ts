import { NextRequest, NextResponse } from "next/server";
import {
  countPublishedPosts,
  getLikeStates,
  listFeedPosts,
} from "@/lib/db";
import type { FeedPost } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const offset = Math.max(0, Number(search.get("offset") || 0) || 0);
  const limit = Math.min(
    50,
    Math.max(1, Number(search.get("limit") || 15) || 15),
  );

  const posts = listFeedPosts(offset, limit);
  const total = countPublishedPosts();

  const visitorId = request.cookies.get("omar_visitor_id")?.value;
  const likeStates = getLikeStates(
    posts.map((post) => post.id),
    visitorId,
  );

  const feed: FeedPost[] = posts.map((post) => {
    const like = likeStates.get(post.id) ?? { count: 0, liked: false };
    return {
      ...post,
      like_count: like.count,
      liked: like.liked,
    };
  });

  return NextResponse.json({ posts: feed, total, offset, limit });
}
