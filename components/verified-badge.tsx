/**
 * Verified badge — orange check icon next to the owner's name.
 * 64px asset on mobile, 512px asset on desktop (CSS-switched; the hidden
 * copy is display:none so only the visible one is announced/layout).
 */
export function VerifiedBadge({ size = 20 }: { size?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="verified-badge verified-badge--mobile"
        src="/icons/verify.png"
        alt="حساب موثق"
        width={size}
        height={size}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="verified-badge verified-badge--desktop"
        src="/icons/verify_512.png"
        alt="حساب موثق"
        width={size}
        height={size}
        loading="lazy"
      />
    </>
  );
}
