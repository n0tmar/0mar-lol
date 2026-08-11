import { getPostDownloadFile } from "./post-download.ts";
import type { PostKind, PostRecord } from "@/lib/types";

type ConvertiblePost = Pick<
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
  | "width"
  | "height"
  | "thumb_path"
>;

export type StoredFile = {
  path: string;
  name: string | null;
  type: string | null;
  size: number | null;
};

export type StoredVisual = StoredFile & {
  width: number | null;
  height: number | null;
  thumbPath: string | null;
};

export type PlannedVisual =
  | { source: "existing"; file: StoredVisual }
  | { source: "upload" };

export type PlannedDownload =
  | { source: "existing"; file: StoredFile }
  | { source: "upload" };

export type PostConversionPlan = {
  currentKind: PostKind;
  targetKind: PostKind;
  visual: PlannedVisual | null;
  download: PlannedDownload | null;
};

export type PostConversionError =
  | "invalid-current-kind"
  | "visual-required"
  | "download-required";

export type PostConversionResult =
  | { ok: true; plan: PostConversionPlan }
  | { ok: false; error: PostConversionError };

/** Normalize legacy `kind=file` rows into the supported text model. */
export function normalizePostKind(kind: string): PostKind | null {
  if (kind === "text" || kind === "image" || kind === "video") return kind;
  if (kind === "file") return "text";
  return null;
}

/**
 * Decide which existing bytes can be reused before writing anything.
 * Cross-kind visual conversions always require a replacement upload; download
 * files can survive every conversion because they have kind-independent
 * semantics in the canonical file_* slot.
 */
export function planPostConversion(
  post: ConvertiblePost,
  input: {
    targetKind: PostKind;
    hasFile: boolean;
    hasMediaUpload: boolean;
    hasDownloadUpload: boolean;
  },
): PostConversionResult {
  const currentKind = normalizePostKind(post.kind as string);
  if (!currentKind) return { ok: false, error: "invalid-current-kind" };

  let visual: PlannedVisual | null = null;
  if (input.targetKind !== "text") {
    if (input.hasMediaUpload) {
      visual = { source: "upload" };
    } else if (currentKind === input.targetKind && post.media_path) {
      visual = {
        source: "existing",
        file: {
          path: post.media_path,
          name: post.media_name,
          type: post.media_type,
          size: post.media_size,
          width: input.targetKind === "image" ? post.width : null,
          height: input.targetKind === "image" ? post.height : null,
          thumbPath: input.targetKind === "image" ? post.thumb_path : null,
        },
      };
    } else {
      return { ok: false, error: "visual-required" };
    }
  }

  let download: PlannedDownload | null = null;
  if (input.hasFile) {
    if (input.hasDownloadUpload) {
      download = { source: "upload" };
    } else {
      const existing = getPostDownloadFile(post);
      if (!existing) return { ok: false, error: "download-required" };
      download = {
        source: "existing",
        file: {
          path: existing.path,
          name: existing.name,
          type: existing.type,
          size: existing.size,
        },
      };
    }
  }

  return {
    ok: true,
    plan: {
      currentKind,
      targetKind: input.targetKind,
      visual,
      download,
    },
  };
}

/** Old uploads absent from the committed next state are safe to unlink. */
export function getObsoletePostFiles(
  post: Pick<PostRecord, "media_path" | "thumb_path" | "file_path">,
  retainedPaths: ReadonlyArray<string | null | undefined>,
): string[] {
  const retained = new Set(retainedPaths.filter((path): path is string => !!path));
  return [...new Set([post.media_path, post.thumb_path, post.file_path])].filter(
    (path): path is string => !!path && !retained.has(path),
  );
}
