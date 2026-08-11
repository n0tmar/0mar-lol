"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostKind, PostRecord } from "@/lib/types";
import { Markdown } from "@/components/markdown";
import { FileUpload } from "@/components/file-upload";
import { getPostDownloadFile } from "@/lib/post-download";
import { normalizePostKind } from "@/lib/post-conversion";

const TOOLS = [
  { label: "B", title: "غامق", before: "**", after: "**" },
  { label: "I", title: "مائل", before: "*", after: "*" },
  { label: "H", title: "عنوان", before: "\n## ", after: "" },
  { label: "L", title: "رابط", before: "[", after: "](url)" },
  { label: "~", title: "كود", before: "`", after: "`" },
  { label: "{}", title: "كود متعدد", before: "\n```\n", after: "\n```\n" },
  { label: ">", title: "اقتباس", before: "\n> ", after: "" },
  { label: "-", title: "قائمة", before: "\n- ", after: "" },
  { label: "@", title: "ذكر منشور", before: "@", after: "" },
] as const;

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const replacement = before + selected + after;
  textarea.setRangeText(replacement, start, end, "select");
  if (start === end) {
    textarea.selectionStart = textarea.selectionEnd = start + before.length;
  }
  textarea.focus();
}

function kindLabel(kind: PostKind) {
  return kind === "image" ? "صورة" : kind === "video" ? "فيديو" : "نص";
}

function conversionMessage(
  currentKind: PostKind,
  targetKind: PostKind,
  keepsDownload: boolean,
) {
  const preserved = keepsDownload ? " ملف التحميل الحالي سيبقى محفوظاً." : "";
  const targetUpload =
    targetKind === "image" ? "صورة جديدة" : "فيديو جديداً";
  if (targetKind === "text") {
    const removal =
      currentKind === "image"
        ? "ستُزال الصورة المعروضة"
        : "سيُزال الفيديو المعروض";
    return `${removal} فقط بعد نجاح الحفظ، ويتحول المنشور إلى نص.${preserved}`;
  }
  if (currentKind === "text") {
    return `اختر ${targetUpload} لإتمام التحويل.${preserved}`;
  }
  const safeRemoval =
    currentKind === "image"
      ? "لن تُحذف الصورة الحالية"
      : "لن يُحذف الفيديو الحالي";
  return `اختر ${targetUpload}. ${safeRemoval} إلا بعد نجاح الحفظ.${preserved}`;
}

