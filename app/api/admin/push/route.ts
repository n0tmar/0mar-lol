import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import {
  deletePushSubscription,
  upsertPushSubscription,
} from "@/lib/db";
import {
  getVapidConfiguration,
  parsePushEndpoint,
  parsePushSubscription,
} from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: "غير مصرح." }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    return null;
  } catch {
    return NextResponse.json({ message: "طلب غير صالح." }, { status: 403 });
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    throw new Error("Payload too large");
  }
  return request.json();
}

export async function POST(request: NextRequest) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

  const vapid = getVapidConfiguration();
  if (!vapid) {
    return NextResponse.json(
      { message: "إشعارات الخادم غير مهيأة." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const subscription = parsePushSubscription(body);
  if (!subscription) {
    return NextResponse.json({ message: "اشتراك غير صالح." }, { status: 400 });
  }

  upsertPushSubscription(subscription, vapid.publicKey);
  return NextResponse.json({ subscribed: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const endpoint = parsePushEndpoint(
    body && typeof body === "object" && "endpoint" in body
      ? body.endpoint
      : null,
  );
  if (!endpoint) {
    return NextResponse.json({ message: "اشتراك غير صالح." }, { status: 400 });
  }

  deletePushSubscription(endpoint);
  return NextResponse.json({ subscribed: false });
}
