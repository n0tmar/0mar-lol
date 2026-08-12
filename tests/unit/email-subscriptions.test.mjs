import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maskEmail,
  normalizeEmail,
} from "../../lib/email-subscriptions.ts";

test("email addresses normalize for stable deduplication", () => {
  assert.equal(normalizeEmail(" Omar+Posts@Example.COM "), "omar+posts@example.com");
  assert.equal(normalizeEmail("hello.world@sub.example.co"), "hello.world@sub.example.co");
});

test("invalid or unsafe email addresses are rejected", () => {
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail("a..b@example.com"), null);
  assert.equal(normalizeEmail("name@-example.com"), null);
  assert.equal(normalizeEmail("name@example"), null);
  assert.equal(normalizeEmail(`${"a".repeat(65)}@example.com`), null);
  assert.equal(normalizeEmail(`name@example.com\nBcc:evil@example.com`), null);
});

test("email masking keeps domain useful without exposing full local part", () => {
  assert.equal(maskEmail("omar@example.com"), "om***@example.com");
  assert.equal(maskEmail("a@example.com"), "a***@example.com");
});
