import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";

export const metadata: Metadata = {
  title: "الدعم",
  description:
    "ادعم عمر — دعمك يساعدني على استمرار المحتوى والأدوات. الدفع عبر Ziina بالدرهم الإماراتي.",
};

// Payment links (Ziina) — order: Supporter → Sponsor.
// Displayed prices are SAR; links charge in AED (Ziina).
const TIERS = [
  {
    id: "supporter",
    name: "داعم",
    en: "Supporter",
    desc: "شكراً من القلب — دعمك يساند المحتوى",
    usd: 3,
    sar: 11.25,
    url: "https://pay.ziina.com/martools/fh5DA6C_3?source=app",
  },
  {
    id: "coffee",
    name: "دعم قهوة",
    en: "Coffee Support",
    desc: "قهوة أشربها وأكمل الشغل لك",
    usd: 5,
    sar: 18.75,
    url: "https://pay.ziina.com/martools/ECp5CC5x6?source=app",
  },
  {
    id: "project",
    name: "دعم مشروع",
    en: "Project Support",
    desc: "يساعدني أشتغل على أدوات ومشاريع جديدة",
    usd: 10,
    sar: 37.5,
    url: "https://pay.ziina.com/martools/7TkpdSEfe?source=app",
  },
  {
    id: "big",
    name: "داعم كبير",
    en: "Big Supporter",
    desc: "شريك حقيقي في المحتوى، وأنا دايم أذكرك",
    usd: 25,
    sar: 93.75,
    url: "https://pay.ziina.com/martools/XkC__PHhG?source=app",
  },
  {
    id: "sponsor",
    name: "راعي",
    en: "Sponsor",
    desc: "الراعي الرسمي — شكراً خاص من القلب",
    usd: 50,
    sar: 187.5,
    url: "https://pay.ziina.com/martools/rgp_YhNg8?source=app",
  },
] as const;

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

        <div className="support-tiers">
          {TIERS.map((tier, index) => (
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
