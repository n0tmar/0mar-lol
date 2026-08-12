import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDirectory, getDatabase } from "@/lib/db";
import { SUPPORTER_AVATAR_MAX_BYTES } from "@/lib/supporters";
import type { PostKind } from "@/lib/types";
import sharp from "sharp";

export async function saveFile(buffer: Buffer, upload: File) {
  const rawExtension = path.extname(upload.name).toLowerCase();
  const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : "";
  const storedName = `${randomUUID()}${extension}`;
  const uploadDirectory = path.join(getDataDirectory(), "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, storedName), buffer);
  return {
    path: `uploads/${storedName}`,
    name: upload.name.slice(0, 180),
    type: upload.type || "application/octet-stream",
    size: buffer.length,
  };
}

export async function saveUpload(upload: File) {
  return saveFile(Buffer.from(await upload.arrayBuffer()), upload);
}

export async function makeImageThumb(buffer: Buffer): Promise<{
  thumbPath: string;
  width: number | null;
  height: number | null;
}> {
  // Instagram-style: keep the full image, cap only the long edge at 1080px
  // (fit: inside preserves aspect ratio; withoutEnlargement leaves small
  // images untouched at their original size).
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 1080, height: 1080, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // Read dims from the actual thumb (post-EXIF-rotation, post-resize)
  // so width/height attributes always match the bytes being served.
  const thumbMeta = await sharp(thumbBuffer).metadata();
  const width = thumbMeta.width && thumbMeta.height ? thumbMeta.width : null;
  const height = thumbMeta.width && thumbMeta.height ? thumbMeta.height : null;

  const thumbName = `${randomUUID()}.webp`;
  const uploadDirectory = path.join(getDataDirectory(), "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, thumbName), thumbBuffer);

  return { thumbPath: `uploads/${thumbName}`, width, height };
}

/** Normalize an admin-uploaded supporter avatar to a safe, compact WebP. */
export async function saveSupporterAvatar(upload: File) {
  if (upload.size > SUPPORTER_AVATAR_MAX_BYTES) {
    throw new Error("Supporter avatar exceeds size limit");
  }

  const buffer = Buffer.from(await upload.arrayBuffer());
  const options = { limitInputPixels: 40_000_000 } as const;
  const metadata = await sharp(buffer, options).metadata();
  if (
    !metadata.format ||
    !["jpeg", "png", "webp", "avif", "gif"].includes(metadata.format)
  ) {
    throw new Error("Unsupported supporter avatar format");
  }

  // Public avatars render at 38px. A 192px square covers high-DPI screens,
  // while stripping metadata and keeping each request/storage footprint tiny.
  const avatarBuffer = await sharp(buffer, options)
    .rotate()
    .resize(192, 192, { fit: "cover", position: "attention" })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const avatarName = `${randomUUID()}.webp`;
  const uploadDirectory = path.join(getDataDirectory(), "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, avatarName), avatarBuffer);

  return {
    path: `uploads/${avatarName}`,
    type: "image/webp" as const,
    size: avatarBuffer.length,
  };
}

/** Save validated visual media and produce canonical image metadata. */
export async function saveVisualUpload(
  upload: File,
  kind: Exclude<PostKind, "text">,
) {
  const buffer = Buffer.from(await upload.arrayBuffer());

  if (kind === "video") {
    const saved = await saveFile(buffer, upload);
    return {
      ...saved,
      width: null,
      height: null,
      thumbPath: null,
    };
  }

  const thumb = await makeImageThumb(buffer);
  try {
    const saved = await saveFile(buffer, upload);
    return { ...saved, ...thumb };
  } catch (error) {
    await deleteUploadedFiles([thumb.thumbPath]);
    throw error;
  }
}

export async function deleteUploadedFiles(files: (string | null | undefined)[]) {
  const uploadDirectory = path.join(getDataDirectory(), "uploads");
  const safePaths = files.flatMap((file) => {
    if (!file?.startsWith("uploads/")) return [];
    const filename = file.slice("uploads/".length);
    // Database values are not trusted as filesystem paths. Stored uploads
    // are always direct children; reject traversal or nested paths.
    if (!filename || path.basename(filename) !== filename) return [];
    return [path.join(uploadDirectory, filename)];
  });
  await Promise.all(safePaths.map((file) => unlink(file).catch(() => {})));
}

/**
 * Remove files in uploads/ that no post or supporter references (deleted
 * records, manual DB edits, failed writes). Runs once at server startup,
 * before the server accepts requests, so no in-flight upload can be touched.
 *
 * Draft posts and hidden supporters still count as references. Only files
 * under uploads/ are considered — public/ assets are never touched.
 */
export async function cleanupOrphanedUploads(): Promise<number> {
  const uploadsDir = path.join(getDataDirectory(), "uploads");
  let entries;
  try {
    entries = await readdir(uploadsDir, { withFileTypes: true });
  } catch {
    return 0; // no uploads directory yet
  }

  const database = getDatabase();
  const postRows = database
    .prepare("SELECT media_path, thumb_path, file_path FROM posts")
    .all() as {
    media_path: string | null;
    thumb_path: string | null;
    file_path: string | null;
  }[];
  const supporterRows = database
    .prepare("SELECT avatar_path FROM supporters")
    .all() as { avatar_path: string | null }[];
  const referenced = new Set<string>();
  for (const row of postRows) {
    for (const value of [row.media_path, row.thumb_path, row.file_path]) {
      if (value?.startsWith("uploads/")) {
        referenced.add(value.slice("uploads/".length));
      }
    }
  }
  for (const row of supporterRows) {
    if (row.avatar_path?.startsWith("uploads/")) {
      referenced.add(row.avatar_path.slice("uploads/".length));
    }
  }

  let removed = 0;
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && !referenced.has(entry.name))
      .map(async (entry) => {
        try {
          await unlink(path.join(uploadsDir, entry.name));
          removed += 1;
        } catch {
          // Best effort — a file that cannot be unlinked is left for the
          // next startup rather than crashing the server.
        }
      }),
  );

  if (removed > 0) {
    console.log(`[uploads] removed ${removed} orphaned file(s) at startup.`);
  }
  return removed;
}
