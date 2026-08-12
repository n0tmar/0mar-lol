import { createHash } from "node:crypto";

// Payment links (Ziina) — order: Supporter → Sponsor.
// Displayed prices are SAR; links charge in AED (Ziina).
export const SUPPORT_QR_FOREGROUND = "#d4825a";
export const SUPPORT_QR_BACKGROUND = "#ffffff";
const SUPPORT_QR_STYLE_VERSION = "orange-minimal-v1";

export const SUPPORT_TIERS = [
  {
    id: "supporter",
    name: "داعم",
    en: "Supporter",
    desc: "دعمك يفرق معي ويخلّيني أواصل",
    usd: 3,
    sar: 11.25,
    url: "https://pay.ziina.com/martools/fh5DA6C_3?source=app",
  },
  {
    id: "coffee",
    name: "دعم قهوة",
    en: "Coffee Support",
    desc: "اشتر لي قهوة",
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
    desc: "شريك حقيقي في المحتوى، الله يسعدك",
    usd: 25,
    sar: 93.75,
    url: "https://pay.ziina.com/martools/XkC__PHhG?source=app",
  },
  {
    id: "sponsor",
    name: "راعي",
    en: "Sponsor",
    desc: "الراعي الرسمي، شكر خاص من القلب",
    usd: 50,
    sar: 187.5,
    url: "https://pay.ziina.com/martools/rgp_YhNg8?source=app",
  },
] as const;

export function supportQrPath(tier: (typeof SUPPORT_TIERS)[number]) {
  // URL + style-derived filename prevents stale service-worker/browser QR
  // caches when either payment destination or QR palette changes.
  const version = createHash("sha256")
    .update(
      [
        tier.url,
        SUPPORT_QR_STYLE_VERSION,
        SUPPORT_QR_FOREGROUND,
        SUPPORT_QR_BACKGROUND,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 12);
  return `/qr/support-${tier.id}-${version}.svg`;
}
