import type { SupporterRecord } from "@/lib/supporters";
import { supporterAvatarUrl } from "@/lib/supporters";

export function SupporterAvatar({
  supporter,
  className,
  size = 38,
}: {
  supporter: SupporterRecord;
  className: string;
  size?: number;
}) {
  const avatarUrl = supporterAvatarUrl(supporter);

  return (
    <span className={className} aria-hidden="true">
      {avatarUrl ? (
        // Already cropped and encoded as a small 192px WebP during upload;
        // another optimizer hop would add work without reducing layout cost.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
        />
      ) : (
        supporter.name.trim().charAt(0) || "•"
      )}
    </span>
  );
}
