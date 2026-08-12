import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import {
  deleteSupporter,
  getSupporter,
  moveSupporter,
  updateSupporter,
} from "@/lib/db";
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

  const { id } = await context.params;
  const supporter = getSupporter(id);
  if (!supporter) return redirectWithError(request, "الداعم غير موجود.");

  const formData = await request.formData();
  const action = String(formData.get("action") || "");

  if (action === "delete") {
    deleteSupporter(id);
    revalidatePath("/support");
    return NextResponse.redirect(
      dashboardRedirectUrl(request, "/supporters?deleted=1"),
      303,
    );
  }

  if (action === "move_up" || action === "move_down") {
    const moved = moveSupporter(id, action === "move_up" ? "up" : "down");
    if (!moved) return redirectWithError(request, "تعذر تغيير ترتيب الداعم.");
    revalidatePath("/support");
    return NextResponse.redirect(
      dashboardRedirectUrl(request, "/supporters?moved=1"),
      303,
    );
  }

  if (action !== "update") {
    return redirectWithError(request, "إجراء غير معروف.");
  }

  const expectedUpdatedAt = Number(formData.get("expected_updated_at"));
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1) {
    return redirectWithError(request, "حدّث الصفحة ثم حاول مرة أخرى.");
  }

  const parsed = parseSupporterInput({
    name: String(formData.get("name") || ""),
    tiktok: String(formData.get("tiktok") || ""),
    detail: String(formData.get("detail") || ""),
    visible: formData.get("visible") === "on",
  });
  if (!parsed.ok) return redirectWithError(request, parsed.error);

  try {
    const result = updateSupporter(
      id,
      parsed.value,
      expectedUpdatedAt,
    );
    if (Number(result.changes) !== 1) {
      return redirectWithError(
        request,
        "تم تعديل الداعم من جلسة أخرى. حدّث الصفحة ثم حاول مجدداً.",
      );
    }
  } catch (error) {
    console.error("[supporters] failed to update supporter", error);
    const duplicate =
      error instanceof Error &&
      error.message.includes("supporters.tiktok_handle");
    return redirectWithError(
      request,
      duplicate
        ? "حساب تيك توك مضاف لداعم آخر."
        : "تعذر حفظ تفاصيل الداعم. حاول مرة أخرى.",
    );
  }

  revalidatePath("/support");
  return NextResponse.redirect(
    dashboardRedirectUrl(request, "/supporters?updated=1"),
    303,
  );
}
