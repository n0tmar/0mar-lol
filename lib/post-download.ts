import type { PostRecord } from "@/lib/types";

export type PostDownloadFile = {
  path: string;
  name: string;
  type: string;
  size: number | null;
};

type DownloadablePost = Pick<
  PostRecord,
  | "kind"
  | "title"
  | "has_file"
  | "media_path"
  | "media_name"
  | "media_type"
  | "media_size"
  | "file_path"
  | "file_name"
  | "file_type"
  | "file_size"
>;

/**
 * Resolve the real downloadable file regardless of storage layout:
 *
 * - Current posts of every kind: file_*.
 * - Pre-migration text posts and legacy kind=file rows: media_* fallback.
 *
 * A row with has_file=1 but no corresponding path is inconsistent and does
 * not produce a download button.
 */
export function getPostDownloadFile(
  post: DownloadablePost,
): PostDownloadFile | null {
  const kind = post.kind as string;

  if (kind === "file") {
    if (!post.media_path) return null;
    return {
      path: post.media_path,
      name: post.media_name || post.title || "download",
      type: post.media_type || "application/octet-stream",
      size: post.media_size,
    };
  }

  if (post.has_file !== 1) return null;

  if (post.file_path) {
    return {
      path: post.file_path,
      name: post.file_name || post.title || "download",
      type: post.file_type || "application/octet-stream",
      size: post.file_size,
    };
  }

  // Compatibility while an old text row is being migrated at startup.
  if (kind === "text" && post.media_path) {
    return {
      path: post.media_path,
      name: post.media_name || post.title || "download",
      type: post.media_type || "application/octet-stream",
      size: post.media_size,
    };
  }

  return null;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "File";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCount(value: number) {
  if (value < 10000) return String(value);
  return `${Math.round(value / 1000)}K`;
}

export function formatDownloadCount(value: number): string {
  return `${formatCount(value)} تنزيل`;
}
