import type { Metadata } from "next";
import { ConfirmDelete } from "@/components/confirm-delete";
import { IconExternalLink } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { publicSiteRoot } from "@/lib/dashboard-host";
import { listDashboardSupporters } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الداعمين",
  robots: { index: false, follow: false },
};

export default async function DashboardSupportersPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    moved?: string;
    error?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supporters = listDashboardSupporters();
  const publicRoot = publicSiteRoot();
  const supportUrl = publicRoot === "/" ? "/support" : `${publicRoot}support`;

  return (
    <div className="dash-page dash-supporters-page">
      <header className="dash-supporters-head">
        <div>
          <h1 className="dash-page__title">
            الداعمين
            <span className="dash-page__count">{supporters.length}</span>
          </h1>
          <p>أضف الحسابات، عدّل التفاصيل، أخفِها، أو غيّر ترتيب ظهورها.</p>
        </div>
        <a href={supportUrl} target="_blank" rel="noreferrer">
          معاينة صفحة الدعم
          <IconExternalLink size={14} />
        </a>
      </header>

      {params.created && (
        <p className="dash-alert dash-alert--spaced" role="status">
          تمت إضافة الداعم.
        </p>
      )}
      {params.updated && (
        <p className="dash-alert dash-alert--spaced" role="status">
          تم حفظ تفاصيل الداعم.
        </p>
      )}
      {params.deleted && (
        <p className="dash-alert dash-alert--spaced" role="status">
          تم حذف الداعم.
        </p>
      )}
      {params.moved && (
        <p className="dash-alert dash-alert--spaced" role="status">
          تم تغيير ترتيب الداعمين.
        </p>
      )}
      {params.error && (
        <p className="dash-alert dash-alert--error dash-alert--spaced" role="alert">
          {decodeURIComponent(params.error)}
        </p>
      )}

      <section className="dash-supporter-create" aria-labelledby="add-supporter-title">
        <div className="dash-supporter-section-head">
          <h2 id="add-supporter-title">إضافة داعم</h2>
          <span>يظهر في أعلى صفحة الدعم</span>
        </div>
        <form
          className="dash-supporter-form"
          action="/api/admin/supporters"
          method="post"
        >
          <label>
            <span>اسم الداعم</span>
            <input
              name="name"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="الاسم الظاهر"
            />
          </label>
          <label>
            <span>حساب تيك توك</span>
            <input
              name="tiktok"
              required
              maxLength={160}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              placeholder="@username أو رابط الحساب"
            />
          </label>
          <label className="dash-supporter-form__detail">
            <span>التفاصيل</span>
            <textarea
              name="detail"
              maxLength={300}
              placeholder="مثال: داعم للمحتوى من البداية"
            />
            <small>اختياري · حتى 300 حرف</small>
          </label>
          <div className="dash-supporter-form__footer">
            <label className="dash-supporter-check">
              <input type="checkbox" name="visible" defaultChecked />
              <span>ظاهر في صفحة الدعم</span>
            </label>
            <button className="dash-supporter-save" type="submit">
              إضافة الداعم
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="manage-supporters-title">
        <div className="dash-supporter-section-head dash-supporter-section-head--list">
          <h2 id="manage-supporters-title">إدارة الداعمين</h2>
          <span>الترتيب من الأعلى للأسفل</span>
        </div>

        {supporters.length === 0 ? (
          <p className="dash-empty">ما أضفت أي داعم حتى الآن.</p>
        ) : (
          <div className="dash-supporter-list">
            {supporters.map((supporter, index) => (
              <details
                className="dash-supporter-card"
                data-supporter-id={supporter.id}
                key={supporter.id}
              >
                <summary>
                  <span className="dash-supporter-card__avatar" aria-hidden="true">
                    {supporter.name.trim().charAt(0) || "•"}
                  </span>
                  <span className="dash-supporter-card__identity">
                    <strong>{supporter.name}</strong>
                    <bdi>{supporter.tiktok_handle}</bdi>
                  </span>
                  <span
                    className={
                      supporter.visible === 1
                        ? "dash-supporter-status dash-supporter-status--visible"
                        : "dash-supporter-status"
                    }
                  >
                    {supporter.visible === 1 ? "ظاهر" : "مخفي"}
                  </span>
                  <span className="dash-supporter-card__edit" aria-hidden="true">
                    تعديل
                  </span>
                </summary>

                <div className="dash-supporter-card__body">
                  <form
                    className="dash-supporter-form"
                    action={`/api/admin/supporters/${supporter.id}`}
                    method="post"
                  >
                    <input type="hidden" name="action" value="update" />
                    <input
                      type="hidden"
                      name="expected_updated_at"
                      value={supporter.updated_at}
                    />
                    <label>
                      <span>اسم الداعم</span>
                      <input
                        name="name"
                        required
                        maxLength={80}
                        defaultValue={supporter.name}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      <span>حساب تيك توك</span>
                      <input
                        name="tiktok"
                        required
                        maxLength={160}
                        defaultValue={supporter.tiktok_handle}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        dir="ltr"
                      />
                    </label>
                    <label className="dash-supporter-form__detail">
                      <span>التفاصيل</span>
                      <textarea
                        name="detail"
                        maxLength={300}
                        defaultValue={supporter.detail}
                      />
                      <small>اختياري · حتى 300 حرف</small>
                    </label>
                    <div className="dash-supporter-form__footer">
                      <label className="dash-supporter-check">
                        <input
                          type="checkbox"
                          name="visible"
                          defaultChecked={supporter.visible === 1}
                        />
                        <span>ظاهر في صفحة الدعم</span>
                      </label>
                      <button className="dash-supporter-save" type="submit">
                        حفظ التعديلات
                      </button>
                    </div>
                  </form>

                  <div className="dash-supporter-manage">
                    <span>الترتيب {index + 1}</span>
                    <div>
                      <form
                        action={`/api/admin/supporters/${supporter.id}`}
                        method="post"
                      >
                        <input type="hidden" name="action" value="move_up" />
                        <button
                          className="dash-supporter-secondary"
                          type="submit"
                          disabled={index === 0}
                        >
                          للأعلى ↑
                        </button>
                      </form>
                      <form
                        action={`/api/admin/supporters/${supporter.id}`}
                        method="post"
                      >
                        <input type="hidden" name="action" value="move_down" />
                        <button
                          className="dash-supporter-secondary"
                          type="submit"
                          disabled={index === supporters.length - 1}
                        >
                          للأسفل ↓
                        </button>
                      </form>
                      <ConfirmDelete
                        action={`/api/admin/supporters/${supporter.id}`}
                        message={`حذف ${supporter.name} من قائمة الداعمين نهائياً؟`}
                      >
                        <button
                          className="dash-supporter-secondary dash-supporter-secondary--danger"
                          type="submit"
                        >
                          حذف
                        </button>
                      </ConfirmDelete>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
