import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAbsoluteDate,
  formatRelativeDate,
} from "../../lib/format.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 0, 15, 12, 0, 0);

test("just now", () => {
  assert.equal(formatRelativeDate(now - 5 * 1000, now), "الآن");
  assert.equal(formatRelativeDate(now - 59 * 1000, now), "الآن");
});

test("minutes: singular, dual, plural, and 11+", () => {
  assert.equal(formatRelativeDate(now - 1 * MINUTE, now), "منذ دقيقة");
  assert.equal(formatRelativeDate(now - 2 * MINUTE, now), "منذ دقيقتين");
  assert.equal(formatRelativeDate(now - 3 * MINUTE, now), "منذ 3 دقائق");
  assert.equal(formatRelativeDate(now - 10 * MINUTE, now), "منذ 10 دقائق");
  assert.equal(formatRelativeDate(now - 45 * MINUTE, now), "منذ 45 دقيقة");
});

test("hours: singular, dual, plural, and 11+", () => {
  assert.equal(formatRelativeDate(now - 1 * HOUR, now), "منذ ساعة");
  assert.equal(formatRelativeDate(now - 2 * HOUR, now), "منذ ساعتين");
  assert.equal(formatRelativeDate(now - 8 * HOUR, now), "منذ 8 ساعات");
  assert.equal(formatRelativeDate(now - 20 * HOUR, now), "منذ 20 ساعة");
});

test("days use the compact form", () => {
  assert.equal(formatRelativeDate(now - 1 * DAY, now), "منذ 1 ي");
  assert.equal(formatRelativeDate(now - 6 * DAY, now), "منذ 6 ي");
});

test("weeks: singular and plural", () => {
  assert.equal(formatRelativeDate(now - 7 * DAY, now), "منذ أسبوع");
  assert.equal(formatRelativeDate(now - 21 * DAY, now), "منذ 3 أسابيع");
});

test("months: singular and plural", () => {
  assert.equal(formatRelativeDate(now - 30 * DAY, now), "منذ شهر");
  assert.equal(formatRelativeDate(now - 120 * DAY, now), "منذ 4 أشهر");
});

test("years: singular and plural", () => {
  assert.equal(formatRelativeDate(now - 365 * DAY, now), "منذ سنة");
  assert.equal(formatRelativeDate(now - 800 * DAY, now), "منذ 2 سنوات");
});

test("future timestamps fall back to now", () => {
  assert.equal(formatRelativeDate(now + HOUR, now), "الآن");
});

test("absolute dates render in Riyadh Gregorian", () => {
  const out = formatAbsoluteDate(now);
  // Locale digits may be Arabic-Indic (٢٠٢٦) or ASCII — normalize and check.
  const normalized = out
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  assert.match(normalized, /2026/);
  assert.match(normalized, /15/);
});