function Preview({ kind, title, body, mediaUrl, addFile, downloadName, idMap }: {
  kind: PostKind;
  title: string;
  body: string;
  mediaUrl: string | null;
  addFile: boolean;
  downloadName: string | null;
  idMap: Record<string, string>;
}) {
  return (
    <div className="composer-preview">
      <span className="composer-preview__label">معاينة</span>
      <div className="post-card">
        <div className="post-header">
          <div className="author">
            <span className="author-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="author-avatar" src="/avatar.jpg" alt="" />
            </span>
            <span>
              <strong>mar</strong>
              <small>الآن</small>
            </span>
          </div>
          <span className={`post-type post-type-${kind}`}>
            {kind === "image" ? "صورة" : kind === "video" ? "فيديو" : "نص"}
          </span>
        </div>
        <div className="post-copy">
          <h3>{title || "عنوان المنشور"}</h3>
          {body && <Markdown idMap={idMap}>{body}</Markdown>}
        </div>

        {kind === "image" && (
          mediaUrl ? (
            <div className="post-media image-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt={title || "صورة"} />
            </div>
          ) : (
            <div className="post-media image-media" style={{ background: "var(--bg-elev)", minHeight: 120, display: "grid", placeItems: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>صورة</p>
            </div>
          )
        )}

        {kind === "video" && (
          mediaUrl ? (
            <div className="post-media video-media">
              <video src={mediaUrl} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 620 }} />
            </div>
          ) : (
            <div className="post-media video-media" style={{ background: "#000", minHeight: 160, display: "grid", placeItems: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>فيديو</p>
            </div>
          )
        )}

        {addFile && downloadName && (
          <span className="file-button" dir="ltr" style={{ pointerEvents: "none" }}>
            <svg className="file-button__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
            </svg>
            <span className="file-button__name">{downloadName}</span>
            <span className="file-button__meta">File</span>
          </span>
        )}

        <div className="post-footer">
          <span />
          <span className="comment-toggle" style={{ color: "var(--muted)", fontSize: 12 }}>معاينة</span>
        </div>
      </div>
    </div>
  );
}

export function PostComposer({ idMap, post }: { idMap: Record<string, string>; post?: PostRecord }) {
  const editing = !!post;
  const originalKind = post
    ? (normalizePostKind(post.kind as string) ?? "text")
    : "text";
  const originalDownload = post ? getPostDownloadFile(post) : null;
  const originalVisualName =
    post && originalKind !== "text" && post.media_path
      ? post.media_name || post.title
      : null;
  const originalVisualUrl =
    post && originalKind !== "text" && post.media_path
      ? `/api/media/${post.id}${originalKind === "image" ? "?v=thumb" : ""}`
      : null;
  const originalDownloadName = originalDownload?.name ?? null;

  const [kind, setKind] = useState<PostKind>(originalKind);
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [mediaUrl, setMediaUrl] = useState<string | null>(originalVisualUrl);
  const [mediaName, setMediaName] = useState<string | null>(originalVisualName);
  const [addFile, setAddFile] = useState(!!originalDownload);
  const [downloadName, setDownloadName] = useState<string | null>(
    originalDownloadName,
  );
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaLabel = kind === "image" ? "الصورة" : "الفيديو";
  const accept = kind === "image" ? "image/*" : "video/*";
  const converting = editing && kind !== originalKind;

  // Load drafts only after hydration to avoid SSR/client mismatch.
  useEffect(() => {
    if (editing) return;
    const savedTitle = localStorage.getItem("draft-title");
    const savedBody = localStorage.getItem("draft-body");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional single hydration read
    if (savedTitle) setTitle(savedTitle);
    if (savedBody) setBody(savedBody);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editing is stable per mount
  }, []);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined" || editing) return;
    localStorage.setItem("draft-title", title);
    localStorage.setItem("draft-body", body);
  }, [title, body, editing]);

  useEffect(() => {
    if (editing) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDraft, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [saveDraft, editing]);

  useEffect(() => {
    return () => {
      if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  function handleSubmit() {
    if (!editing) {
      localStorage.removeItem("draft-title");
      localStorage.removeItem("draft-body");
    }
  }

  function handleKindChange(newKind: PostKind) {
    setKind(newKind);

    const canReuseVisual =
      editing && newKind === originalKind && newKind !== "text";
    setMediaUrl(canReuseVisual ? originalVisualUrl : null);
    setMediaName(canReuseVisual ? originalVisualName : null);

    // Download input stays mounted and keeps its native File selection:
    // attachments are independent from visual post kind.
  }

  function handleAddFileChange(checked: boolean) {
    setAddFile(checked);
    if (!checked) {
      setDownloadName(null);
    } else if (editing) {
      setDownloadName(originalDownloadName);
    }
  }

  function removeMedia() {
    setMediaUrl(null);
    setMediaName(null);
  }

  return (
    <div className="composer-layout">
      <form
        className="composer-form"
        action={editing ? `/api/admin/posts/${post!.id}/edit` : "/api/admin/posts"}
        method="post"
        encType="multipart/form-data"
        onSubmit={handleSubmit}
      >
        {editing && (
          <input type="hidden" name="revision" value={post!.updated_at} />
        )}
        <div className="form-grid">
          <label className="wide-field">
            <span>العنوان</span>
            <input
              name="title"
              required
              minLength={2}
              maxLength={120}
              placeholder="عنوان واضح وقصير"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="composer-kind">
            <span>نوع المنشور</span>
            <div
              className="composer-kind__options"
              aria-describedby={converting ? "post-conversion-note" : undefined}
            >
              {(["text", "image", "video"] as PostKind[]).map((option) => (
                <label
                  key={option}
                  className={`composer-kind__btn ${kind === option ? "is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={option}
                    checked={kind === option}
                    onChange={() => handleKindChange(option)}
                  />
                  <span>{kindLabel(option)}</span>
                </label>
              ))}
            </div>
            {converting && (
              <p
                id="post-conversion-note"
                className="composer-conversion-note"
                role="status"
              >
                {conversionMessage(originalKind, kind, !!originalDownload)}
              </p>
            )}
          </div>

          <div className="composer-toolbar">
              {TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  className="composer-toolbar__btn"
                  title={tool.title}
                  aria-label={tool.title}
                  onClick={() => {
                    const textarea = bodyRef.current;
                    if (!textarea) return;
                    insertAtCursor(textarea, tool.before, tool.after);
                  }}
                >
                  {tool.label}
                </button>
              ))}
            </div>

          <label className="wide-field">
            <span>{kind === "text" ? "النص" : "الوصف"}</span>
            <textarea
              ref={bodyRef}
              name="body"
              required={kind === "text" && !addFile}
              maxLength={5000}
              rows={kind === "text" ? 10 : 5}
              placeholder={
                kind === "text"
                  ? "اكتب المنشور... استخدم **غامق**، [رابط](url)، @post-id للإشارة لمنشور آخر"
                  : "اشرح للزائر ماذا سيشاهد أو يحمّل..."
              }
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          {kind !== "text" && (
            <div key="visual-upload" className="upload-field wide-field">
              <FileUpload
                key={`media-${kind}`}
                name="media"
                accept={accept}
                label={mediaLabel}
                required={!mediaName}
                file={mediaName ? { name: mediaName, size: 0 } : null}
                onSelect={(file) => {
                  setMediaUrl(URL.createObjectURL(file));
                  setMediaName(file.name);
                }}
                onRemove={removeMedia}
              />
            </div>
          )}

          {addFile && (
            <div key="download-upload" className="upload-field wide-field">
              <FileUpload
                name="file_upload"
                label="ملف للتحميل"
                required={!downloadName}
                file={downloadName ? { name: downloadName, size: 0 } : null}
                onSelect={(file) => setDownloadName(file.name)}
                onRemove={() => setDownloadName(null)}
              />
            </div>
          )}
        </div>

        <div className="composer-submit">
          <div className="composer-switches">
            <label className="switch-field">
              <input
                name="has_file"
                type="checkbox"
                checked={addFile}
                onChange={(event) => handleAddFileChange(event.target.checked)}
              />
              <span aria-hidden="true" />
              ملف للتحميل
            </label>
            <label className="switch-field">
              <input
                name="published"
                type="checkbox"
                defaultChecked={post ? post.published === 1 : true}
              />
              <span aria-hidden="true" />
              نشر مباشرة
            </label>
          </div>
          <button type="submit">
            {converting ? "تحويل وحفظ" : editing ? "حفظ التعديلات" : "نشر الآن"}
          </button>
        </div>
      </form>

      <Preview kind={kind} title={title} body={body} mediaUrl={mediaUrl} addFile={addFile} downloadName={downloadName} idMap={idMap} />
    </div>
  );
}
