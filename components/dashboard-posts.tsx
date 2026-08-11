"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PostRecord } from "@/lib/types";
import { formatRelativeDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { CopyId } from "@/components/copy-id";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PostDownloadButton } from "@/components/post-download-button";
import { IconComment, IconDownload, IconEdit, IconEye, IconEyeOff, IconFile, IconHeart, IconImage, IconPin, IconText, IconTrash, IconVideo } from "@/components/icons";

type DashPost = PostRecord;

function postType(type: string) {
  if (type === "image") return "صورة";
  if (type === "video") return "فيديو";
  if (type === "file") return "ملف";
  return "نص";
}

function TypeIcon({ kind }: { kind: string }) {
  if (kind === "image") return <IconImage size={13} />;
  if (kind === "video") return <IconVideo size={13} />;
  if ((kind as string) === "file") return <IconFile size={13} />;
  return <IconText size={13} />;
}

function PostPreview({ post, idMap }: { post: DashPost; idMap: Record<string, string> }) {
  return (
    <div className="dash-preview">
      <div className="post-card">
        <div className="post-header">
          <div className="author">
            <span className="author-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="author-avatar" src="/avatar.jpg" alt="" />
            </span>
            <span>
              <strong>mar</strong>
              <small>{formatRelativeDate(post.created_at)}</small>
            </span>
          </div>
          <span className={`post-type post-type-${post.kind}`}>
            {postType(post.kind)}
          </span>
        </div>
        <div className="post-copy">
          <h3>{post.title}</h3>
          {post.body && <Markdown idMap={idMap}>{post.body}</Markdown>}
        </div>
        {post.kind === "image" && post.media_path && (
          <div className="post-media image-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${post.id}?v=thumb`} alt={post.title} width={post.width ?? undefined} height={post.height ?? undefined} />
          </div>
        )}
        {post.kind === "video" && post.media_path && (
          <div className="post-media video-media">
            <video src={`/api/media/${post.id}`} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 320 }} />
          </div>
        )}
        <PostDownloadButton post={post} />
        <div className="post-footer">
          <span className="like-button" style={{ color: "var(--muted)", fontSize: 12 }}>
            <IconHeart size={14} /> {post.like_count}
          </span>
          <Link
            href={`/posts/${post.id}`}
            className="comment-toggle"
            target="_blank"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            <IconComment size={14} /> {post.comment_count} تعليق · فتح المنشور ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

const TYPE_FILTERS = [
  { value: "all", label: "كل الأنواع" },
  { value: "text", label: "نص" },
  { value: "image", label: "صورة" },
  { value: "video", label: "فيديو" },
  { value: "file", label: "ملف" },
] as const;

