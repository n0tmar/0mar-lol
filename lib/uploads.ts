import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDirectory } from "@/lib/db";
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
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
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
