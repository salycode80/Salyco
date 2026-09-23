import { useState, useEffect, useCallback, useRef } from "react";
import {
  Images,
  Plus,
  Trash2,
  Loader2,
  Filter,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import {
  listAdminGallery,
  createAdminGalleryImage,
  updateAdminGalleryImage,
  deleteAdminGalleryImage,
} from "../../api/admin";
import { getProductImageUrl } from "../../utils/productImage";
import { toPersianNumber } from "../../utils/persian";

const CARD =
  "rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]";
const INPUT =
  "h-12 w-full rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm " +
  "text-text-primary placeholder-text-secondary outline-none transition " +
  "focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20";
const LABEL = "mb-1.5 block font-persian text-sm font-medium text-text-primary";

const EMPTY_FORM = { title: "", image: null, order: "0", is_active: true };

/**
 * The About page's "گالری سالیکو" section.
 *
 * The section used to render a hard-coded list of paths, so every change was a
 * code edit. This panel is what replaced it: rows added here appear on the
 * public page in `order`, and the section hides itself while the list is empty.
 */
export default function GalleryPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // The file input is uncontrolled apart from this: clearing a pick has to
  // clear the widget itself, which only a DOM write can do.
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAdminGallery());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick, same as CouponsPanel: load() sets the loading flag, and
    // doing that synchronously in the effect body forces a cascading render
    // before the first paint.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setFormError("");
    setForm({
      title: row.title,
      // Null, not the existing path: a blank file input means "keep the current
      // image", and re-sending the stored path would fail the FileField.
      image: null,
      order: String(row.order ?? 0),
      is_active: row.is_active,
    });
    if (fileRef.current) fileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    // Clear the panel-level error too, or the last failed delete keeps sitting
    // above a form that has since been corrected.
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        order: Number(form.order) || 0,
        is_active: form.is_active,
      };
      // Only sent when a new file was actually picked — on an edit the stored
      // image is left alone.
      if (form.image) payload.image = form.image;

      if (editingId) await updateAdminGalleryImage(editingId, payload);
      else await createAdminGalleryImage(payload);
      resetForm();
      await load();
    } catch (err) {
      // The server's Persian, verbatim: it knows which rule failed.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row) => {
    setBusyId(row.id);
    setError("");
    try {
      const updated = await updateAdminGalleryImage(row.id, {
        is_active: !row.is_active,
      });
      setRows((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("این تصویر از گالری حذف شود؟")) return;
    setBusyId(id);
    setError("");
    try {
      await deleteAdminGalleryImage(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
        <Images size={16} aria-hidden="true" />
        Gallery
      </p>
      <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
        گالری تصاویر
      </h1>
      <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
      <p className="mt-4 max-w-2xl font-persian text-sm leading-7 text-text-secondary">
        تصاویری که در بخش «گالری سالیکو» صفحهٔ درباره ما نمایش داده می‌شود. ترتیب
        نمایش با فیلد «ترتیب» تعیین می‌شود و تصاویر غیرفعال روی سایت دیده نمی‌شوند.
        {rows.length > 0 && (
          <span className="mr-1 font-semibold text-brand-navy">
            ({toPersianNumber(activeCount)} تصویر فعال از{" "}
            {toPersianNumber(rows.length)})
          </span>
        )}
      </p>

      {/* ── create / edit ── */}
      <form onSubmit={handleSubmit} className={`${CARD} mt-6 p-4 md:p-6`}>
        <h2 className="mb-4 font-persian text-lg font-semibold text-brand-navy">
          {editingId ? "ویرایش تصویر" : "افزودن تصویر"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="g-title" className={LABEL}>
              عنوان
            </label>
            <input
              id="g-title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="متن جایگزین تصویر برای screen reader"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="g-order" className={LABEL}>
              ترتیب نمایش
            </label>
            <input
              id="g-order"
              type="number"
              min="0"
              value={form.order}
              onChange={(e) => set("order", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="g-image" className={LABEL}>
            تصویر{editingId && " (برای تغییر انتخاب کنید)"}
          </label>
          {/* The input is clipped, so it cannot draw its own focus ring — the
              whole row does it instead, via focus-within. Without this a
              keyboard user tabbing here has no idea where they are. */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-navy">
            <input
              id="g-image"
              ref={fileRef}
              type="file"
              accept="image/*"
              // Required only while adding: on an edit, leaving it blank keeps the
              // image already stored.
              required={!editingId}
              onChange={(e) => set("image", e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="g-image"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-brand-navy bg-white px-4 py-2.5 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
            >
              <Upload size={15} aria-hidden="true" />
              انتخاب فایل
            </label>
            <span className="min-w-0 flex-1 truncate font-persian text-sm text-text-secondary">
              {form.image
                ? form.image.name
                : editingId
                  ? "تصویر فعلی حفظ می‌شود."
                  : "فایلی انتخاب نشده است."}
            </span>
            {form.image && (
              <button
                type="button"
                onClick={() => {
                  set("image", null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                // No aria-label: the visible text is the accessible name, and
                // the glyph beside it is decorative (§2.5.3).
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 font-persian text-xs text-text-secondary transition hover:text-status-error"
              >
                <X size={14} aria-hidden="true" />
                لغو انتخاب
              </button>
            )}
          </div>
          {form.image && (
            <img
              src={URL.createObjectURL(form.image)}
              alt=""
              aria-hidden="true"
              className="mt-3 h-28 w-28 rounded-lg border border-brand-mist object-cover"
            />
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 font-persian text-sm font-medium text-text-primary">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="h-4 w-4 accent-brand-navy"
          />
          نمایش در سایت
        </label>

        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
          >
            {formError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            {editingId ? "ذخیره تغییرات" : "افزودن تصویر"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border-2 border-brand-navy px-6 py-3 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
            >
              انصراف
            </button>
          )}
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
        >
          {error}
        </p>
      )}

      {/* ── list ── */}
      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2
              className="animate-spin text-brand-navy"
              size={28}
              aria-hidden="true"
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center gap-3 py-12`}>
            <Filter size={40} className="text-brand-mist" aria-hidden="true" />
            <p className="font-persian text-sm text-text-secondary">
              هنوز تصویری به گالری اضافه نشده است.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            const busy = busyId === row.id;
            return (
              <div
                key={row.id}
                className={`${CARD} flex flex-wrap items-center gap-4 p-4`}
              >
                <img
                  src={getProductImageUrl(row.image_url)}
                  alt={row.title}
                  className="h-20 w-20 shrink-0 rounded-lg border border-brand-mist bg-brand-warm-white object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="font-persian text-sm font-semibold text-text-primary">
                    {row.title}
                  </p>
                  <p className="mt-1 font-persian text-xs text-text-secondary">
                    ترتیب: {toPersianNumber(row.order)}
                    {!row.is_active && " · روی سایت نمایش داده نمی‌شود"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy px-3 py-2 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
                  >
                    <Pencil size={15} aria-hidden="true" />
                    ویرایش
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(row)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy px-3 py-2 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : row.is_active ? (
                      <ToggleRight size={16} aria-hidden="true" />
                    ) : (
                      <ToggleLeft size={16} aria-hidden="true" />
                    )}
                    {row.is_active ? "غیرفعال کن" : "فعال کن"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-status-error px-3 py-2 font-persian text-sm font-bold text-status-error transition hover:bg-status-error-bg disabled:opacity-60"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    حذف
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
