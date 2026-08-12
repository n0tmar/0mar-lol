import { dashboardRedirectUrl } from "@/lib/url";
import { after, NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { createPost, type PostKind } from "@/lib/db";
import { sendNewPostEmailNotification } from "@/lib/email-notifications";
import {
  deleteUploadedFiles,
  saveUpload,
  saveVisualUpload,
} from "@/lib/uploads";

export const runtime = "nodejs";
const maxUploadSize = 100 * 1024 * 1024;
const validKinds = new Set<PostKind>(["text", "image", "video"]);

function fail(request: NextRequest, code: string) {
  return NextResponse.redirect(
    dashboardRedirectUrl(request, `?error=${encodeURIComponent(code)}`),
    303,
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request))
    return NextResponse.redirect(dashboardRedirectUrl(request, "/login"), 303);
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const kind = String(formData.get("kind") || "") as PostKind;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const published = formData.get("published") === "on";
  const hasFile = formData.get("has_file") === "on";
  const media = formData.get("media");
  const file = formData.get("file_upload");
  const mediaCandidate =
    media instanceof File && media.size > 0 ? media : null;
  const fileCandidate = file instanceof File && file.size > 0 ? file : null;
  const visualUpload = kind === "text" ? null : mediaCandidate;
  // Compatibility for a form opened before deployment: old text composers
  // submitted their download through `media` instead of `file_upload`.
  const downloadUpload =
    fileCandidate ?? (kind === "text" ? mediaCandidate : null);

  if (!validKinds.has(kind) || title.length < 2 || title.length > 120)
    return fail(request, "تحقق من نوع المنشور والعنوان.");
  if (body.length > 5000)
    return fail(request, "النص أطول من الحد المسموح.");
  if (kind === "text" && !hasFile && body.length < 2)
    return fail(request, "أضف نص المنشور.");
  if (kind !== "text" && !visualUpload)
    return fail(request, "اختر ملفاً للمنشور.");
  if (visualUpload && visualUpload.size > maxUploadSize)
    return fail(request, "حجم الملف أكبر من 100 ميجابايت.");
  if (downloadUpload && downloadUpload.size > maxUploadSize)
    return fail(request, "حجم ملف التحميل أكبر من 100 ميجابايت.");
  if (visualUpload && kind === "image" && !visualUpload.type.startsWith("image/"))
    return fail(request, "الملف المختار ليس صورة.");
  if (visualUpload && kind === "video" && !visualUpload.type.startsWith("video/"))
    return fail(request, "الملف المختار ليس فيديو.");
  if (hasFile && !downloadUpload)
    return fail(request, "اختر ملف التحميل.");

  let visual: Awaited<ReturnType<typeof saveVisualUpload>> | null = null;
  let download: Awaited<ReturnType<typeof saveUpload>> | null = null;
  const createdFiles: (string | null)[] = [];

  if (visualUpload && kind !== "text") {
    try {
      visual = await saveVisualUpload(visualUpload, kind);
      createdFiles.push(visual.path, visual.thumbPath);
    } catch (error) {
      console.error("[posts] failed to save visual upload", error);
      return fail(
        request,
        kind === "image"
          ? "تعذر معالجة الصورة. تأكد أنها صورة سليمة."
          : "تعذر حفظ الفيديو.",
      );
    }
  }

  if (hasFile && downloadUpload) {
    try {
      download = await saveUpload(downloadUpload);
      createdFiles.push(download.path);
    } catch (error) {
      await deleteUploadedFiles(createdFiles);
      console.error("[posts] failed to save download upload", error);
      return fail(request, "تعذر حفظ ملف التحميل.");
    }
  }

  let postId: string;
  try {
    postId = createPost({
      kind,
      title,
      body,
      mediaPath: visual?.path ?? null,
      mediaName: visual?.name ?? null,
      mediaType: visual?.type ?? null,
      mediaSize: visual?.size ?? null,
      published,
      hasFile,
      filePath: download?.path ?? null,
      fileName: download?.name ?? null,
      fileType: download?.type ?? null,
      fileSize: download?.size ?? null,
      width: visual?.width ?? null,
      height: visual?.height ?? null,
      thumbPath: visual?.thumbPath ?? null,
    });
  } catch (error) {
    await deleteUploadedFiles(createdFiles);
    console.error("[posts] failed to create post", error);
    return fail(request, "تعذر حفظ المنشور. حاول مرة أخرى.");
  }

  if (published) {
    after(async () => {
      try {
        await sendNewPostEmailNotification({ id: postId, title });
      } catch (error) {
        console.error("[email-notifications] failed to send new post", error);
      }
    });
  }

  return NextResponse.redirect(dashboardRedirectUrl(request, "?created=1"), 303);
}
