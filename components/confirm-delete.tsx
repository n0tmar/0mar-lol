"use client";

import { FormEvent } from "react";

export function ConfirmDelete({
  action,
  message = "حذف هذا التعليق نهائياً؟",
  children,
}: {
  action: string;
  message?: string;
  children?: React.ReactNode;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} method="post" onSubmit={onSubmit}>
      <input type="hidden" name="action" value="delete" />
      {children ?? (
        <button className="dash-btn--danger" type="submit">
          حذف
        </button>
      )}
    </form>
  );
}
