"use client";

import { useEffect } from "react";

const SEEN_COOKIE = "omar_comments_seen";

/** Marks all comments as seen when the admin opens the comments page. */
export function MarkCommentsSeen() {
  useEffect(() => {
    document.cookie = `${SEEN_COOKIE}=${Date.now()}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);
  return null;
}
