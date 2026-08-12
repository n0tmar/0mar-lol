export type EmailSubscriptionRecord = {
  id: string;
  email: string;
  ip_hash: string;
  unsubscribe_token: string;
  created_at: number;
};

export const EMAIL_SUBSCRIPTION_LIMIT = 3;
export const EMAIL_SUBSCRIPTION_WINDOW_MS = 60 * 60 * 1000;

const LOCAL_PART = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeEmail(rawValue: string): string | null {
  const value = rawValue.trim().toLowerCase();
  if (value.length < 3 || value.length > 254 || /[\s\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }

  const at = value.lastIndexOf("@");
  if (at < 1 || at !== value.indexOf("@")) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !LOCAL_PART.test(local)
  ) {
    return null;
  }

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) {
    return null;
  }
  const topLevel = labels.at(-1)!;
  if (topLevel.length < 2 || (!/^[a-z]{2,63}$/i.test(topLevel) && !topLevel.startsWith("xn--"))) {
    return null;
  }

  return `${local}@${domain}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}
