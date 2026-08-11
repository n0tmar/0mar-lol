import { test } from "node:test";
import assert from "node:assert/strict";
import { getPostDownloadFile } from "../../lib/post-download.ts";

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
    ...overrides,
  };
}

test("text post files resolve from media fields", () => {
  assert.deepEqual(
    getPostDownloadFile(
      post({
        has_file: 1,
        media_path: "uploads/archive.zip",
        media_name: "archive.zip",
        media_type: "application/zip",
        media_size: 1234,
      }),
    ),
    {
      path: "uploads/archive.zip",
      name: "archive.zip",
      type: "application/zip",
      size: 1234,
    },
  );
});

test("image and video attachments resolve from secondary file fields", () => {
  assert.deepEqual(
    getPostDownloadFile(
      post({
        kind: "image",
        has_file: 1,
        media_path: "uploads/preview.png",
        media_name: "preview.png",
        file_path: "uploads/archive.zip",
        file_name: "archive.zip",
        file_type: "application/zip",
        file_size: 4567,
      }),
    ),
    {
      path: "uploads/archive.zip",
      name: "archive.zip",
      type: "application/zip",
      size: 4567,
    },
  );
});

test("inconsistent has_file rows do not create fake download buttons", () => {
  assert.equal(
    getPostDownloadFile(
      post({
        kind: "video",
        has_file: 1,
        media_path: "uploads/video.mp4",
      }),
    ),
    null,
  );
});

test("ordinary text/image/video posts have no download", () => {
  assert.equal(getPostDownloadFile(post()), null);
  assert.equal(
    getPostDownloadFile(
      post({ kind: "image", media_path: "uploads/preview.png" }),
    ),
    null,
  );
});

test("legacy kind=file posts resolve from media fields", () => {
  assert.deepEqual(
    getPostDownloadFile(
      post({
        kind: "file",
        media_path: "uploads/legacy.zip",
        media_name: "legacy.zip",
        media_type: "application/zip",
        media_size: 99,
      }),
    ),
    {
      path: "uploads/legacy.zip",
      name: "legacy.zip",
      type: "application/zip",
      size: 99,
    },
  );
});
