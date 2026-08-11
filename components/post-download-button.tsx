import type { PostRecord } from "@/lib/types";
import {
  formatDownloadCount,
  formatFileSize,
  getPostDownloadFile,
} from "@/lib/post-download";

type DownloadButtonPost = Pick<
  PostRecord,
  | "id"
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
  | "download_count"
>;

/** One renderer for text files, image/video attachments and legacy files. */
export function PostDownloadButton({ post }: { post: DownloadButtonPost }) {
  const file = getPostDownloadFile(post);
  if (!file) return null;

  return (
    <a
      className="file-button"
      href={`/api/media/${post.id}?download=1`}
      download
      dir="ltr"
      aria-label={`تحميل ${file.name}`}
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
      <span className="file-button__name">{file.name}</span>
      <span className="file-button__meta">
        {formatFileSize(file.size)}
        {post.download_count > 0 ? (
          <>
            <span aria-hidden="true"> · </span>
            <span>{formatDownloadCount(post.download_count)}</span>
          </>
        ) : null}
      </span>
    </a>
  );
}
