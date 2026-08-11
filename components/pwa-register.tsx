"use client";

import { useEffect } from "react";

/** Registers the service worker after the page becomes idle. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onIdle = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(onIdle);
    } else {
      setTimeout(onIdle, 3000);
    }
  }, []);
  return null;
}
