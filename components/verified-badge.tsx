import { IconVerified } from "@/components/icons";

/** Verified badge — orange check, shown next to the owner's name. */
export function VerifiedBadge({ size = 17 }: { size?: number }) {
  return (
    <span className="verified-badge" aria-label="حساب موثق">
      <IconVerified size={size} />
    </span>
  );
}
