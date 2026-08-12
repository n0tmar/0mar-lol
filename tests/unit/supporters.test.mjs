import { test } from "node:test";
import assert from "node:assert/strict";
import { supporterTikTokUrl } from "../../lib/supporters.ts";

test("supporter TikTok handles resolve to profile URLs", () => {
  assert.equal(
    supporterTikTokUrl("@omar.tools"),
    "https://www.tiktok.com/@omar.tools",
  );
});

test("supporter TikTok profile URLs encode unsafe handle characters", () => {
  assert.equal(
    supporterTikTokUrl("@omar tools"),
    "https://www.tiktok.com/@omar%20tools",
  );
});
