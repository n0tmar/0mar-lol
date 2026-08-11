import { absoluteUrl } from "@/lib/url";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isAdminRequest } from "@/lib/auth";
import { getPost, updatePost } from "@/lib/db";
import { deleteUploadedFiles, makeImageThumb, saveFile } from "@/lib/uploads";

export const runtime = "nodejs";
const maxUploadSize = 100 * 1024 * 1024;

function fail(request: NextRequest, code: string) {
  return NextResponse.redirect(
    new URL(`/dashboard?error=${encodeURIComponent(code)}`, request.url),
    303,
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.redirect(absoluteUrl(request, "/dashboard/login"), 303);
  try {
    assertSameOrigin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const post = getPost(id);
  if (!post) return fail(request, "المنشور غير موجود.");

  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const published = formData.get("published") === "on";
  const hasFile = formData.get("has_file") === "on";
  const upload = formData.get("media");
  const fileUpload = formData.get("file_upload");

  if (title.length < 2 || title.length > 120)
    return fail(request, "تحقق من نوع المنشور والعنوان.");
  if (body.length > 5000)
    return fail(request, "النص أطول من الحد المسموح.");
  if (post.kind === "text" && !hasFile && body.length < 2)
    return fail(request, "أضف نص المنشور.");

  const replacedFiles: (string | null | undefined)[] = [];
  let mediaPath = post.media_path;
  let mediaName = post.media_name;
  let mediaType = post.media_type;
  let mediaSize = post.media_size;
  let width = post.width;
  let height = post.height;
  let thumbPath = post.thumb_path;
  let filePath = post.file_path;
  let fileName = post.file_name;
  let fileType = post.file_type;
  let fileSize = post.file_size;

  // New media replaces the old one (if any).
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > maxUploadSize)
      return fail(request, "حجم الملف أكبر من 100 ميجابايت.");
    if (post.kind === "image" && !upload.type.startsWith("image/"))
      return fail(request, "الملف المختار ليس صورة.");
    if (post.kind === "video" && !upload.type.startsWith("video/"))
      return fail(request, "الملف المختار ليس فيديو.");

    const buffer = Buffer.from(await upload.arrayBuffer());
    if (post.kind === "image") {
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
    replacedFiles.push(post.media_path, post.thumb_path);
  }

  // Secondary download file: new upload replaces, unchecking removes.
  if (post.kind !== "text") {
    if (hasFile) {
      if (fileUpload instanceof File && fileUpload.size > 0) {
        if (fileUpload.size > maxUploadSize)
          return fail(request, "حجم الملف أكبر من 100 ميجابايت.");
        const buffer = Buffer.from(await fileUpload.arrayBuffer());
        const saved = await saveFile(buffer, fileUpload);
        filePath = saved.path;
        fileName = saved.name;
        fileType = saved.type;
        fileSize = saved.size;
        replacedFiles.push(post.file_path);
      }
      // has_file on, no new file -> keep existing.
    } else {
      replacedFiles.push(post.file_path);
      filePath = null;
      fileName = null;
      fileType = null;
      fileSize = null;
    }
  }

  // Text posts: the media slot IS the downloadable file.
  if (post.kind === "text") {
    if (hasFile) {
      // Media already replaced above if a new file was uploaded.
      if (!(upload instanceof File && upload.size > 0) && !mediaPath) {
        return fail(request, "اختر ملفاً للمنشور.");
      }
    } else {
      replacedFiles.push(post.media_path, post.thumb_path);
      mediaPath = null;
      mediaName = null;
      mediaType = null;
      mediaSize = null;
      width = null;
      height = null;
      thumbPath = null;
    }
  }

  updatePost(id, {
    title,
    body,
    published,
    hasFile,
    mediaPath,
    mediaName,
    mediaType,
    mediaSize,
    filePath,
    fileName,
    fileType,
    fileSize,
    width,
    height,
    thumbPath,
  });

  await deleteUploadedFiles(replacedFiles);

  return NextResponse.redirect(absoluteUrl(request, "/dashboard?edited=1"), 303);
}
