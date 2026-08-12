export type Supporter = {
  name: string;
  tiktok: `@${string}`;
  detail: string;
};

// Add supporters here in display order. Example:
// {
//   name: "اسم الداعم",
//   tiktok: "@username",
//   detail: "داعم للمحتوى",
// },
export const SUPPORTERS: readonly Supporter[] = [];

export function supporterTikTokUrl(handle: Supporter["tiktok"]) {
  const username = handle.slice(1).trim();
  return `https://www.tiktok.com/@${encodeURIComponent(username)}`;
}
