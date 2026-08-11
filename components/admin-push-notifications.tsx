"use client";

import { useEffect, useRef, useState } from "react";
import { IconBell, IconBellOff } from "@/components/icons";

type PushState =
  | "loading"
  | "disabled"
  | "enabled"
  | "denied"
  | "unsupported";

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function hasSameApplicationServerKey(
  subscription: PushSubscription,
  expected: Uint8Array<ArrayBuffer>,
) {
  const current = subscription.options.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return (
    bytes.length === expected.length &&
    bytes.every((value, index) => value === expected[index])
  );
}

async function registerServiceWorker() {
  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  return navigator.serviceWorker.ready;
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/admin/push", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error(`Push subscription failed: ${response.status}`);
}

async function deleteSubscription(endpoint: string) {
  const response = await fetch("/api/admin/push", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) throw new Error(`Push unsubscribe failed: ${response.status}`);
}

export function AdminPushNotifications({
  publicKey,
}: {
  publicKey: string | null;
}) {
  const [state, setState] = useState<PushState>(
    publicKey ? "loading" : "unsupported",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const messageTimer = useRef<number | null>(null);

  function announce(value: string) {
    setMessage(value);
    if (messageTimer.current !== null) {
      window.clearTimeout(messageTimer.current);
    }
    messageTimer.current = window.setTimeout(() => setMessage(""), 4500);
  }

  useEffect(() => {
    return () => {
      if (messageTimer.current !== null) {
        window.clearTimeout(messageTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      await Promise.resolve();
      const iosNavigator = navigator as Navigator & { standalone?: boolean };
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        iosNavigator.standalone === true;
      if (
        !publicKey ||
        (isIOS && !isStandalone) ||
        process.env.NODE_ENV !== "production" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) setState("unsupported");
        return;
      }

      try {
        const registration = await registerServiceWorker();
        const subscription = await registration.pushManager.getSubscription();
        if (!active) return;

        if (subscription) {
          const expectedKey = urlBase64ToUint8Array(publicKey);
          if (!hasSameApplicationServerKey(subscription, expectedKey)) {
            await deleteSubscription(subscription.endpoint).catch(() => {});
            await subscription.unsubscribe();
            if (active) setState("disabled");
            return;
          }

          await saveSubscription(subscription);
          if (active) setState("enabled");
          return;
        }

        setState(Notification.permission === "denied" ? "denied" : "disabled");
      } catch {
        if (active) setState("disabled");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [publicKey]);

  if (!publicKey || state === "unsupported") return null;

  const enabled = state === "enabled";
  const label = enabled
    ? "إيقاف إشعارات التعليقات"
    : state === "denied"
      ? "الإشعارات محظورة"
      : "تفعيل إشعارات التعليقات";

  async function toggle() {
    if (!publicKey || busy || state === "loading") return;
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    if (state === "denied") {
      announce("الإشعارات محظورة. فعّلها من إعدادات التطبيق أو Safari.");
      return;
    }

    setBusy(true);
    try {
      if (enabled) {
        const registration = await registerServiceWorker();
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await deleteSubscription(existing.endpoint);
          await existing.unsubscribe();
        }
        setState("disabled");
        announce("تم إيقاف إشعارات التعليقات على هذا الجهاز.");
        return;
      }

      // iOS requires permission request to happen directly inside user gesture,
      // before any service-worker/network await consumes activation.
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        announce("لم يتم السماح بالإشعارات.");
        return;
      }

      const registration = await registerServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));
      await saveSubscription(subscription);
      setState("enabled");
      announce("تم تفعيل إشعارات التعليقات على هذا الجهاز.");
    } catch {
      announce("تعذر تحديث الإشعارات. حاول مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dash-push">
      <button
        type="button"
        className={`dash-push__button ${enabled ? "is-enabled" : ""}`}
        onClick={toggle}
        disabled={busy || state === "loading"}
        aria-label={label}
        aria-pressed={enabled}
        title={label}
      >
        {state === "denied" ? <IconBellOff size={18} /> : <IconBell size={18} />}
        <span className="dash-push__label">
          {enabled ? "الإشعارات مفعلة" : "إشعارات التعليقات"}
        </span>
      </button>
      {message && (
        <span className="dash-push__status" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </div>
  );
}
