import { OWNER_NAME } from "@/lib/constants";

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const CAT_COUNT = 18;

function CatImg({ index, size }: { index: number; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="cat-avatar"
      src={`/avatars/cats/cat-${index}.webp`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * Commenter avatar: the site owner always shows their real profile
 * picture; everyone else gets a deterministic cat from the visitor
 * identity (per-browser cookie), so the same user always keeps the
 * same pfp — even if display names ever change.
 */
export function UserAvatar({
  name,
  visitorId,
  size = 32,
}: {
  name: string;
  visitorId?: string | null;
  size?: number;
}) {
  if (name === OWNER_NAME) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="cat-avatar owner-avatar"
        src="/avatar.jpg"
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const seed = (visitorId || name).trim().toLowerCase();
  return <CatImg index={hashString(seed) % CAT_COUNT} size={size} />;
}
