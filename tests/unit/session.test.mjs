import assert from "node:assert/strict";
import test from "node:test";
import {
  anonymizeIp,
  createSessionToken,
  verifySessionToken,
} from "../../lib/session.ts";

process.env.SESSION_SECRET = "unit-test-secret-at-least-32-characters";

test("valid token verifies as admin", () => {
  const token = createSessionToken();
  assert.equal(verifySessionToken(token), true);
});

test("token contains payload and signature parts", () => {
  const token = createSessionToken();
  const [payload, signature] = token.split(".");
  assert.ok(payload);
  assert.ok(signature);
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  assert.equal(parsed.role, "admin");
  assert.ok(typeof parsed.expires === "number");
});

test("tampered signature is rejected", () => {
  const token = createSessionToken();
  const [payload, signature] = token.split(".");
  const flipped = signature.endsWith("A")
    ? signature.slice(0, -1) + "B"
    : signature.slice(0, -1) + "A";
  assert.equal(verifySessionToken(`${payload}.${flipped}`), false);
});

test("tampered payload is rejected", () => {
  const token = createSessionToken();
  const [, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ role: "admin", expires: Math.floor(Date.now() / 1000) + 999999 }),
  ).toString("base64url");
  assert.equal(verifySessionToken(`${forged}.${signature}`), false);
});

test("expired token is rejected", () => {
  const token = createSessionToken();
  const expired = Buffer.from(
    JSON.stringify({ role: "admin", expires: Math.floor(Date.now() / 1000) - 10 }),
  ).toString("base64url");
  const [signature] = [token.split(".")[1]];
  assert.equal(verifySessionToken(`${expired}.${signature}`), false);
});

test("non-admin role is rejected", () => {
  const token = createSessionToken();
  const [, signature] = token.split(".");
  const nonAdmin = Buffer.from(
    JSON.stringify({ role: "user", expires: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url");
  assert.equal(verifySessionToken(`${nonAdmin}.${signature}`), false);
});

test("malformed input is rejected without throwing", () => {
  assert.equal(verifySessionToken(undefined), false);
  assert.equal(verifySessionToken(""), false);
  assert.equal(verifySessionToken("no-signature"), false);
  assert.equal(verifySessionToken("a.b.c"), false);
  assert.equal(verifySessionToken("!!!.###"), false);
});

test("anonymizeIp hashes consistently and is not reversible", () => {
  const first = anonymizeIp("203.0.113.7");
  const second = anonymizeIp("203.0.113.7");
  assert.equal(first, second);
  assert.equal(first.length, 64, "sha256 hex digest");
  assert.notEqual(first, "203.0.113.7");
  assert.notEqual(anonymizeIp("203.0.113.7"), anonymizeIp("203.0.113.8"));
});
