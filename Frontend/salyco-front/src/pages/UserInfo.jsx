import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../hooks/UseAuth";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  Calendar,
  ShieldCheck,
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShoppingBag,
  Clock,
  ChevronDown,
  ChevronUp,
  Truck,
} from "lucide-react";
import { getMyOrders } from "../api/orders";

const EMPTY_PROFILE = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  address: "",
  postal_code: "",
};

const EMPTY_PASSWORD = {
  old_password: "",
  new_password: "",
  confirm_password: "",
};

export default function UserInfo() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile editing
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Password change
  const [pwForm, setPwForm] = useState(EMPTY_PASSWORD);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  const fillForm = (data) => ({
    first_name: data.first_name || "",
    last_name: data.last_name || "",
    email: data.email || "",
    phone_number: data.phone_number || "",
    address: data.address || "",
    postal_code: data.postal_code || "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    api
      .get("/api/user/me/")
      .then((res) => {
        setUser(res.data);
        setForm(fillForm(res.data));
      })
      .catch(() => setError("خطا در دریافت اطلاعات کاربر"))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  // Load orders
  useEffect(() => {
    if (isAuthenticated) {
      getMyOrders()
        .then((data) => setOrders(Array.isArray(data) ? data : data.results || []))
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false));
    }
  }, [isAuthenticated]);

  const getUserInitials = (username) => {
    if (!username) return "?";
    return username.charAt(0).toUpperCase();
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.patch("/api/user/me/", form);
      setUser(res.data);
      setForm(fillForm(res.data));
      setEditing(false);
      setSuccess("اطلاعات با موفقیت ذخیره شد");
    } catch (err) {
      const data = err?.response?.data;
      const first =
        data && typeof data === "object"
          ? Object.values(data).flat()[0]
          : null;
      setError(first || "ذخیره اطلاعات با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setError("");
    if (user) setForm(fillForm(user));
  };

  const handleChangePassword = async () => {
    setPwError("");
    setPwSuccess("");

    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError("رمز عبور جدید و تکرار آن یکسان نیستند");
      return;
    }
    if (pwForm.new_password.length < 8) {
      setPwError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد");
      return;
    }

    setPwSaving(true);
    try {
      await api.post("/api/user/change-password/", {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      });
      setPwForm(EMPTY_PASSWORD);
      setPwSuccess("رمز عبور با موفقیت تغییر کرد");
    } catch (err) {
      const data = err?.response?.data;
      const first =
        data && typeof data === "object"
          ? Object.values(data).flat()[0]
          : null;
      setPwError(first || "تغییر رمز عبور با خطا مواجه شد");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="animate-pulse text-[#003087] text-sm">
          در حال بارگذاری...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pt-32 pb-16 px-4" dir="rtl">
      <div className="mx-auto max-w-2xl">
        {/* Header card */}
        <div className="rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,48,135,0.06)] mb-6">
          <div className="bg-[#003087] px-6 py-8 flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-bold text-white">
                {getUserInitials(user?.username)}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {[user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
                  user?.username}
              </h1>
              <p className="text-sm text-white/80 truncate">
                {user?.username}
              </p>
              {user?.is_staff && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-white bg-white/15 rounded-full px-2.5 py-1">
                  <ShieldCheck size={12} />
                  مدیر سیستم
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(0,48,135,0.06)] border border-[#CBD2D6] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#CBD2D6]">
            <h2 className="text-base font-bold text-[#1A1A2E]">اطلاعات حساب</h2>
            {!editing ? (
              <button
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                }}
                className="flex items-center gap-1.5 text-sm font-medium text-[#003087] hover:text-[#00246B] transition-colors"
              >
                <Edit3 size={15} />
                ویرایش
              </button>
            ) : (
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 text-sm font-medium text-[#687173] hover:text-[#1A1A2E] transition-colors"
              >
                <X size={15} />
                انصراف
              </button>
            )}
          </div>

          <div className="divide-y divide-[#CBD2D6]">
            {/* Username - read only */}
            <Field icon={User} label="نام کاربری">
              <p className="text-sm font-medium text-[#1A1A2E]">
                {user?.username}
              </p>
            </Field>

            {/* First name */}
            <Field icon={User} label="نام">
              {editing ? (
                <TextInput
                  value={form.first_name}
                  onChange={(v) => setForm({ ...form, first_name: v })}
                />
              ) : (
                <ReadValue value={user?.first_name} />
              )}
            </Field>

            {/* Last name */}
            <Field icon={User} label="نام خانوادگی">
              {editing ? (
                <TextInput
                  value={form.last_name}
                  onChange={(v) => setForm({ ...form, last_name: v })}
                />
              ) : (
                <ReadValue value={user?.last_name} />
              )}
            </Field>

            {/* Email */}
            <Field icon={Mail} label="ایمیل">
              {editing ? (
                <TextInput
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
              ) : (
                <ReadValue value={user?.email} />
              )}
            </Field>

            {/* Phone */}
            <Field icon={Phone} label="شماره تماس">
              {editing ? (
                <TextInput
                  type="tel"
                  dir="ltr"
                  value={form.phone_number}
                  onChange={(v) => setForm({ ...form, phone_number: v })}
                />
              ) : (
                <ReadValue value={user?.phone_number} />
              )}
            </Field>

            {/* Address */}
            <Field icon={MapPin} label="آدرس">
              {editing ? (
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border border-[#CBD2D6] px-3 py-1.5
                             focus:outline-none focus:border-2 focus:border-[#003087] resize-none"
                />
              ) : (
                <ReadValue value={user?.address} />
              )}
            </Field>

            {/* Postal code */}
            <Field icon={Hash} label="کد پستی">
              {editing ? (
                <TextInput
                  dir="ltr"
                  value={form.postal_code}
                  onChange={(v) => setForm({ ...form, postal_code: v })}
                />
              ) : (
                <ReadValue value={user?.postal_code} />
              )}
            </Field>

            {/* Join date */}
            {user?.date_joined && (
              <Field icon={Calendar} label="تاریخ عضویت">
                <p className="text-sm font-medium text-[#1A1A2E]">
                  {new Date(user.date_joined).toLocaleDateString("fa-IR")}
                </p>
              </Field>
            )}
          </div>

          {editing && (
            <div className="px-6 py-4 bg-[#F5F7FA] flex items-center justify-between gap-3">
              {error && <p className="text-xs text-[#D20000]">{error}</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm font-medium text-white
                           bg-[#003087] hover:bg-[#00246B] disabled:opacity-60
                           rounded-lg px-4 py-2 transition-colors mr-auto"
              >
                <Save size={15} />
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </div>
          )}
        </div>

        {/* Success / error banners for profile (view mode) */}
        {success && !editing && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-[#019C34] mt-3">
            <CheckCircle2 size={15} />
            {success}
          </p>
        )}
        {error && !editing && (
          <p className="text-sm text-[#D20000] mt-3 text-center">{error}</p>
        )}

        {/* Password change card */}
        <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(0,48,135,0.06)] border border-[#CBD2D6] overflow-hidden mt-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#CBD2D6]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#1A1A2E]">
              <Lock size={16} className="text-[#687173]" />
              تغییر رمز عبور
            </h2>
            <button
              onClick={() => setShowPw((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#687173] hover:text-[#1A1A2E] transition-colors"
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPw ? "پنهان کردن" : "نمایش"}
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <PasswordInput
              label="رمز عبور فعلی"
              show={showPw}
              value={pwForm.old_password}
              onChange={(v) => setPwForm({ ...pwForm, old_password: v })}
            />
            <PasswordInput
              label="رمز عبور جدید"
              show={showPw}
              value={pwForm.new_password}
              onChange={(v) => setPwForm({ ...pwForm, new_password: v })}
            />
            <PasswordInput
              label="تکرار رمز عبور جدید"
              show={showPw}
              value={pwForm.confirm_password}
              onChange={(v) => setPwForm({ ...pwForm, confirm_password: v })}
            />

            {pwError && <p className="text-xs text-[#D20000]">{pwError}</p>}
            {pwSuccess && (
              <p className="flex items-center gap-1.5 text-xs text-[#019C34]">
                <CheckCircle2 size={14} />
                {pwSuccess}
              </p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={
                pwSaving ||
                !pwForm.old_password ||
                !pwForm.new_password ||
                !pwForm.confirm_password
              }
              className="flex items-center gap-1.5 text-sm font-medium text-white
                         bg-[#003087] hover:bg-[#00246B] disabled:opacity-50
                         disabled:cursor-not-allowed rounded-lg px-4 py-2 transition-colors"
            >
              <Lock size={15} />
              {pwSaving ? "در حال تغییر..." : "تغییر رمز عبور"}
            </button>
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(0,48,135,0.06)] border border-[#CBD2D6] overflow-hidden mt-6">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-[#CBD2D6]">
            <ShoppingBag size={18} className="text-[#003087]" />
            <h2 className="text-base font-bold text-[#1A1A2E]">سفارش‌های من</h2>
          </div>

          <div className="p-6">
            {ordersLoading ? (
              <p className="text-center text-sm text-[#687173]">در حال بارگذاری...</p>
            ) : orders.length === 0 ? (
              <p className="text-center text-sm text-[#687173]">هنوز سفارشی ثبت نشده است.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const isPhone = order.method === "PHONE";
                  const isExpanded = expandedOrder === order.id;
                  const STATUS_META = {
                    PENDING: { label: "در انتظار", cls: "bg-[#FFF8E1] text-[#F5BA2E]" },
                    CONFIRMED: { label: "تأیید شده", cls: "bg-[#E6F0FB] text-[#003087]" },
                    SHIPPED: { label: "ارسال شده", cls: "bg-[#E6F4EA] text-[#019C34]" },
                    CANCELLED: { label: "لغو شده", cls: "bg-[#FDE7E7] text-[#D20000]" },
                  };

                  return (
                    <div
                      key={order.id}
                      className="rounded-lg border border-[#CBD2D6] bg-[#F5F7FA] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#003087]">#{order.id}</span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isPhone
                                  ? "bg-[#E6F4EA] text-[#019C34]"
                                  : "bg-[#E6F0FB] text-[#003087]"
                              }`}
                            >
                              {isPhone ? <Phone size={10} /> : <Truck size={10} />}
                              {order.method_display}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                STATUS_META[order.status]?.cls || ""
                              }`}
                            >
                              {STATUS_META[order.status]?.label || order.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#687173]">
                            {new Date(order.created_at).toLocaleDateString("fa-IR")}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-[#003087]">
                            {Number(order.total_amount).toLocaleString()}
                            <span className="mr-1 text-xs font-normal text-[#687173]">تومان</span>
                          </p>
                        </div>
                      </div>

                      {/* Phone order specific fields */}
                      {isPhone && (order.customer_phone || order.call_time_preference) && (
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#687173]">
                          {order.customer_phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={12} />
                              شماره تماس: <span dir="ltr">{order.customer_phone}</span>
                            </span>
                          )}
                          {order.call_time_preference && (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              ترجیح زمان: {order.call_time_preference}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Items toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#003087] hover:text-[#009CDE]"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {order.items?.length || 0} قلم کالا
                      </button>

                      {/* Items list */}
                      {isExpanded && order.items?.length > 0 && (
                        <div className="mt-2 divide-y divide-[#CBD2D6] rounded-lg border border-[#CBD2D6] bg-white">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-3 py-2 text-xs"
                            >
                              <span className="text-[#1A1A2E]">
                                {item.mattress_name}
                                {item.size_label ? ` (${item.size_label})` : ""}
                                <span className="text-[#687173]"> × {item.quantity}</span>
                              </span>
                              <span className="text-[#687173]">
                                {Number(item.line_total).toLocaleString()} تومان
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small presentational helpers ─────────────────────────────────────────── */

function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <Icon size={18} className="text-[#687173] flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-[#687173] mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

function ReadValue({ value }) {
  return (
    <p className="text-sm font-medium text-[#1A1A2E]">{value || "—"}</p>
  );
}

function TextInput({ value, onChange, type = "text", dir }) {
  return (
    <input
      type={type}
      dir={dir}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm rounded-lg border border-[#CBD2D6] px-3 py-1.5
                 focus:outline-none focus:border-2 focus:border-[#003087]"
    />
  );
}

function PasswordInput({ label, value, onChange, show }) {
  return (
    <div>
      <label className="block text-xs text-[#687173] mb-1">{label}</label>
      <input
        type={show ? "text" : "password"}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm rounded-lg border border-[#CBD2D6] px-3 py-2
                   focus:outline-none focus:border-2 focus:border-[#003087] text-right"
      />
    </div>
  );
}
