import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { SUPPORT_TIERS, supportQrPath } from "@/lib/support-tiers";

export const metadata: Metadata = {
  title: "الدعم",
  description:
    "ادعم عمر — دعمك يساعدني على استمرار المحتوى والأدوات. الدفع عبر Ziina بالدرهم الإماراتي.",
};

function formatPrice(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}

export default function SupportPage() {
  return (
    <main className="public-main">
      <div className="bio-shell support-shell">
        <Link className="back-link" href="/">
          → رجوع
        </Link>

        <header className="support-header">
          <Avatar className="profile-avatar support-avatar" src="/avatar.jpg" alt="صورة عمر" />
          <h1>شكراً إنك وصلت هنا</h1>
          <p>
            كل المحتوى والأدوات اللي أشاركها هنا أشتغل عليها بوقتي الخاص،
            ودعمك يساعدني أقدم محتوى أفضل وأشتغل على مشاريع جديدة. الدفع آمن
            عبر Ziina.
          </p>
        </header>

        <p className="support-scan-hint">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            <path d="M8 8h3v3H8zM14 8h2v2h-2zM8 14h2v2H8zM13 13h3v3h-3z" />
          </svg>
          <span>على الكمبيوتر؟ امسح رمز الباقة بكاميرا جوالك وادفع مباشرة</span>
        </p>

        <div className="support-tiers">
          {SUPPORT_TIERS.map((tier, index) => (
            <a
              key={tier.id}
              className={`support-tier ${index === 0 ? "support-tier--featured" : ""}`}
              href={tier.url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="support-tier__head">
                <span className="support-tier__name">{tier.name}</span>
                <span className="support-tier__en">{tier.en}</span>
              </div>
              <p className="support-tier__desc">{tier.desc}</p>
              <div className="support-tier__price">
                <strong>{formatPrice(tier.sar)}</strong>
                <span className="riyal-symbol" aria-hidden="true" />
              </div>
              <span className="support-tier__usd">≈ ${tier.usd}</span>
              <figure className="support-tier__qr">
                <Image
                  className="support-tier__qr-image"
                  src={supportQrPath(tier)}
                  width={132}
                  height={132}
                  alt=""
                  unoptimized
                />
                <figcaption>امسح للدفع بالجوال</figcaption>
              </figure>
              <span className="support-tier__cta">ساندني</span>
            </a>
          ))}
        </div>

        <p className="support-note">
          عندك سؤال أو اقتراح؟ راسلني على{" "}
          <a href="mailto:hi@0mar.lol">hi@0mar.lol</a>
        </p>
      </div>
    </main>
  );
}
