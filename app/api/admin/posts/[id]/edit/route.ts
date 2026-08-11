import { dashboardRedirectUrl } from "@/lib/url";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { getPost, updatePost, type PostKind } from "@/lib/db";
import {
  getObsoletePostFiles,
  planPostConversion,
  type StoredFile,
  type StoredVisual,
} from "@/lib/post-conversion";
import {
  deleteUploadedFiles,
  saveUpload,
  saveVisualUpload,
} from "@/lib/uploads";

export const runtime = "nodejs";
const maxUploadSize = 100 * 1024 * 1024;
const validKinds = new Set<PostKind>(["text", "image", "video"]);

function fail(request: NextRequest, id: string, message: string) {
  return NextResponse.redirect(
    dashboardRedirectUrl(
      request,
      `/edit/${id}?error=${encodeURIComponent(message)}`,
    ),
    303,
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.redirect(dashboardRedirectUrl(request, "/login"), 303);
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const post = getPost(id);
  if (!post) {
    return NextResponse.redirect(
      dashboardRedirectUrl(request, "?error=missing"),
      303,
    );
  }

  const formData = await request.formData();
  const targetKind = String(formData.get("kind") || "") as PostKind;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const published = formData.get("published") === "on";
  const revisionValue = formData.get("revision");
  if (revisionValue !== null && revisionValue !== "") {
    const submittedRevision = Number(revisionValue);
    if (
      !Number.isSafeInteger(submittedRevision) ||
      submittedRevision !== post.updated_at
    ) {
      return fail(
        request,
        id,
        "تم تعديل المنشور من جلسة أخرى. حدّث الصفحة ثم حاول مجدداً.",
      );
    }
  }
  const hasFile = formData.get("has_file") === "on";
  const media = formData.get("media");
  const file = formData.get("file_upload");
  const mediaCandidate =
    media instanceof File && media.size > 0 ? media : null;
  const fileCandidate = file instanceof File && file.size > 0 ? file : null;
  const visualUpload = targetKind === "text" ? null : mediaCandidate;
  // Accept the pre-conversion text form during rolling deployments.
  const downloadUpload =
    fileCandidate ?? (targetKind === "text" ? mediaCandidate : null);

  if (!validKinds.has(targetKind) || title.length < 2 || title.length > 120)
    return fail(request, id, "تحقق من نوع المنشور والعنوان.");
  if (body.length > 5000)
    return fail(request, id, "النص أطول من الحد المسموح.");
  if (targetKind === "text" && !hasFile && body.length < 2)
    return fail(request, id, "أضف نص المنشور.");
  if (visualUpload && visualUpload.size > maxUploadSize)
    return fail(request, id, "حجم الملف أكبر من 100 ميجابايت.");
  if (downloadUpload && downloadUpload.size > maxUploadSize)
    return fail(request, id, "حجم ملف التحميل أكبر من 100 ميجابايت.");
  if (
    visualUpload &&
    targetKind === "image" &&
    !visualUpload.type.startsWith("image/")
  )
    return fail(request, id, "الملف المختار ليس صورة.");
  if (
    visualUpload &&
    targetKind === "video" &&
    !visualUpload.type.startsWith("video/")
  )
    return fail(request, id, "الملف المختار ليس فيديو.");

  const planned = planPostConversion(post, {
    targetKind,
    hasFile,
    hasMediaUpload: !!visualUpload,
    hasDownloadUpload: !!downloadUpload,
  });
  if (!planned.ok) {
    if (planned.error === "visual-required") {
      return fail(
        request,
        id,
        targetKind === "image"
          ? "اختر صورة جديدة لإتمام التحويل."
          : "اختر فيديو جديداً لإتمام التحويل.",
      );
    }
    if (planned.error === "download-required")
      return fail(request, id, "اختر ملف التحميل.");
    return fail(request, id, "نوع المنشور الحالي غير مدعوم.");
  }

  const createdFiles: (string | null)[] = [];
  let visual: StoredVisual | null = null;
  let download: StoredFile | null = null;

  if (planned.plan.visual?.source === "existing") {
    visual = planned.plan.visual.file;
  } else if (
    planned.plan.visual?.source === "upload" &&
    visualUpload &&
    targetKind !== "text"
  ) {
    try {
      visual = await saveVisualUpload(visualUpload, targetKind);
      createdFiles.push(visual.path, visual.thumbPath);
    } catch (error) {
      console.error("[posts] failed to save conversion visual", error);
      return fail(
        request,
        id,
        targetKind === "image"
          ? "تعذر معالجة الصورة. تأكد أنها صورة سليمة."
          : "تعذر حفظ الفيديو.",
      );
    }
  }

  if (planned.plan.download?.source === "existing") {
    download = planned.plan.download.file;
  } else if (planned.plan.download?.source === "upload" && downloadUpload) {
    try {
      download = await saveUpload(downloadUpload);
      createdFiles.push(download.path);
    } catch (error) {
      await deleteUploadedFiles(createdFiles);
      console.error("[posts] failed to save conversion download", error);
      return fail(request, id, "تعذر حفظ ملف التحميل.");
    }
  }

  try {
    const result = updatePost(
      id,
      {
        kind: targetKind,
        title,
        body,
        published,
        hasFile,
        mediaPath: visual?.path ?? null,
        mediaName: visual?.name ?? null,
        mediaType: visual?.type ?? null,
        mediaSize: visual?.size ?? null,
        filePath: download?.path ?? null,
        fileName: download?.name ?? null,
        fileType: download?.type ?? null,
        fileSize: download?.size ?? null,
        width: visual?.width ?? null,
        height: visual?.height ?? null,
        thumbPath: visual?.thumbPath ?? null,
      },
      post.updated_at,
    );
    if (Number(result.changes) !== 1) throw new Error("Post update lost");
  } catch (error) {
    await deleteUploadedFiles(createdFiles);
    console.error("[posts] failed to commit conversion", error);
    return fail(request, id, "تعذر حفظ التعديلات. لم يتغير المنشور.");
  }

  const obsoleteFiles = getObsoletePostFiles(post, [
    visual?.path,
    visual?.thumbPath,
    download?.path,
  ]);
  await deleteUploadedFiles(obsoleteFiles);

  return NextResponse.redirect(dashboardRedirectUrl(request, "?edited=1"), 303);
}
