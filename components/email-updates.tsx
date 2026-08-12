import { IconMail } from "@/components/icons";

const STATUS_COPY: Record<string, { text: string; error?: boolean }> = {
  subscribed: { text: "تم تسجيل بريدك للتنبيهات." },
  invalid: { text: "تأكد من كتابة بريد إلكتروني صحيح.", error: true },
  limited: { text: "وصلت للحد المؤقت. حاول بعد ساعة.", error: true },
  failed: { text: "تعذر تسجيل البريد الآن. حاول مرة ثانية.", error: true },
};

export function EmailUpdates({ status }: { status?: string }) {
  const message = status ? STATUS_COPY[status] : undefined;
  const popoverId = "email-updates-popover";

  return (
    <section id="email-updates" className="email-updates" aria-labelledby="email-updates-title">
      <span className="email-updates__icon" aria-hidden="true">
        <IconMail size={18} />
      </span>
      <div className="email-updates__copy">
        <h2 id="email-updates-title">لا يفوتك الجديد</h2>
        <p>سجّل بريدك، وأرسل لك تنبيه مختصر لما أنزل منشور جديد.</p>
        {message && (
          <p
            className={`email-updates__status${message.error ? " email-updates__status--error" : ""}`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
      </div>
      <button
        className="email-updates__open"
        type="button"
        popoverTarget={popoverId}
      >
        فعّل تنبيهات البريد
      </button>

      <div
        id={popoverId}
        className="email-updates-popover"
        popover="auto"
        role="dialog"
        aria-labelledby="email-updates-popover-title"
      >
        <button
          className="email-updates-popover__close"
          type="button"
          popoverTarget={popoverId}
          popoverTargetAction="hide"
          aria-label="إغلاق"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <span className="email-updates-popover__icon" aria-hidden="true">
          <IconMail size={20} />
        </span>
        <h2 id="email-updates-popover-title">وصّلني بالجديد</h2>
        <p>رسالة واحدة عند نزول منشور جديد. بدون إزعاج.</p>
        <form action="/api/subscriptions" method="post">
          <label>
            <span>البريد الإلكتروني</span>
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              placeholder="name@example.com"
            />
          </label>
          <label className="email-updates__website" aria-hidden="true">
            <span>الموقع</span>
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <button type="submit">سجّل بريدي</button>
          <small>تقدر تلغي الاشتراك من أي رسالة.</small>
        </form>
      </div>
    </section>
  );
}
