import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getDataDirectory, getSupporter } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_PATH = /^uploads\/[a-f0-9-]+\.webp$/;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supporter = getSupporter(id);
  const requestedRevision = Number(request.nextUrl.searchParams.get("v"));
  if (
    !supporter?.avatar_path ||
    !AVATAR_PATH.test(supporter.avatar_path) ||
    !Number.isSafeInteger(requestedRevision) ||
    requestedRevision !== supporter.avatar_updated_at ||
    (supporter.visible !== 1 && !isAdminRequest(request))
  ) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(getDataDirectory(), supporter.avatar_path);
  if (!existsSync(filePath)) {
    return new Response("File missing", { status: 404 });
  }

  const size = statSync(filePath).size;
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(size),
      "Cache-Control":
        supporter.visible === 1
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
