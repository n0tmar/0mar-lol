import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDirectory, getDatabase } from "@/lib/db";
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

export async function deleteUploadedFiles(files: (string | null | undefined)[]) {
  const uploadsDir = getDataDirectory();
  await Promise.all(
    files
      .filter((file): file is string => !!file?.startsWith("uploads/"))
      .map((file) => unlink(path.join(uploadsDir, file)).catch(() => {})),
  );
}

/**
 * Remove files in uploads/ that no post references (deleted posts, manual
 * DB edits, failed publishes). Runs once at server startup, before the
 * server accepts requests, so no in-flight upload can be touched.
 *
 * Drafts count: an unpublished post still references its files, and those
 * must survive. Only files under uploads/ are considered — public/ assets
 * are never touched.
 */
export async function cleanupOrphanedUploads(): Promise<number> {
  const uploadsDir = path.join(getDataDirectory(), "uploads");
  let entries;
  try {
    entries = await readdir(uploadsDir, { withFileTypes: true });
  } catch {
    return 0; // no uploads directory yet
  }

  const rows = getDatabase()
    .prepare("SELECT media_path, thumb_path, file_path FROM posts")
    .all() as {
    media_path: string | null;
    thumb_path: string | null;
    file_path: string | null;
  }[];
  const referenced = new Set<string>();
  for (const row of rows) {
    for (const value of [row.media_path, row.thumb_path, row.file_path]) {
      if (value?.startsWith("uploads/")) {
        referenced.add(value.slice("uploads/".length));
      }
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
