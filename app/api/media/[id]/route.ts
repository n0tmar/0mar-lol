import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { getDataDirectory, getPost, incrementDownloadCount } from "@/lib/db";
import { isAdminRequest } from "@/lib/auth";
import { getPostDownloadFile } from "@/lib/post-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/ogg",
  "application/pdf",
  "text/plain",
]);

function inlineSafe(type: string | null) {
  return !!type && INLINE_TYPES.has(type.toLowerCase());
}

function resolveMediaPath(mediaPath: string) {
  if (mediaPath.startsWith("public/")) {
    return path.join(
      /* turbopackIgnore: true */ process.cwd(),
      mediaPath,
    );
  }
  return path.join(
    /* turbopackIgnore: true */ getDataDirectory(),
    mediaPath,
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const post = getPost(id);

  if (!post) {
    return new Response("Not found", { status: 404 });
  }
  if (post.published !== 1 && !isAdminRequest(request)) {
    return new Response("Not found", { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const useThumb =
    !download &&
    request.nextUrl.searchParams.get("v") === "thumb" &&
    post.kind === "image" &&
    post.thumb_path;
  const downloadFile = download ? getPostDownloadFile(post) : null;

  // has_file=1 must map to a real attachment. Never silently fall back to
  // downloading the preview image/video for an inconsistent row.
  if (download && post.has_file === 1 && !downloadFile) {
    return new Response("Download missing", { status: 404 });
  }

  const servePath = downloadFile
    ? downloadFile.path
    : useThumb
      ? post.thumb_path!
      : post.media_path;
  if (!servePath) {
    return new Response("Not found", { status: 404 });
  }

  const serveName = downloadFile?.name ?? post.media_name ?? "download";
  const serveType = useThumb
    ? "image/webp"
    : downloadFile?.type ?? post.media_type ?? "application/octet-stream";

  const filePath = resolveMediaPath(servePath);
  if (!existsSync(filePath)) {
    return new Response("File missing", { status: 404 });
  }

  // Count only successful, real downloads after confirming bytes exist.
  // Current attachments live in file_*; legacy file rows use media_*.
  if (downloadFile) incrementDownloadCount(id);

  // Unknown/executable types are forced to download — never rendered inline
  // (blocks SVG/HTML XSS in same-origin contexts).
  const inline = !download && inlineSafe(serveType);
  const finalType = inline ? serveType : "application/octet-stream";
  const disposition = inline ? "inline" : "attachment";

  const fileSize = statSync(filePath).size;
  const range = request.headers.get("range");
  const filename = serveName.replaceAll('"', "");
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": finalType,
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) return new Response("Invalid range", { status: 416 });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2]
      ? Math.min(Number(match[2]), fileSize - 1)
      : fileSize - 1;
    if (start > end || start >= fileSize) {
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const stream = Readable.toWeb(
      createReadStream(filePath, { start, end }),
    ) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      ...commonHeaders,
      "Content-Length": String(fileSize),
    },
  });
}
