import type { Metadata } from "next";
import Link from "next/link";
import { IconMail } from "@/components/icons";
import { getEmailSubscriptionByToken } from "@/lib/db";
import { maskEmail } from "@/lib/email-subscriptions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إلغاء تنبيهات البريد",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const TOKEN = /^[A-Za-z0-9_-]{32}$/;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; invalid?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || "";
  const subscription = TOKEN.test(token)
    ? getEmailSubscriptionByToken(token)
    : undefined;

  return (
    <main className="public-main">
      <div className="unsubscribe-shell">
        <span className="unsubscribe-shell__icon" aria-hidden="true">
          <IconMail size={22} />
        </span>
        {params.done ? (
          <>
            <h1>تم إلغاء الاشتراك</h1>
            <p>ما راح توصلك تنبيهات بريد جديدة.</p>
          </>
        ) : subscription ? (
          <>
            <h1>إلغاء تنبيهات البريد</h1>
            <p>
              هل تبي توقف التنبيهات عن <bdi>{maskEmail(subscription.email)}</bdi>؟
            </p>
            <form action="/api/subscriptions/unsubscribe" method="post">
              <input type="hidden" name="token" value={token} />
              <button type="submit">إلغاء الاشتراك</button>
            </form>
          </>
        ) : (
          <>
            <h1>الرابط غير صالح</h1>
            <p>يمكن البريد ملغي من قبل، أو رابط الإلغاء قديم.</p>
          </>
        )}
        <Link href="/">الرجوع للموقع</Link>
      </div>
    </main>
  );
}
