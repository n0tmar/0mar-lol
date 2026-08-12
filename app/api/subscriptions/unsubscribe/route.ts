import { NextRequest, NextResponse } from "next/server";
import { deleteEmailSubscriptionByToken } from "@/lib/db";
import { absoluteUrl } from "@/lib/url";

export const runtime = "nodejs";

const TOKEN = /^[A-Za-z0-9_-]{32}$/;

export async function POST(request: NextRequest) {
  const queryToken = request.nextUrl.searchParams.get("token");
  let token = queryToken;
  if (!token) {
    const formData = await request.formData();
    token = String(formData.get("token") || "");
  }

  if (!TOKEN.test(token || "")) {
    return queryToken
      ? new Response(null, { status: 400 })
      : NextResponse.redirect(absoluteUrl(request, "/unsubscribe?invalid=1"), 303);
  }

  deleteEmailSubscriptionByToken(token!);

  // RFC 8058 one-click requests carry the token in the URL and need only a
  // successful empty response. Human-facing forms return to a clear result.
  if (queryToken) return new Response(null, { status: 204 });
  return NextResponse.redirect(absoluteUrl(request, "/unsubscribe?done=1"), 303);
}
