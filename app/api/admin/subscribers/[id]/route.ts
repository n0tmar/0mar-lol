import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { deleteEmailSubscription } from "@/lib/db";
import { dashboardRedirectUrl } from "@/lib/url";

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

  const formData = await request.formData();
  if (formData.get("action") !== "delete") {
    return NextResponse.redirect(
      dashboardRedirectUrl(request, "/subscribers?error=1"),
      303,
    );
  }

  const { id } = await context.params;
  const result = deleteEmailSubscription(id);
  return NextResponse.redirect(
    dashboardRedirectUrl(
      request,
      Number(result.changes) === 1
        ? "/subscribers?deleted=1"
        : "/subscribers?error=1",
    ),
    303,
  );
}
