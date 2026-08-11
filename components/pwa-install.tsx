"use client";

import { useEffect, useRef, useState } from "react";
import { IconDownload } from "@/components/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V3m0 0L8 7m4-4 4 4" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const installed = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Browser owns native prompt; failures are not actionable in-page.
    } finally {
      setInstallPrompt(null);
    }
  }

  return (
    <div className="pwa-install">
      {installPrompt && (
        <button
          type="button"
          className="profile-link pwa-install__button pwa-install__button--native"
          onClick={install}
        >
          <IconDownload size={17} />
          <span>ثبّت التطبيق</span>
        </button>
      )}

      <button
        type="button"
        className="profile-link pwa-install__button pwa-install__button--ios"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
      >
        <IconDownload size={17} />
        <span>ثبّت التطبيق</span>
      </button>

      <dialog
        ref={dialogRef}
        className="pwa-install-dialog"
        aria-labelledby="pwa-install-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="pwa-install-dialog__panel">
          <span className="pwa-install-dialog__icon" aria-hidden="true">
            <ShareIcon />
          </span>
          <h2 id="pwa-install-title">ثبّت 0MAR على جهازك</h2>
          <ol>
            <li>افتح الموقع في Safari.</li>
            <li>
              اضغط زر المشاركة <ShareIcon />.
            </li>
            <li>اختر «إضافة إلى الشاشة الرئيسية».</li>
          </ol>
          <button type="button" onClick={() => dialogRef.current?.close()}>
            فهمت
          </button>
        </div>
      </dialog>
    </div>
  );
}
