import { NextRequest, NextResponse } from "next/server";
import { anonymizeIp, assertSameOrigin } from "@/lib/auth";
import {
  createEmailSubscription,
  getRecentEmailSubscriptionCount,
} from "@/lib/db";
import {
  EMAIL_SUBSCRIPTION_LIMIT,
  EMAIL_SUBSCRIPTION_WINDOW_MS,
  normalizeEmail,
} from "@/lib/email-subscriptions";
import { absoluteUrl } from "@/lib/url";

export const runtime = "nodejs";

function redirectWithStatus(request: NextRequest, status: string) {
  const url = absoluteUrl(request, `/?email_status=${status}`);
  url.hash = "email-updates";
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return redirectWithStatus(request, "invalid");
  }

  const formData = await request.formData();
  // Spam honeypot: bots receive the same success redirect, but nothing saves.
  if (String(formData.get("website") || "").trim()) {
    return redirectWithStatus(request, "subscribed");
  }

  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!email) return redirectWithStatus(request, "invalid");

  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const ipHash = anonymizeIp(ip);
  const recent = getRecentEmailSubscriptionCount(
    ipHash,
    Date.now() - EMAIL_SUBSCRIPTION_WINDOW_MS,
  );
  if (recent >= EMAIL_SUBSCRIPTION_LIMIT) {
    return redirectWithStatus(request, "limited");
  }

  try {
    // Duplicate addresses intentionally produce the same public response;
    // visitors cannot probe whether somebody else already subscribed.
    createEmailSubscription(email, ipHash);
  } catch (error) {
    console.error("[email-subscriptions] failed to save address", error);
    return redirectWithStatus(request, "failed");
  }

  return redirectWithStatus(request, "subscribed");
}
