import { NextRequest, NextResponse } from "next/server";
import {
  addComment,
  countApprovedComments,
  countRecentComments,
  getPost,
  getVisitorName,
  listApprovedComments,
} from "@/lib/db";
import { anonymizeIp } from "@/lib/auth";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// Spam honeypot field name — real users never see it, bots fill it.
const HONEYPOT_FIELD = "website";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const post = getPost(id);
  if (!post || post.published !== 1) {
    return NextResponse.json({ message: "المنشور غير موجود." }, { status: 404 });
  }

  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const visitorId = request.cookies.get("omar_visitor_id")?.value;
  const visitorName = visitorId ? getVisitorName(visitorId) : null;

  return NextResponse.json({
    comments: listApprovedComments(id, PAGE_SIZE, offset),
    total: countApprovedComments(id),
    visitor_name: visitorName,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const post = getPost(id);
  if (!post || post.published !== 1) {
    return NextResponse.json({ message: "المنشور غير موجود." }, { status: 404 });
  }

  const formData = await request.formData();
  // Honeypot: silently accept bots without saving anything.
  if (String(formData.get(HONEYPOT_FIELD) || "").trim() !== "") {
    return NextResponse.json({ message: "تم نشر تعليقك." }, { status: 201 });
  }
  // Visitor identity: reuse the like cookie, create it if missing.
  let visitorId = request.cookies.get("omar_visitor_id")?.value;
  // Locked visitors submit no name field (readOnly input): fall back to the
  // name saved for this browser before ever defaulting to "زائر".
  const savedName = visitorId ? getVisitorName(visitorId) : null;
  const name =
    String(formData.get("name") || "").trim() || savedName || "زائر";
  const body = String(formData.get("body") || "").trim();
  const parentId = String(formData.get("parent_id") || "").trim() || null;

  if (name.length > 40) {
    return NextResponse.json(
      { message: "الاسم طويل جداً." },
      { status: 400 },
    );
  }

  if (body.length < 2 || body.length > 500) {
    return NextResponse.json(
      { message: "الرد يجب أن يكون بين حرفين و500 حرف." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = anonymizeIp(ip);
  const recent = countRecentComments(ipHash, Date.now() - 10 * 60 * 1000);

  if (recent >= 3) {
    return NextResponse.json(
      { message: "أرسلت عدة ردود بسرعة. انتظر قليلاً ثم حاول مرة ثانية." },
      { status: 429 },
    );
  }

  const response = NextResponse.json({ message: "تم نشر تعليقك." }, { status: 201 });
  if (!visitorId) {
    visitorId = randomUUID();
    response.cookies.set("omar_visitor_id", visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10, // remember the visitor for as long as possible
    });
  }

  addComment({ postId: id, name, body, ipHash, parentId, visitorId });
  return response;
}
