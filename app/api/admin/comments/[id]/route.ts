import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { deleteComment } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url), 303);
  }
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const action = String(formData.get("action") || "");

  if (action === "delete") deleteComment(id);

  return NextResponse.redirect(new URL("/dashboard/comments", request.url), 303);
}
