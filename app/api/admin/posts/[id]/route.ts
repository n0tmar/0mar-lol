import { dashboardRedirectUrl } from "@/lib/url";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import {
  deletePost,
  getDataDirectory,
  getPost,
  setPostPinned,
  setPostPublished,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(dashboardRedirectUrl(request, "/login"), 303);
  }
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const action = String(formData.get("action") || "");
  const post = getPost(id);
  if (!post) {
    return NextResponse.redirect(dashboardRedirectUrl(request, "?error=missing"), 303);
  }

  if (action === "publish") setPostPublished(id, true);
  if (action === "unpublish") setPostPublished(id, false);
  if (action === "pin") setPostPinned(id, true);
  if (action === "unpin") setPostPinned(id, false);
  if (action === "delete") {
    deletePost(id);
    const uploadsDir = getDataDirectory();
    for (const file of [post.media_path, post.thumb_path, post.file_path]) {
      if (file?.startsWith("uploads/")) {
        await unlink(path.join(uploadsDir, file)).catch(() => {});
      }
    }
  }

  return NextResponse.redirect(dashboardRedirectUrl(request, ""), 303);
}
