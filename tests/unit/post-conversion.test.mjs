import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getObsoletePostFiles,
  normalizePostKind,
  planPostConversion,
} from "../../lib/post-conversion.ts";

function post(overrides = {}) {
  return {
    kind: "text",
    title: "post",
    has_file: 0,
    media_path: null,
    media_name: null,
    media_type: null,
    media_size: null,
    file_path: null,
    file_name: null,
    file_type: null,
    file_size: null,
    width: null,
    height: null,
    thumb_path: null,
    ...overrides,
  };
}

function plan(overrides, input) {
  const result = planPostConversion(post(overrides), input);
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  return result.plan;
}

const noUploads = {
  hasFile: false,
  hasMediaUpload: false,
  hasDownloadUpload: false,
};

test("normalizes current kinds and legacy file rows", () => {
  assert.equal(normalizePostKind("text"), "text");
  assert.equal(normalizePostKind("image"), "image");
  assert.equal(normalizePostKind("video"), "video");
  assert.equal(normalizePostKind("file"), "text");
  assert.equal(normalizePostKind("unknown"), null);
});

test("same visual kind reuses existing media without an upload", () => {
  const result = plan(
    {
      kind: "image",
      media_path: "uploads/photo.png",
      media_name: "photo.png",
      media_type: "image/png",
      media_size: 100,
      width: 400,
      height: 300,
      thumb_path: "uploads/photo.webp",
    },
    { ...noUploads, targetKind: "image" },
  );
  assert.equal(result.visual.source, "existing");
  assert.equal(result.visual.file.path, "uploads/photo.png");
  assert.equal(result.visual.file.thumbPath, "uploads/photo.webp");
  assert.equal(result.download, null);
});

test("text to image requires new visual and preserves download", () => {
  const result = plan(
    {
      has_file: 1,
      file_path: "uploads/archive.zip",
      file_name: "archive.zip",
      file_type: "application/zip",
      file_size: 200,
    },
    {
      targetKind: "image",
      hasFile: true,
      hasMediaUpload: true,
      hasDownloadUpload: false,
    },
  );
  assert.deepEqual(result.visual, { source: "upload" });
  assert.equal(result.download.source, "existing");
  assert.equal(result.download.file.path, "uploads/archive.zip");
});

test("image to video and video to image require replacement visual", () => {
  for (const [currentKind, targetKind, mediaType] of [
    ["image", "video", "image/png"],
    ["video", "image", "video/mp4"],
  ]) {
    const current = post({
      kind: currentKind,
      media_path: `uploads/current.${currentKind === "image" ? "png" : "mp4"}`,
      media_type: mediaType,
    });
    assert.deepEqual(
      planPostConversion(current, { ...noUploads, targetKind }),
      { ok: false, error: "visual-required" },
    );
    assert.equal(
      planPostConversion(current, {
        ...noUploads,
        targetKind,
        hasMediaUpload: true,
      }).ok,
      true,
    );
  }
});

test("visual to text removes visual but preserves optional download", () => {
  const result = plan(
    {
      kind: "video",
      media_path: "uploads/video.mp4",
      media_type: "video/mp4",
      has_file: 1,
      file_path: "uploads/guide.pdf",
      file_name: "guide.pdf",
      file_type: "application/pdf",
      file_size: 300,
    },
    {
      targetKind: "text",
      hasFile: true,
      hasMediaUpload: false,
      hasDownloadUpload: false,
    },
  );
  assert.equal(result.visual, null);
  assert.equal(result.download.source, "existing");
  assert.equal(result.download.file.path, "uploads/guide.pdf");
});

test("requested download requires existing bytes or a new upload", () => {
  assert.deepEqual(
    planPostConversion(post(), {
      targetKind: "text",
      hasFile: true,
      hasMediaUpload: false,
      hasDownloadUpload: false,
    }),
    { ok: false, error: "download-required" },
  );
  assert.equal(
    planPostConversion(post(), {
      targetKind: "text",
      hasFile: true,
      hasMediaUpload: false,
      hasDownloadUpload: true,
    }).ok,
    true,
  );
});

test("new uploads replace existing visual and download independently", () => {
  const result = plan(
    {
      kind: "image",
      media_path: "uploads/old.png",
      has_file: 1,
      file_path: "uploads/old.zip",
    },
    {
      targetKind: "image",
      hasFile: true,
      hasMediaUpload: true,
      hasDownloadUpload: true,
    },
  );
  assert.deepEqual(result.visual, { source: "upload" });
  assert.deepEqual(result.download, { source: "upload" });
});

test("legacy file attachment survives conversion into canonical layout", () => {
  const result = plan(
    {
      kind: "file",
      media_path: "uploads/legacy.zip",
      media_name: "legacy.zip",
      media_type: "application/zip",
      media_size: 99,
    },
    {
      targetKind: "text",
      hasFile: true,
      hasMediaUpload: false,
      hasDownloadUpload: false,
    },
  );
  assert.equal(result.currentKind, "text");
  assert.equal(result.download.source, "existing");
  assert.equal(result.download.file.path, "uploads/legacy.zip");
});

test("obsolete-file calculation keeps moved paths and removes replaced ones", () => {
  const current = {
    media_path: "uploads/visual.png",
    thumb_path: "uploads/thumb.webp",
    file_path: "uploads/archive.zip",
  };
  assert.deepEqual(
    getObsoletePostFiles(current, ["uploads/archive.zip"]),
    ["uploads/visual.png", "uploads/thumb.webp"],
  );
  assert.deepEqual(
    getObsoletePostFiles(
      {
        media_path: "uploads/legacy.zip",
        thumb_path: null,
        file_path: null,
      },
      [null, null, "uploads/legacy.zip"],
    ),
    [],
  );
});
