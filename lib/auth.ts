import "server-only";

import path from "node:path";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { getDataDirectory } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dashboardBasePath } from "@/lib/dashboard-host";
import {
  sessionCookieName,
  sessionLength,
  verifySessionToken,
} from "@/lib/session";

export {
  anonymizeIp,
  createSessionToken,
  sessionCookieName,
  verifySessionToken,
} from "@/lib/session";

export function verifyPassword(value: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 10) {
    throw new Error("ADMIN_PASSWORD must contain at least 10 characters.");
  }

  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function isAdmin() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    // On the dashboard subdomain the login page lives at /login.
    redirect(`${await dashboardBasePath()}/login`);
  }
}

export function isAdminRequest(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);
  return verifySessionToken(cookie);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  // Behind a proxy, request.url carries the server's own listen address;
  // derive the expected origin from the forwarded headers instead.
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host");
  if (!host) throw new Error("Invalid request origin.");
  const expected = `${proto}://${host}`;
  if (origin !== expected) throw new Error("Invalid request origin.");
}

export function secureCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionLength,
  };
}

// Brute-force protection for the admin login, kept in a plain JSON file.
// SQLite reads inside this Next standalone runtime see stale committed data
// (node:sqlite quirk on this setup), but node:fs always works — so the lock
// state lives in `data/login-lock.json`, written atomically.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function lockFilePath() {
  return path.join(getDataDirectory(), "login-lock.json");
}

type LockState = { fails: number; lockedUntil: number };

function readLockState(): LockState {
  try {
    const raw = readFileSync(lockFilePath(), "utf8");
    const parsed = JSON.parse(raw) as LockState;
    if (typeof parsed.fails === "number" && typeof parsed.lockedUntil === "number") {
      return parsed;
    }
  } catch {}
  return { fails: 0, lockedUntil: 0 };
}

function writeLockState(state: LockState) {
  const file = lockFilePath();
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, file);
}

export function isLoginLocked(_ip: string): boolean {
  void _ip;
  const state = readLockState();
  if (state.lockedUntil > Date.now()) return true;
  if (state.lockedUntil > 0) {
    // Lock expired — clear it.
    writeLockState({ fails: 0, lockedUntil: 0 });
  }
  return false;
}

export function recordLoginFailure(_ip: string) {
  void _ip;
  const state = readLockState();
  const fails = state.fails + 1;
  if (fails >= MAX_FAILS) {
    writeLockState({ fails: 0, lockedUntil: Date.now() + LOCK_MS });
  } else {
    writeLockState({ fails, lockedUntil: 0 });
  }
}

export function clearLoginFailures(_ip: string) {
  void _ip;
  writeLockState({ fails: 0, lockedUntil: 0 });
}
