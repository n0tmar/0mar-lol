import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTikTokHandle,
  parseSupporterInput,
  supporterAvatarUrl,
  supporterTikTokUrl,
  validateSupporterAvatarUpload,
} from "../../lib/supporters.ts";

test("TikTok handles normalize from usernames and profile URLs", () => {
  assert.equal(normalizeTikTokHandle(" Omar.Tools "), "@omar.tools");
  assert.equal(
    normalizeTikTokHandle("https://www.tiktok.com/@Omar_Tools?lang=ar"),
    "@omar_tools",
  );
});

test("invalid TikTok accounts are rejected", () => {
  assert.equal(normalizeTikTokHandle("https://example.com/@omar"), null);
  assert.equal(normalizeTikTokHandle("@bad handle"), null);
  assert.equal(normalizeTikTokHandle("@name."), null);
});

test("supporter input is trimmed and validated", () => {
  assert.deepEqual(
    parseSupporterInput({
      name: "  داعم   مميز  ",
      tiktok: "@Supporter_1",
      detail: "  دعم   المشاريع الجديدة  ",
      visible: true,
    }),
    {
      ok: true,
      value: {
        name: "داعم مميز",
        tiktokHandle: "@supporter_1",
        detail: "دعم المشاريع الجديدة",
        visible: true,
      },
    },
  );
});

test("supporter fields enforce limits", () => {
  assert.equal(
    parseSupporterInput({
      name: "",
      tiktok: "@valid_name",
      detail: "",
      visible: true,
    }).ok,
    false,
  );
  assert.equal(
    parseSupporterInput({
      name: "داعم",
      tiktok: "@valid_name",
      detail: "x".repeat(301),
      visible: true,
    }).ok,
    false,
  );
});

test("supporter avatar uploads enforce type and size", () => {
  assert.equal(
    validateSupporterAvatarUpload({ size: 1024, type: "image/png" }),
    null,
  );
  assert.match(
    validateSupporterAvatarUpload({
      size: 5 * 1024 * 1024 + 1,
      type: "image/png",
    }) || "",
    /5 ميجابايت/,
  );
  assert.match(
    validateSupporterAvatarUpload({ size: 100, type: "image/svg+xml" }) || "",
    /غير مدعومة/,
  );
});

test("supporter avatar URLs use immutable revisions", () => {
  assert.equal(
    supporterAvatarUrl({
      id: "supporter-id",
      avatar_path: "uploads/avatar.webp",
      avatar_updated_at: 123,
    }),
    "/api/supporters/supporter-id/avatar?v=123",
  );
  assert.equal(
    supporterAvatarUrl({
      id: "supporter-id",
      avatar_path: null,
      avatar_updated_at: 0,
    }),
    null,
  );
});

test("supporter TikTok handles resolve to profile URLs", () => {
  assert.equal(
    supporterTikTokUrl("@omar.tools"),
    "https://www.tiktok.com/@omar.tools",
  );
});
