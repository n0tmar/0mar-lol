import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { createSupporter } from "@/lib/db";
import { parseSupporterInput } from "@/lib/supporters";
import { dashboardRedirectUrl } from "@/lib/url";

export const runtime = "nodejs";

function redirectWithError(request: NextRequest, message: string) {
  return NextResponse.redirect(
    dashboardRedirectUrl(
      request,
      `/supporters?error=${encodeURIComponent(message)}`,
    ),
    303,
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(dashboardRedirectUrl(request, "/login"), 303);
  }
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const parsed = parseSupporterInput({
    name: String(formData.get("name") || ""),
    tiktok: String(formData.get("tiktok") || ""),
    detail: String(formData.get("detail") || ""),
    visible: formData.get("visible") === "on",
  });
  if (!parsed.ok) return redirectWithError(request, parsed.error);

  try {
    createSupporter(parsed.value);
  } catch (error) {
    console.error("[supporters] failed to create supporter", error);
    const duplicate =
      error instanceof Error &&
      error.message.includes("supporters.tiktok_handle");
    return redirectWithError(
      request,
      duplicate
        ? "حساب تيك توك مضاف مسبقاً."
        : "تعذر إضافة الداعم. حاول مرة أخرى.",
    );
  }

  revalidatePath("/support");
  return NextResponse.redirect(
    dashboardRedirectUrl(request, "/supporters?created=1"),
    303,
  );
}
