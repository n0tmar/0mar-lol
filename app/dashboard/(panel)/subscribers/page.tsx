import type { Metadata } from "next";
import { ConfirmDelete } from "@/components/confirm-delete";
import { IconMail } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { listEmailSubscriptions } from "@/lib/db";
import { emailDeliveryConfigured } from "@/lib/email-notifications";
import { formatAbsoluteDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تنبيهات البريد",
  robots: { index: false, follow: false },
};

export default async function DashboardSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const subscriptions = listEmailSubscriptions();
  const deliveryReady = emailDeliveryConfigured();

  return (
    <div className="dash-page dash-subscribers-page">
      <header className="dash-subscribers-head">
        <div>
          <h1 className="dash-page__title">
            تنبيهات البريد
            <span className="dash-page__count">{subscriptions.length}</span>
          </h1>
          <p>البريد المسجّل لاستقبال تنبيه عند نشر محتوى جديد.</p>
        </div>
        <span
          className={`dash-email-delivery${deliveryReady ? " dash-email-delivery--ready" : ""}`}
        >
          {deliveryReady ? "الإرسال التلقائي مفعّل" : "الإرسال يحتاج إعداد Resend"}
        </span>
      </header>

      {params.deleted && (
        <p className="dash-alert dash-alert--spaced" role="status">
          تم حذف البريد من التنبيهات.
        </p>
      )}
      {params.error && (
        <p className="dash-alert dash-alert--error dash-alert--spaced" role="alert">
          تعذر حذف البريد. حاول مرة أخرى.
        </p>
      )}

      {subscriptions.length === 0 ? (
        <div className="dash-email-empty">
          <span aria-hidden="true">
            <IconMail size={20} />
          </span>
          <div>
            <strong>ما فيه اشتراكات حتى الآن</strong>
            <p>تظهر هنا الإيميلات المسجّلة من أسفل صفحة المنشورات.</p>
          </div>
        </div>
      ) : (
        <ul className="dash-email-list">
          {subscriptions.map((subscription) => (
            <li data-subscription-id={subscription.id} key={subscription.id}>
              <span className="dash-email-list__icon" aria-hidden="true">
                <IconMail size={16} />
              </span>
              <span className="dash-email-list__copy">
                <a href={`mailto:${subscription.email}`} dir="ltr">
                  {subscription.email}
                </a>
                <small>{formatAbsoluteDate(subscription.created_at)}</small>
              </span>
              <ConfirmDelete
                action={`/api/admin/subscribers/${subscription.id}`}
                message={`حذف ${subscription.email} من تنبيهات البريد؟`}
              >
                <button className="dash-email-list__delete" type="submit">
                  حذف
                </button>
              </ConfirmDelete>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
