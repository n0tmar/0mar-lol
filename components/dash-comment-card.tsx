"use client";

import { useState } from "react";
import { formatAbsoluteDate, formatRelativeDate } from "@/lib/format";
import { ConfirmDelete } from "@/components/confirm-delete";
import { IconReply, IconTrash } from "@/components/icons";
import { UserAvatar } from "@/components/cat-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { OWNER_NAME } from "@/lib/constants";

export type DashComment = {
  id: string;
  parent_id: string | null;
  parent_name?: string | null;
  name: string;
  body: string;
  created_at: number;
  children: DashComment[];
};

const MAX_VISIBLE_REPLIES = 3;

export function DashCommentCard({ comment }: { comment: DashComment }) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);

  // Default view: only the owner's replies visible; everything else behind
  // "show all replies" when the thread has more than 2 replies.
  const totalReplies = comment.children.length;
  const ownerReplies = comment.children.filter((c) => c.name === OWNER_NAME);
  const collapsed = totalReplies > MAX_VISIBLE_REPLIES;
  const shown = expanded || !collapsed ? comment.children : ownerReplies;

  function scrollToParent(id: string) {
    const el = document.getElementById(`dash-comment-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("comment-flash");
    window.setTimeout(() => el?.classList.remove("comment-flash"), 1500);
  }

  return (
    <div className="dash-comment-card" id={`dash-comment-${comment.id}`}>
      <div className="dash-comment-card__head">
        <UserAvatar name={comment.name} size={32} />
        <strong className="dash-comment-card__name">{comment.name}</strong>
        {comment.name === OWNER_NAME && <VerifiedBadge size={14} />}
        <span
          className="dash-comment-card__date"
          title={formatAbsoluteDate(comment.created_at)}
        >
          {formatRelativeDate(comment.created_at)}
        </span>
        <div className="dash-comment-card__actions">
          <button
            type="button"
            className={`dash-icon-btn ${replying ? "is-active" : ""}`}
            title="رد"
            aria-label="رد"
            aria-expanded={replying}
            onClick={() => setReplying((r) => !r)}
          >
            <IconReply size={14} />
          </button>
          <ConfirmDelete action={`/api/admin/comments/${comment.id}`}>
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
      <p className="dash-comment-card__body">{comment.body}</p>

      {comment.children.length > 0 && (
        <div className="dash-comment-children">
          {shown.map((child) => (
            <div className="dash-comment-card dash-comment-card--nested" key={child.id}>
              <div className="dash-comment-card__head">
                <UserAvatar name={child.name} size={26} />
                <strong className="dash-comment-card__name">{child.name}</strong>
                {child.name === OWNER_NAME && <VerifiedBadge size={14} />}
                <span
                  className="dash-comment-card__date"
                  title={formatAbsoluteDate(child.created_at)}
                >
                  {formatRelativeDate(child.created_at)}
                </span>
                <div className="dash-comment-card__actions">
                  <ConfirmDelete action={`/api/admin/comments/${child.id}`}>
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
              <p className="dash-comment-card__body">{child.body}</p>
              {child.parent_name && (
                <button
                  type="button"
                  className="comment-reply-chip"
                  title={`في رد على ${child.parent_name}`}
                  onClick={() => scrollToParent(child.parent_id!)}
                >
                  <IconReply size={11} /> {child.parent_name}
                </button>
              )}
            </div>
          ))}
          {collapsed && !expanded && (
            <button
              type="button"
              className="dash-comment-more-btn"
              onClick={() => setExpanded(true)}
            >
              عرض كل الردود ({totalReplies})
            </button>
          )}
        </div>
      )}

      {replying && (
        <form
          className="dash-comment-reply"
          action={`/api/admin/comments/${comment.id}/reply`}
          method="post"
        >
          <input
            type="text"
            name="body"
            required
            minLength={2}
            maxLength={500}
            placeholder={`رد على ${comment.name}...`}
            aria-label="رد"
            autoFocus
          />
          <button type="submit">رد</button>
        </form>
      )}
    </div>
  );
}
