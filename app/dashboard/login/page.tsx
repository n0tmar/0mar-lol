import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { dashboardBasePath, publicSiteRoot } from "@/lib/dashboard-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دخول",
  robots: { index: false, follow: false },
};

export default async function DashboardLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const base = await dashboardBasePath();
  if (await isAdmin()) redirect(base || "/");
  const params = await searchParams;
  const configError = params.error === "config";

  return (
    <main className="login-page">
      <div className="login-stack">
        <div className="login-brand" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar.jpg" alt="" width={56} height={56} />
        </div>
        <h1 className="login-title">لوحة التحكم</h1>
        <p className="login-subtitle">أدخل كلمة المرور للوصول إلى المنشورات والتعليقات.</p>

        <form className="login-form" action="/api/admin/login" method="post">
          <label className="login-field">
            <span>كلمة المرور</span>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="current-password"
              autoFocus
              placeholder="••••••••••"
              aria-label="كلمة المرور"
              aria-invalid={configError || undefined}
            />
          </label>
          <button type="submit">دخول</button>
        </form>

        {params.error && (
          <p className="login-error" role="alert">
            {configError
              ? "إعدادات الحماية ناقصة على الخادم."
              : params.error === "locked"
                ? "محاولات كثيرة — جرب بعد ربع ساعة."
                : "كلمة المرور غير صحيحة."}
          </p>
        )}

        <Link className="login-back" href={publicSiteRoot()}>
          → العودة للموقع
        </Link>
      </div>
    </main>
  );
}
