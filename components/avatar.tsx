"use client";

export function Avatar({ className, src, alt, fetchPriority }: { className: string; src: string; alt: string; fetchPriority?: "high" | "low" | "auto" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      fetchPriority={fetchPriority}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
