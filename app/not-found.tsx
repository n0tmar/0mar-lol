import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="notfound-page">
      <div className="notfound-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="notfound-cat"
          src="/avatars/cats/cat-3.webp"
          alt=""
          width={96}
          height={96}
        />
        <p className="notfound-code" aria-hidden="true">
          404
        </p>
        <h1 className="notfound-title">الصفحة غير موجودة</h1>
        <p className="notfound-subtitle">
          الرابط اللي دخلته غلط، أو الصفحة اتشالت.
          <br />
          القطة ضاعت، بس الموقع لسّه شغال.
        </p>
        <Link className="notfound-home" href="/">
          ← الرجوع للرئيسية
        </Link>
      </div>
    </main>
  );
}
