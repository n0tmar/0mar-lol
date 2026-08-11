"use client";

import { IconCopy } from "@/components/icons";

export function CopyId({ id }: { id: string }) {
  return (
    <button
      type="button"
      className="dash-icon-btn"
      title={`نسخ ID المنشور: ${id}`}
      aria-label="نسخ ID المنشور"
      onClick={() => {
        navigator.clipboard.writeText(id).catch(() => {});
      }}
    >
      <IconCopy size={14} />
    </button>
  );
}
