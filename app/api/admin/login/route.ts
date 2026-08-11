import { NextRequest, NextResponse } from "next/server";
import {
  assertSameOrigin,
  clearLoginFailures,
  createSessionToken,
  isLoginLocked,
  recordLoginFailure,
  secureCookieOptions,
  sessionCookieName,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ip = clientIp(request);
    if (isLoginLocked(ip)) {
      return NextResponse.redirect(
        new URL("/dashboard/login?error=locked", request.url),
        303,
      );
    }
    const formData = await request.formData();
    const password = String(formData.get("password") || "");

    if (!verifyPassword(password)) {
      recordLoginFailure(ip);
      // Constant-ish delay so timing attacks gain nothing and brute force slows.
      await new Promise((resolve) => setTimeout(resolve, 400));
      return NextResponse.redirect(
        new URL("/dashboard/login?error=1", request.url),
        303,
      );
    }

    clearLoginFailures(ip);
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set(
      sessionCookieName,
      createSessionToken(),
      secureCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("login route error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/login?error=config", request.url),
      303,
    );
  }
}
