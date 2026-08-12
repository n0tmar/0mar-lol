import "server-only";

import { listEmailSubscriptions } from "@/lib/db";
import { publicHostName } from "@/lib/hosts";

const RESEND_BATCH_SIZE = 100;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function deliveryConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const host = publicHostName();
  if (!apiKey || !from || !host) return null;
  return {
    apiKey,
    from,
    origin: `https://${host}`,
    endpoint:
      process.env.RESEND_API_URL?.trim() ||
      "https://api.resend.com/emails/batch",
  };
}

export function emailDeliveryConfigured(): boolean {
  return deliveryConfig() !== null;
}

export async function sendNewPostEmailNotification({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const config = deliveryConfig();
  if (!config) {
    console.info(
      "[email-notifications] skipped: RESEND_API_KEY, EMAIL_FROM, or PUBLIC_HOST is missing.",
    );
    return;
  }

  const subscriptions = listEmailSubscriptions();
  if (subscriptions.length === 0) return;

  const postUrl = `${config.origin}/posts/${encodeURIComponent(id)}`;
  const notificationTitle = title.replace(/\s+/g, " ").trim();
  const safeTitle = escapeHtml(notificationTitle);
  const subject = `منشور جديد من عمر: ${notificationTitle}`;

  for (let offset = 0; offset < subscriptions.length; offset += RESEND_BATCH_SIZE) {
    const batch = subscriptions.slice(offset, offset + RESEND_BATCH_SIZE);
    const payload = batch.map((subscription) => {
      const unsubscribePage = `${config.origin}/unsubscribe?token=${encodeURIComponent(subscription.unsubscribe_token)}`;
      const oneClickUrl = `${config.origin}/api/subscriptions/unsubscribe?token=${encodeURIComponent(subscription.unsubscribe_token)}`;
      return {
        from: config.from,
        to: [subscription.email],
        subject,
        html: `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#141419;color:#f5f2ed;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><p style="margin:0 0 10px;color:#d4825a;font-size:13px">منشور جديد</p><h1 style="margin:0 0 22px;font-size:24px;line-height:1.5">${safeTitle}</h1><a href="${postUrl}" style="display:inline-block;padding:12px 18px;background:#d4825a;color:#171318;text-decoration:none;border-radius:8px;font-weight:700">افتح المنشور</a><p style="margin:30px 0 0;color:#9d99a6;font-size:11px;line-height:1.7">وصلتك الرسالة لأنك سجلت بريدك في 0mar.lol. <a href="${unsubscribePage}" style="color:#c6c1cc">إلغاء الاشتراك</a></p></div></body></html>`,
        text: `منشور جديد من عمر\n\n${notificationTitle}\n${postUrl}\n\nإلغاء الاشتراك: ${unsubscribePage}`,
        headers: {
          "List-Unsubscribe": `<${oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `post-${id}-${Math.floor(offset / RESEND_BATCH_SIZE)}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Resend batch failed (${response.status}): ${detail}`);
    }
  }
}
