import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { createSupporter } from "@/lib/db";
import {
  parseSupporterInput,
  validateSupporterAvatarUpload,
} from "@/lib/supporters";
import { deleteUploadedFiles, saveSupporterAvatar } from "@/lib/uploads";
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

  const avatarValue = formData.get("avatar");
  const avatarUpload =
    avatarValue instanceof File && avatarValue.size > 0 ? avatarValue : null;
  if (avatarUpload) {
    const avatarError = validateSupporterAvatarUpload(avatarUpload);
    if (avatarError) return redirectWithError(request, avatarError);
  }

  let savedAvatar: Awaited<ReturnType<typeof saveSupporterAvatar>> | null = null;
  if (avatarUpload) {
    try {
      savedAvatar = await saveSupporterAvatar(avatarUpload);
    } catch (error) {
      console.error("[supporters] failed to process avatar", error);
      return redirectWithError(
        request,
        "تعذر معالجة صورة الداعم. تأكد أنها صورة سليمة.",
      );
    }
  }

  try {
    createSupporter(parsed.value, savedAvatar?.path ?? null);
  } catch (error) {
    await deleteUploadedFiles([savedAvatar?.path]);
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
