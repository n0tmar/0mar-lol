import { dashboardRedirectUrl } from "@/lib/url";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { createPost, type PostKind } from "@/lib/db";
import { makeImageThumb, saveFile } from "@/lib/uploads";

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
  const upload = formData.get("media");
  const fileUpload = formData.get("file_upload");

  if (!validKinds.has(kind) || title.length < 2 || title.length > 120)
    return fail(request, "تحقق من نوع المنشور والعنوان.");
  if (body.length > 5000)
    return fail(request, "النص أطول من الحد المسموح.");
  if (kind === "text" && !hasFile && body.length < 2)
    return fail(request, "أضف نص المنشور.");

  // media upload (image/video, or text file)
  let mediaPath: string | null = null,
    mediaName: string | null = null,
    mediaType: string | null = null,
    mediaSize: number | null = null;
  let width: number | null = null,
    height: number | null = null,
    thumbPath: string | null = null;

  if (kind !== "text" || hasFile) {
    if (!(upload instanceof File) || upload.size === 0)
      return fail(request, "اختر ملفاً للمنشور.");
    if (upload.size > maxUploadSize)
      return fail(request, "حجم الملف أكبر من 100 ميجابايت.");
    if (kind === "image" && !upload.type.startsWith("image/"))
      return fail(request, "الملف المختار ليس صورة.");
    if (kind === "video" && !upload.type.startsWith("video/"))
      return fail(request, "الملف المختار ليس فيديو.");

    const buffer = Buffer.from(await upload.arrayBuffer());
    if (kind === "image") {
      try {
        const thumb = await makeImageThumb(buffer);
        width = thumb.width;
        height = thumb.height;
        thumbPath = thumb.thumbPath;
      } catch {
        return fail(request, "تعذر معالجة الصورة. تأكد أنها صورة سليمة.");
      }
    }
    const saved = await saveFile(buffer, upload);
    mediaPath = saved.path;
    mediaName = saved.name;
    mediaType = saved.type;
    mediaSize = saved.size;
  }

  // second file upload (download file for image/video posts)
  let filePath: string | null = null,
    fileName: string | null = null,
    fileType: string | null = null,
    fileSize: number | null = null;

  if (hasFile && kind !== "text" && fileUpload instanceof File && fileUpload.size > 0) {
    if (fileUpload.size > maxUploadSize)
      return fail(request, "حجم الملف أكبر من 100 ميجابايت.");
    const buffer = Buffer.from(await fileUpload.arrayBuffer());
    const saved = await saveFile(buffer, fileUpload);
    filePath = saved.path;
    fileName = saved.name;
    fileType = saved.type;
    fileSize = saved.size;
  }

  createPost({
    kind,
    title,
    body,
    mediaPath,
    mediaName,
    mediaType,
    mediaSize,
    published,
    hasFile,
    filePath,
    fileName,
    fileType,
    fileSize,
    width,
    height,
    thumbPath,
  });

  return NextResponse.redirect(dashboardRedirectUrl(request, "?created=1"), 303);
}
