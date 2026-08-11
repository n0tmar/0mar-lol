"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { FeedPost } from "@/lib/types";
import { formatRelativeDate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { Markdown } from "@/components/markdown";
import { IconFile, IconImage, IconReply, IconText, IconVideo } from "@/components/icons";

const VideoPlayer = dynamic(() =>
  import("@/components/video-player").then((m) => m.VideoPlayer),
);

const FEED_PAGE_SIZE = 15;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCount(value: number) {
  if (value < 10000) return String(value);
  return `${Math.round(value / 1000)}K`;
}

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
      <span className="like-count">{formatCount(count)}</span>
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

function PostCard({ post, idMap, lazy }: { post: FeedPost; idMap: Record<string, string>; lazy?: boolean }) {  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [likeBusy, setLikeBusy] = useState(false);

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

  return (
    <article className="post-card">
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
        {post.hasCreatorReply && (
          <span className="creator-reply-badge" title="عمر رد على تعليقك">
            <IconReply size={11} />
            رد عليك عمر
          </span>
        )}
      </div>

      <div className="post-copy">
        <h3>
          <Link href={`/posts/${post.id}`} className="post-title-link">
            {post.title}
          </Link>
        </h3>
        {post.body && <Markdown idMap={idMap}>{post.body}</Markdown>}
      </div>

      {post.kind === "image" && post.media_path && (
        <Link href={`/posts/${post.id}`} className="post-media-link">
          <div className="post-media image-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${post.id}?v=thumb`} alt={post.title} width={post.width ?? undefined} height={post.height ?? undefined} loading={lazy ? "lazy" : undefined} decoding="async" onContextMenu={(e) => e.preventDefault()} />
          </div>
        </Link>
      )}

      {post.kind === "image" && post.has_file === 1 && post.media_path && (
        <a className="file-button" href={`/api/media/${post.id}?download=1`} download dir="ltr">
          <svg className="file-button__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          <span className="file-button__name">{post.file_name || post.media_name || post.title}</span>
          <span className="file-button__meta">
            {post.file_size ? formatFileSize(post.file_size) : post.media_size ? formatFileSize(post.media_size) : "File"}
            {post.download_count > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{formatCount(post.download_count)} تنزيل</span>
              </>
            ) : null}
          </span>
        </a>
      )}

      {post.kind === "video" && post.media_path && (
        <VideoPlayer
          src={`/api/media/${post.id}`}
          type={post.media_type || "video/mp4"}
        />
      )}

      {post.kind === "video" && post.has_file === 1 && post.media_path && (
        <a className="file-button" href={`/api/media/${post.id}?download=1`} download dir="ltr">
          <svg className="file-button__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          <span className="file-button__name">{post.file_name || post.media_name || post.title}</span>
          <span className="file-button__meta">
            {post.file_size ? formatFileSize(post.file_size) : post.media_size ? formatFileSize(post.media_size) : "File"}
            {post.download_count > 0 ? (<><span aria-hidden="true"> · </span><span>{formatCount(post.download_count)} تنزيل</span></>) : null}
          </span>
        </a>
      )}

      {(post.kind as string) === "file" && post.media_path && (
        <a
          className="file-button"
          href={`/api/media/${post.id}?download=1`}
          download
          dir="ltr"
        >
          <svg
            className="file-button__icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          <span className="file-button__name">
            {post.media_name || post.title}
          </span>
          <span className="file-button__meta">
            {post.media_size ? formatFileSize(post.media_size) : "File"}
            {post.download_count > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{formatCount(post.download_count)} تنزيل</span>
              </>
            ) : null}
          </span>
        </a>
      )}

      <div className="post-footer">
        <LikeButton
          count={likeCount}
          liked={liked}
          onToggle={toggleLike}
          busy={likeBusy}
        />
        <Link
          href={`/posts/${post.id}`}
          className="comment-toggle"
          aria-label="التعليقات"
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
          <span>
            {post.comment_count > 0
              ? formatCount(post.comment_count)
              : "تعليق"}
          </span>
        </Link>
      </div>
    </article>
  );
}

export function PostFeed({
  posts: initialPosts,
  idMap,
  total,
  pinned = false,
}: {
  posts: FeedPost[];
  idMap: Record<string, string>;
  /** Total published (non-pinned) posts; enables the load-more button. */
  total?: number;
  /** Pinned sections never paginate. */
  pinned?: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offset, setOffset] = useState(initialPosts.length);

  // State is seeded once from the server-rendered list; the load-more flow
  // appends to it client-side.

  const hasMore = !pinned && typeof total === "number" && posts.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/posts?offset=${offset}&limit=${FEED_PAGE_SIZE}`,
      );
      if (!response.ok) throw new Error("Failed to load more posts");
      const data = (await response.json()) as {
        posts: FeedPost[];
        total: number;
      };
      setPosts((current) => [...current, ...data.posts]);
      setOffset((current) => current + data.posts.length);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, offset]);

  if (posts.length === 0) {
    return (
      <div className="empty-feed">
        <span>m</span>
        <h3>أول منشور بالطريق</h3>
        <p>ارجع قريب، أي شيء جديد أشاركه راح تلقاه هنا.</p>
      </div>
    );
  }

  return (
    <>
      <div className="post-feed">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} idMap={idMap} lazy={index > 0} />
        ))}
      </div>
      {hasMore && (
        <div className="feed-load-more">
          {failed ? (
            <button type="button" className="feed-load-more__button" onClick={loadMore}>
              صار خطأ — حاول مرة ثانية
            </button>
          ) : (
            <button
              type="button"
              className="feed-load-more__button"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? "جاري التحميل..." : "عرض المزيد من المنشورات"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
