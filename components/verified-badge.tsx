/** Verified badge — orange check icon, shown next to the owner's name. */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="verified-badge"
      src="/icons/verify.png"
      alt="حساب موثق"
      width={size}
      height={size}
    />
  );
}
