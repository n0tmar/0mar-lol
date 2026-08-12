import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { IconExternalLink } from "@/components/icons";
import {
  SUPPORTERS,
  supporterTikTokUrl,
} from "@/lib/supporters";
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
          <Avatar
            className="profile-avatar support-avatar"
            src="/avatar.jpg"
            alt="صورة عمر"
          />
          <h1>شكراً إنك وصلت هنا</h1>
          <p>
            كل المحتوى والأدوات اللي أشاركها هنا أشتغل عليها بوقتي الخاص،
            ودعمك يساعدني أقدم محتوى أفضل وأشتغل على مشاريع جديدة. الدفع آمن
            عبر Ziina.
          </p>
        </header>

        <div className="support-tiers">
          {SUPPORT_TIERS.map((tier, index) => {
            const qrPath = supportQrPath(tier);
            const popoverId = `support-qr-${tier.id}`;

            return (
              <article
                key={tier.id}
                className={`support-tier ${index === 0 ? "support-tier--featured" : ""}`}
              >
                <div className="support-tier__info">
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
                  <a
                    className="support-tier__cta"
                    href={tier.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ساندني
                  </a>
                </div>

                <button
                  className="support-tier__qr"
                  type="button"
                  popoverTarget={popoverId}
                  aria-label={`تكبير رمز QR لدفع ${tier.name}`}
                >
                  <span className="support-tier__qr-frame">
                    <Image
                      className="support-tier__qr-image"
                      src={qrPath}
                      width={64}
                      height={64}
                      alt=""
                      unoptimized
                    />
                  </span>
                  <span className="support-tier__qr-caption">
                    امسح للدفع بالجوال
                  </span>
                </button>

                <div
                  id={popoverId}
                  className="support-qr-popover"
                  popover="auto"
                  role="dialog"
                  aria-label={`رمز دفع ${tier.name}`}
                >
                  <button
                    className="support-qr-popover__close"
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
                  <Image
                    className="support-qr-popover__image"
                    src={qrPath}
                    width={320}
                    height={320}
                    alt={`رمز QR لدفع ${tier.name}`}
                    unoptimized
                  />
                  <span className="support-qr-popover__caption">
                    امسح للدفع بالجوال
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <section className="supporters" aria-labelledby="supporters-title">
          <header className="supporters__header">
            <span className="supporters__eyebrow">شكر خاص</span>
            <h2 id="supporters-title" className="supporters__title">
              أهل الدعم
            </h2>
            <p className="supporters__intro">
              ناس ساهموا في استمرار المحتوى — وهذي حساباتهم على تيك توك.
            </p>
          </header>

          {SUPPORTERS.length > 0 ? (
            <ul className="supporters__list">
              {SUPPORTERS.map((supporter) => (
                <li className="supporter" key={supporter.tiktok}>
                  <span className="supporter__identity">
                    <span className="supporter__avatar" aria-hidden="true">
                      {supporter.name.trim().charAt(0) || "•"}
                    </span>
                    <span className="supporter__copy">
                      <strong>{supporter.name}</strong>
                      <span>{supporter.detail}</span>
                    </span>
                  </span>
                  <a
                    className="supporter__account"
                    href={supporterTikTokUrl(supporter.tiktok)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`فتح حساب ${supporter.name} ${supporter.tiktok} على تيك توك`}
                  >
                    <span className="supporter__platform">TikTok</span>
                    <bdi>{supporter.tiktok}</bdi>
                    <IconExternalLink size={13} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="supporters__empty">
              <span className="supporters__empty-mark" aria-hidden="true">
                @
              </span>
              <span>
                <strong>قريباً</strong>
                <span>تظهر هنا حسابات الداعمين وتفاصيلهم.</span>
              </span>
            </div>
          )}
        </section>

        <p className="support-note">
          عندك سؤال أو اقتراح؟ راسلني على{" "}
          <a href="mailto:hi@0mar.lol">hi@0mar.lol</a>
        </p>
      </div>
    </main>
  );
}
