import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPost, toggleLike } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const post = getPost(id);
  if (!post || post.published !== 1) {
    return NextResponse.json({ message: "المنشور غير موجود." }, { status: 404 });
  }

  const existingVisitor = request.cookies.get("omar_visitor_id")?.value;
  const visitorId = existingVisitor || randomUUID();
  const result = toggleLike(id, visitorId);
  const response = NextResponse.json(result);

  if (!existingVisitor) {
    response.cookies.set("omar_visitor_id", visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
