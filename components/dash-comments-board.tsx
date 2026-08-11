"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CommentRecord } from "@/lib/types";
import { buildFlatTree } from "@/lib/comment-tree";
import { OWNER_NAME } from "@/lib/constants";
import { DashCommentCard } from "@/components/dash-comment-card";

export type BoardPost = {
  postId: string;
  postTitle: string;
  comments: (CommentRecord & { post_title?: string })[];
};

function needsReply(node: { name: string; children: { name: string }[] }): boolean {
  if (node.name === OWNER_NAME) return false;
  return node.children.every((child) => child.name !== OWNER_NAME);
}

export function DashCommentsBoard({ posts }: { posts: BoardPost[] }) {
  const [filter, setFilter] = useState<"all" | "needsReply">("all");

  const groups = useMemo(
    () =>
      posts.map((post) => ({
        ...post,
        tree: buildFlatTree(post.comments),
      })),
    [posts],
  );

  const needsCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.tree.filter(needsReply).length, 0),
    [groups],
  );

  return (
    <>
      <div className="dash-board-filters" role="group" aria-label="تصفية التعليقات">
        <button
          type="button"
          className={`dash-board-filter ${filter === "all" ? "is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          الكل
        </button>
        <button
          type="button"
          className={`dash-board-filter ${filter === "needsReply" ? "is-active" : ""}`}
          onClick={() => setFilter("needsReply")}
        >
          بحاجة رد{needsCount > 0 ? ` (${needsCount})` : ""}
        </button>
      </div>

      <div className="dash-comments__groups">
        {groups.map((group) => {
          const visible = filter === "needsReply" ? group.tree.filter(needsReply) : group.tree;
          if (visible.length === 0) return null;
          return (
            <div key={group.postId} className="dash-comments__group">
              <div className="dash-comments__group-head">
                <Link
                  href={`/posts/${group.postId}`}
                  className="dash-comments__post"
                  target="_blank"
                >
                  <span className="dash-comments__post-title">{group.postTitle}</span>
                  <span className="dash-comments__post-count">{group.comments.length}</span>
                </Link>
                <span className="dash-comments__group-label">تعليقات</span>
              </div>
              {visible.map((comment) => (
                <DashCommentCard key={comment.id} comment={comment} />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
