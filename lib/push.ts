import "server-only";

import webpush, { type PushSubscription } from "web-push";
import {
  deletePushSubscription,
  listPushSubscriptions,
  type AdminPushSubscriptionInput,
} from "@/lib/db";

type VapidConfiguration = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

function isBase64UrlBytes(value: string, byteLength: number) {
  return (
    /^[A-Za-z0-9_-]+$/.test(value) &&
    Buffer.from(value, "base64url").byteLength === byteLength
  );
}

export function getVapidConfiguration(): VapidConfiguration | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:hi@0mar.lol";

  if (!publicKey || !privateKey) return null;
  if (!isBase64UrlBytes(publicKey, 65)) return null;
  if (!isBase64UrlBytes(privateKey, 32)) return null;
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return null;
  }

  return { subject, publicKey, privateKey };
}

export function getVapidPublicKey() {
  return getVapidConfiguration()?.publicKey ?? null;
}

export function parsePushEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;

  try {
    const endpoint = new URL(value);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return value;
}

export function parsePushSubscription(
  value: unknown,
): AdminPushSubscriptionInput | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    typeof candidate.endpoint !== "string" ||
    typeof candidate.keys?.p256dh !== "string" ||
    typeof candidate.keys.auth !== "string"
  ) {
    return null;
  }

  const endpoint = parsePushEndpoint(candidate.endpoint);
  if (
    !endpoint ||
    !isBase64UrlBytes(candidate.keys.p256dh, 65) ||
    !isBase64UrlBytes(candidate.keys.auth, 16)
  ) {
    return null;
  }

  return {
    endpoint,
    p256dh: candidate.keys.p256dh,
    auth: candidate.keys.auth,
  };
}

function statusCodeFrom(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

function compact(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function sendNewCommentPush(input: {
  commentId: string;
  name: string;
  body: string;
  postTitle: string;
  isReply: boolean;
}) {
  const vapid = getVapidConfiguration();
  if (!vapid) return { sent: 0, failed: 0, removed: 0 };

  const subscriptions = listPushSubscriptions();
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    title: `${input.isReply ? "رد" : "تعليق"} جديد من ${compact(input.name, 40)}`,
    body: compact(`على «${input.postTitle}»: ${input.body}`, 180),
    url: "/dashboard/comments",
    tag: `comment-${input.commentId}`,
    timestamp: Date.now(),
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      if (subscription.vapidPublicKey !== vapid.publicKey) {
        deletePushSubscription(subscription.endpoint);
        removed += 1;
        return;
      }

      const target: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await webpush.sendNotification(target, payload, {
          vapidDetails: vapid,
          TTL: 60 * 60,
          urgency: "high",
          timeout: 10_000,
        });
        sent += 1;
      } catch (error) {
        const statusCode = statusCodeFrom(error);
        if (statusCode === 404 || statusCode === 410) {
          deletePushSubscription(subscription.endpoint);
          removed += 1;
          return;
        }
        failed += 1;
        console.error("Web Push delivery failed.", { statusCode });
      }
    }),
  );

  return { sent, failed, removed };
}
