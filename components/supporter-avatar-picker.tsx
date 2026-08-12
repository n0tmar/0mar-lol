"use client";

import { useState } from "react";
import { IconImage } from "@/components/icons";

export function SupporterAvatarPicker({
  id,
  accept,
}: {
  id: string;
  accept: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label className="dash-supporter-avatar-picker" htmlFor={id}>
      <input
        id={id}
        type="file"
        name="avatar"
        accept={accept}
        onChange={(event) =>
          setFileName(event.currentTarget.files?.[0]?.name ?? null)
        }
      />
      <span className="dash-supporter-avatar-picker__button">
        <IconImage size={15} />
        اختر صورة
      </span>
      <span className="dash-supporter-avatar-picker__name" dir="auto">
        {fileName ?? "ما اخترت صورة جديدة"}
      </span>
    </label>
  );
}
