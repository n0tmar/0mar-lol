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
 * picture; everyone else gets a deterministic cat from the name hash.
 */
export function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
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
  return <CatImg index={hashString(name.trim().toLowerCase()) % CAT_COUNT} size={size} />;
}

// Kept for compatibility with earlier usage.
export function CatAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return <UserAvatar name={name} size={size} />;
}
