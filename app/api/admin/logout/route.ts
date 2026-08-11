import { dashboardRedirectUrl } from "@/lib/url";
import { NextRequest, NextResponse } from "next/server";
import {
  assertSameOrigin,
  sessionCookieName,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // After logout land on the login page (root on the dashboard subdomain).
  const response = NextResponse.redirect(dashboardRedirectUrl(request, "/login"), 303);
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
