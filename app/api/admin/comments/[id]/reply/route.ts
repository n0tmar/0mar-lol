import { dashboardRedirectUrl } from "@/lib/url";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, anonymizeIp, isAdminRequest } from "@/lib/auth";
import { addComment, getComment } from "@/lib/db";
import { OWNER_NAME } from "@/lib/constants";

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
  const comment = getComment(id);
  if (!comment) {
    return NextResponse.redirect(
      dashboardRedirectUrl(request, "/comments?error=missing"),
      303,
    );
  }

  const formData = await request.formData();
  const body = String(formData.get("body") || "").trim();

  if (body.length < 2 || body.length > 500) {
    return NextResponse.redirect(
      dashboardRedirectUrl(request, "/comments?error=short"),
      303,
    );
  }

  addComment({
    postId: comment.post_id,
    name: OWNER_NAME,
    body,
    ipHash: anonymizeIp("admin"),
    parentId: comment.id,
  });

  return NextResponse.redirect(
    dashboardRedirectUrl(request, "/comments?replied=1"),
    303,
  );
}
