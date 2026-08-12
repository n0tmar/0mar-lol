export type TikTokHandle = `@${string}`;

export const SUPPORTER_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORTER_AVATAR_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/gif";
const SUPPORTER_AVATAR_TYPES = new Set(SUPPORTER_AVATAR_ACCEPT.split(","));

export type SupporterRecord = {
  id: string;
  name: string;
  tiktok_handle: TikTokHandle;
  detail: string;
  avatar_path: string | null;
  avatar_updated_at: number;
  visible: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

export type SupporterInput = {
  name: string;
  tiktokHandle: TikTokHandle;
  detail: string;
  visible: boolean;
};

type SupporterCandidate = {
  name: string;
  tiktok: string;
  detail: string;
  visible: boolean;
};

export type SupporterParseResult =
  | { ok: true; value: SupporterInput }
  | { ok: false; error: string };

const TIKTOK_USERNAME = /^(?!\.)(?!.*\.$)[a-z0-9._]{2,24}$/;

export function normalizeTikTokHandle(rawValue: string): TikTokHandle | null {
  let value = rawValue.trim();

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host !== "tiktok.com" && host !== "m.tiktok.com") return null;
      const match = url.pathname.match(/^\/@([^/]+)/);
      if (!match) return null;
      value = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  const username = value.replace(/^@+/, "").trim().toLowerCase();
  if (!TIKTOK_USERNAME.test(username)) return null;
  return `@${username}`;
}

export function parseSupporterInput(
  candidate: SupporterCandidate,
): SupporterParseResult {
  const name = candidate.name.trim().replace(/\s+/g, " ");
  const detail = candidate.detail.trim().replace(/\s+/g, " ");
  const tiktokHandle = normalizeTikTokHandle(candidate.tiktok);

  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "اسم الداعم يجب أن يكون بين حرف و80 حرفاً." };
  }
  if (!tiktokHandle) {
    return { ok: false, error: "أدخل اسم مستخدم أو رابط تيك توك صحيحاً." };
  }
  if (detail.length > 300) {
    return { ok: false, error: "تفاصيل الداعم أطول من 300 حرف." };
  }

  return {
    ok: true,
    value: {
      name,
      tiktokHandle,
      detail,
      visible: candidate.visible,
    },
  };
}

export function validateSupporterAvatarUpload(
  upload: Pick<File, "size" | "type">,
): string | null {
  if (upload.size > SUPPORTER_AVATAR_MAX_BYTES) {
    return "حجم صورة الداعم أكبر من 5 ميجابايت.";
  }
  if (!SUPPORTER_AVATAR_TYPES.has(upload.type.toLowerCase())) {
    return "صيغة صورة الداعم غير مدعومة. استخدم JPG أو PNG أو WebP أو AVIF أو GIF.";
  }
  return null;
}

export function supporterAvatarUrl(
  supporter: Pick<SupporterRecord, "id" | "avatar_path" | "avatar_updated_at">,
): string | null {
  if (!supporter.avatar_path) return null;
  return `/api/supporters/${encodeURIComponent(supporter.id)}/avatar?v=${supporter.avatar_updated_at}`;
}

export function supporterTikTokUrl(handle: string) {
  const username = handle.trim().replace(/^@+/, "");
  return `https://www.tiktok.com/@${encodeURIComponent(username)}`;
}
