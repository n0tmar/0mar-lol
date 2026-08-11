import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const sessionCookieName = "omar_admin_session";
export const sessionLength = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      expires: Math.floor(Date.now() / 1000) + sessionLength,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { role?: string; expires?: number };
    return (
      parsed.role === "admin" &&
      typeof parsed.expires === "number" &&
      parsed.expires > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export function anonymizeIp(ip: string) {
  return createHmac("sha256", secret()).update(ip).digest("hex");
}
