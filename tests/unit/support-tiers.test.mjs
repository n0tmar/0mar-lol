import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORT_TIERS,
  supportQrPath,
} from "../../lib/support-tiers.ts";

test("support tiers progress from supporter to main sponsor", () => {
  assert.deepEqual(
    SUPPORT_TIERS.map(({ usd, sar }) => [usd, sar]),
    [
      [3, 11.25],
      [5, 18.75],
      [10, 37.5],
      [25, 93.75],
      [50, 187.5],
      [100, 375],
    ],
  );
  assert.equal(SUPPORT_TIERS.at(-1).name, "راعي رئيسي");
  assert.equal(
    SUPPORT_TIERS.at(-1).url,
    "https://pay.ziina.com/martools/X8VuLPhx3?source=app",
  );
});

test("every payment tier has a unique immutable QR asset", () => {
  const paths = SUPPORT_TIERS.map(supportQrPath);
  assert.equal(new Set(paths).size, SUPPORT_TIERS.length);
  for (const path of paths) {
    assert.match(path, /^\/qr\/support-[a-z-]+-[a-f0-9]{12}\.svg$/);
  }
});
