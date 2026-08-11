"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { CommentRecord, PostRecord } from "@/lib/types";
import { formatRelativeDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { CommentSection } from "@/components/comment-section";
import { PostDownloadButton } from "@/components/post-download-button";
import { haptic } from "@/lib/haptics";
import { IconFile, IconImage, IconText, IconVideo } from "@/components/icons";

const VideoPlayer = dynamic(() =>
  import("@/components/video-player").then((m) => m.VideoPlayer),
);

type DetailPost = PostRecord & {
  liked: boolean;
  comments: CommentRecord[];
  comment_total: number;
};

function LikeButton({
  count,
  liked,
  onToggle,
  busy,
}: {
  count: number;
  liked: boolean;
  onToggle: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      className={`like-button ${liked ? "liked" : ""}`}
      onClick={onToggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? "إلغاء الإعجاب" : "إعجاب"}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="like-count">{count}</span>
    </button>
  );
}

function TypeIcon({ kind }: { kind: string }) {
  if (kind === "image") return <IconImage size={13} />;
  if (kind === "video") return <IconVideo size={13} />;
  if (kind === "file") return <IconFile size={13} />;
  return <IconText size={13} />;
}

function typeLabel(kind: string) {
  if (kind === "image") return "صورة";
  if (kind === "video") return "فيديو";
  if (kind === "file") return "ملف";
  return "نص";
}

export function PostDetail({
  post,
  idMap,
  visitorName,
  initialCommentsOpen = false,
}: {
  post: DetailPost;
  idMap: Record<string, string>;
  visitorName?: string | null;
  initialCommentsOpen?: boolean;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const commentsDialogRef = useRef<HTMLDialogElement | null>(null);

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const response = await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
      });
      if (response.ok) {
        const result = (await response.json()) as {
          count: number;
          liked: boolean;
        };
        setLikeCount(result.count);
        setLiked(result.liked);
        haptic(result.liked ? [8, 30, 12] : 8);
      }
    } finally {
      setLikeBusy(false);
    }
  }

  function openComments() {
    haptic(8);
    setCommentsOpen(true);
  }

  function removeCommentsQuery() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("comments")) return;
    url.searchParams.delete("comments");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function closeComments() {
    setCommentsOpen(false);
    removeCommentsQuery();
  }

  // Keep native dialog state synchronized with React. showModal() provides
  // focus trapping, Escape handling, and focus restoration for free.
  useEffect(() => {
    const dialog = commentsDialogRef.current;
    if (!dialog) return;
    if (commentsOpen && !dialog.open) dialog.showModal();
    if (!commentsOpen && dialog.open) dialog.close();
  }, [commentsOpen]);

  useEffect(() => {
    if (!commentsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [commentsOpen]);

  return (
    <main className="public-main">
      <div className="bio-shell">
        <Link className="back-link" href="/">
          → رجوع
        </Link>

        <article className="post-card post-card--detail">
          <div className="post-header">
            <div className="author">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="author-avatar" src="/avatar.jpg" alt="" onContextMenu={(e) => e.preventDefault()} />
              <span>
                <strong>mar</strong>
                <small>{formatRelativeDate(post.created_at)}</small>
              </span>
            </div>
            <span
              className={`post-type post-type-${post.kind}`}
              title={typeLabel(post.kind)}
              aria-label={typeLabel(post.kind)}
            >
              <TypeIcon kind={post.kind} />
            </span>
          </div>

          <div className="post-copy">
            <h1>{post.title}</h1>
            {post.body && <Markdown idMap={idMap}>{post.body}</Markdown>}
          </div>

          {post.kind === "image" && post.media_path && (
            <div>
              <div className="post-media image-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${post.id}?v=thumb`} alt={post.title} width={post.width ?? undefined} height={post.height ?? undefined} fetchPriority="high" decoding="async" onContextMenu={(e) => e.preventDefault()} />
              </div>
            </div>
          )}
          {post.kind === "video" && post.media_path && (
            <VideoPlayer
              src={`/api/media/${post.id}`}
              type={post.media_type || "video/mp4"}
            />
          )}

          <PostDownloadButton post={post} />

          <div className="post-footer">
            <LikeButton
              count={likeCount}
              liked={liked}
              onToggle={toggleLike}
              busy={likeBusy}
            />
            <button
              type="button"
              className="comment-count"
              aria-expanded={commentsOpen}
              aria-haspopup="dialog"
              onClick={openComments}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.2 8.2 0 0 1-8.5 8.2 9.6 9.6 0 0 1-3.6-.7L3 21l1.8-5a8.3 8.3 0 1 1 16.2-4.5Z" />
              </svg>
              <span>{post.comment_total}</span>
            </button>
          </div>
        </article>

        <dialog
          ref={commentsDialogRef}
          className="comment-sheet"
          aria-label="التعليقات"
          onCancel={(event) => {
            event.preventDefault();
            closeComments();
          }}
          onClose={() => {
            setCommentsOpen(false);
            removeCommentsQuery();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeComments();
          }}
        >
          <div className="comment-sheet__surface">
            <div className="comment-sheet__handle" aria-hidden="true" />
            <div className="comment-sheet__header">
              <h2>التعليقات ({post.comment_total})</h2>
              <button
                type="button"
                className="comment-sheet__close"
                aria-label="إغلاق"
                onClick={closeComments}
              >
                ✕
              </button>
            </div>
            <div className="comment-sheet__body">
              <CommentSection
                postId={post.id}
                initialComments={post.comments}
                initialTotal={post.comment_total}
                initialName={visitorName ?? null}
              />
            </div>
          </div>
        </dialog>
      </div>
    </main>
  );
}
