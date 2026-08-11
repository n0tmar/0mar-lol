"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CommentRecord } from "@/lib/types";
import { buildFlatTree, type CommentNode } from "@/lib/comment-tree";
import { formatAbsoluteDate, formatRelativeDate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { UserAvatar } from "@/components/cat-avatar";
import { IconReply } from "@/components/icons";
import { VerifiedBadge } from "@/components/verified-badge";
import { OWNER_NAME } from "@/lib/constants";

const MAX_VISIBLE_REPLIES = 3;
const MAX_BODY = 500;

function Counter({ value, max }: { value: number; max: number }) {
  if (value === 0) return null;
  return (
    <span className="comment-counter">
      {value}/{max}
    </span>
  );
}

function CommentItem({
  node,
  onReply,
}: {
  node: CommentNode;
  onReply: (node: CommentNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function scrollToParent() {
    if (!node.parent_id) return;
    const el = document.getElementById(`comment-${node.parent_id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("comment-flash");
    window.setTimeout(() => el?.classList.remove("comment-flash"), 1500);
  }


  // Default view: only the owner's replies visible; everything else behind
  // "show all replies" when the thread has more than 2 replies.
  const totalReplies = node.children.length;
  const ownerReplies = node.children.filter((c) => c.name === OWNER_NAME);
  const collapsed = totalReplies > MAX_VISIBLE_REPLIES;
  const visibleReplies = expanded || !collapsed ? node.children : ownerReplies;

  return (
    <div className="comment-row" id={`comment-${node.id}`}>
      <div className="comment-bubble">
        <UserAvatar name={node.name} visitorId={node.visitor_id} size={32} />
        <div className="comment-content">
          <div className="comment-meta">
            <strong>{node.name}</strong>
            {node.name === OWNER_NAME && <VerifiedBadge size={15} />}
            {node.parent_name && (
              <button
                type="button"
                className="comment-reply-chip"
                title={`في رد على ${node.parent_name}`}
                onClick={scrollToParent}
              >
                <IconReply size={11} /> {node.parent_name}
              </button>
            )}
            <small title={formatAbsoluteDate(node.created_at)}>
              {formatRelativeDate(node.created_at)}
            </small>
            <button
              type="button"
              className="comment-reply-btn"
              onClick={() => onReply(node)}
            >
              رد
            </button>
          </div>
          <p>{node.body}</p>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="comment-children">
          {visibleReplies.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              onReply={onReply}
            />
          ))}
          {collapsed && !expanded && (
            <button
              type="button"
              className="comment-more-btn"
              onClick={() => setExpanded(true)}
            >
              عرض كل الردود ({totalReplies})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MainForm({
  postId,
  onPosted,
  replyTarget,
  onClearReply,
  focusSignal,
  initialName,
}: {
  postId: string;
  onPosted: () => void;
  replyTarget: { id: string; name: string } | null;
  onClearReply: () => void;
  focusSignal: number;
  initialName: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState(initialName ?? "");
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fall back to the locally remembered name (older visitors without a
  // server-side identity yet).
  useEffect(() => {
    if (initialName) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional single hydration read
    setName(localStorage.getItem("omar-comment-name") || "");
  }, [initialName]);

  // Reply requests focus the main composer.
  useEffect(() => {
    if (focusSignal === 0) return;
    textareaRef.current?.focus();
  }, [focusSignal]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    const formData = new FormData(event.currentTarget);
    formData.set("website", ""); // honeypot
    if (replyTarget) formData.set("parent_id", replyTarget.id);

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { message?: string };
      setNotice(result.message || "تعذر إرسال الرد. حاول مرة ثانية.");
      if (response.ok) {
        localStorage.setItem("omar-comment-name", name.trim());
        setBody("");
        onClearReply();
        haptic([8, 30, 12]);
        onPosted();
      }
    } catch {
      setNotice("تعذر إرسال الرد. تأكد من اتصالك وحاول مرة ثانية.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="comment-form comment-form--inline" onSubmit={submit}>
      {replyTarget && (
        <div className="comment-reply-target-bar">
          <IconReply size={12} />
          <span>رد على {replyTarget.name}</span>
          <button type="button" onClick={onClearReply} aria-label="إلغاء الرد">
            ✕
          </button>
        </div>
      )}
      <div className="comment-fields">
        <label>
          <input
            name="name"
            required
            minLength={2}
            maxLength={40}
            autoComplete="name"
            placeholder="اسمك"
            value={name}
            onChange={(event) => setName(event.target.value)}
            readOnly={!!initialName}
            className={initialName ? "comment-name-locked" : undefined}
            title={initialName ? "اسمك محفوظ ولا يمكن تغييره" : undefined}
          />
          {initialName && <span className="comment-name-hint">اسمك محفوظ</span>}
        </label>
        <label className="comment-body-field">
          <textarea
            ref={textareaRef}
            name="body"
            required
            minLength={2}
            maxLength={MAX_BODY}
            rows={3}
            placeholder="سؤال؟ اقتراح؟ اكتبه هنا..."
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
      </div>
      <div className="comment-submit-row">
        <button type="submit" disabled={submitting}>
          {submitting ? "جاري الإرسال..." : "إرسال"}
        </button>
        <Counter value={body.length} max={MAX_BODY} />
      </div>
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
    </form>
  );
}

export function CommentSection({
  postId,
  initialComments,
  initialTotal,
  initialName = null,
}: {
  postId: string;
  initialComments: CommentRecord[];
  initialTotal: number;
  initialName?: string | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const tree = useMemo(() => buildFlatTree(comments), [comments]);

  async function refresh() {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (response.ok) {
        const data = (await response.json()) as { comments: CommentRecord[]; total: number };
        setComments(data.comments);
        setTotal(data.total);
      }
    } catch {
      // keep current list on failure
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments?offset=${comments.length}`);
      if (response.ok) {
        const data = (await response.json()) as { comments: CommentRecord[]; total: number };
        setComments((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...data.comments.filter((c) => !seen.has(c.id))];
        });
        setTotal(data.total);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="comments-section" aria-label="التعليقات">
      <div className="comment-sheet__list">
        {tree.length > 0 ? (
          <div className="comment-thread depth-0">
            {tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                onReply={(target) => {
                  setReplyTarget({ id: target.id, name: target.name });
                  setFocusSignal((s) => s + 1);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="comments-empty">لا يوجد تعليقات بعد. كن أول من يعلق.</p>
        )}
        {comments.length < total && (
          <button
            type="button"
            className="comments-more-btn"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "جاري التحميل..." : `عرض المزيد (${total - comments.length})`}
          </button>
        )}
      </div>
      <MainForm
        postId={postId}
        onPosted={() => void refresh()}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
        focusSignal={focusSignal}
        initialName={initialName}
      />
    </section>
  );
}