function PostCard({
  post,
  selected,
  onToggle,
  base,
}: {
  post: DashPost;
  selected: boolean;
  onToggle: () => void;
  base: string;
}) {
  const [published, setPublished] = useState(post.published === 1);
  const [pinned, setPinned] = useState(post.pinned === 1);
  const [busy, setBusy] = useState(false);

  async function togglePublish() {
    if (busy) return;
    setBusy(true);
    const next = !published;
    setPublished(next); // optimistic
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: next ? "publish" : "unpublish" }),
      });
      if (!response.ok) throw new Error("Publish update failed");
    } catch {
      setPublished(post.published === 1); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    if (busy) return;
    setBusy(true);
    const next = !pinned;
    setPinned(next); // optimistic
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: next ? "pin" : "unpin" }),
      });
      if (!response.ok) throw new Error("Pin update failed");
    } catch {
      setPinned(post.pinned === 1); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`dash-post-card ${selected ? "is-active" : ""}`}>
      <div className="dash-post-card__top">
        <span className="dash-post-card__type">
          <TypeIcon kind={post.kind} />
          {postType(post.kind)}
        </span>
        <small className={published ? "dash-tag--live" : "dash-tag--draft"}>
          {published ? "منشور" : "مخفي"}
        </small>
        {pinned && <small className="dash-tag--pinned">مثبت</small>}
        <div
          className="dash-post-card__actions"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CopyId id={post.id} />
          <Link
            className="dash-icon-btn"
            href={`${base}/edit/${post.id}`}
            title="تعديل"
            aria-label="تعديل"
            onClick={(e) => e.stopPropagation()}
          >
            <IconEdit size={14} />
          </Link>
          <button
            className={`dash-icon-btn ${pinned ? "is-active" : ""}`}
            type="button"
            title={pinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}
            aria-label={pinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void togglePin();
            }}
          >
            <IconPin size={14} />
          </button>
          <button
            className="dash-icon-btn"
            type="button"
            title={published ? "إخفاء" : "نشر"}
            aria-label={published ? "إخفاء" : "نشر"}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void togglePublish();
            }}
          >
            {published ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
          <ConfirmDelete
            action={`/api/admin/posts/${post.id}`}
            message="حذف هذا المنشور نهائياً؟ سيُحذف الملف المرفوع أيضاً."
          >
            <button
              className="dash-icon-btn dash-icon-btn--danger"
              type="submit"
              title="حذف"
              aria-label="حذف"
            >
              <IconTrash size={14} />
            </button>
          </ConfirmDelete>
        </div>
      </div>
      <button
        type="button"
        className="dash-post-card__title"
        aria-expanded={selected}
        onClick={onToggle}
      >
        {post.title}
      </button>
      <div className="dash-post-card__meta">
        <span className="dash-meta__item">
          <IconHeart size={13} /> {post.like_count}
        </span>
        <span className="dash-meta__item">
          <IconDownload size={13} /> {post.download_count}
        </span>
        <span className="dash-meta__item">
          <IconComment size={13} /> {post.comment_count}
        </span>
        <span className="dash-post-card__date">{formatRelativeDate(post.created_at)}</span>
      </div>
    </article>
  );
}

export function DashboardPosts({
  posts,
  idMap,
  base,
}: {
  posts: DashPost[];
  idMap: Record<string, string>;
  base: string;
}) {
  const [selected, setSelected] = useState<DashPost | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]["value"]>("all");
  const previewDialogRef = useRef<HTMLDialogElement | null>(null);

  function closePreview() {
    previewDialogRef.current?.close();
  }

  useEffect(() => {
    if (!selected) return;
    const dialog = previewDialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (typeFilter !== "all" && (post.kind as string) !== typeFilter) return false;
      if (needle && !post.title.toLowerCase().includes(needle) && !post.body.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [posts, query, typeFilter]);

  return (
    <>
      {selected && (
        <dialog
          ref={previewDialogRef}
          className="dash-preview-dialog"
          aria-label="معاينة المنشور"
          onClose={() => setSelected(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <button
            type="button"
            className="dash-preview-close"
            aria-label="إغلاق"
            onClick={closePreview}
            autoFocus
          >
            ✕
          </button>
          <PostPreview post={selected} idMap={idMap} />
        </dialog>
      )}

      <div className="dash-page">
        <h1 className="dash-page__title">
          المنشورات
          <span
            className="dash-page__count"
            title={
              filtered.length === posts.length
                ? undefined
                : `${filtered.length} من أصل ${posts.length} منشور`
            }
          >
            {filtered.length === posts.length ? posts.length : `${filtered.length}/${posts.length}`}
          </span>
        </h1>

        <div className="dash-toolbar">
          <input
            className="dash-search"
            type="search"
            placeholder="ابحث في العناوين والنصوص..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="بحث في المنشورات"
          />
          <select
            className="dash-type-select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            aria-label="تصفية حسب النوع"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="dash-empty">
            {posts.length === 0 ? "لا منشورات حتى الآن." : "لا نتائج مطابقة."}
          </p>
        ) : (
          <div className="dash-list">
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                selected={selected?.id === post.id}
                onToggle={() => setSelected(selected?.id === post.id ? null : post)}
                base={base}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
