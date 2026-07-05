import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../hooks/UseAuth";
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Edit3,
  Save,
  X,
} from "lucide-react";

export default function UserInfo() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: "", phone_number: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    api
      .get("/api/user/me/")
      .then((res) => {
        setUser(res.data);
        setForm({
          email: res.data.email || "",
          phone_number: res.data.phone_number || "",
        });
      })
      .catch(() => setError("خطا در دریافت اطلاعات کاربر"))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  const getUserInitials = (username) => {
    if (!username) return "?";
    return username.charAt(0).toUpperCase();
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.patch("/api/user/me/", form);
      setUser(res.data);
      setEditing(false);
    } catch {
      setError("ذخیره اطلاعات با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-blue-600 text-sm">
          در حال بارگذاری...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-16 px-4" dir="rtl">
      <div className="mx-auto max-w-2xl">
        {/* Header card */}
        <div className="rounded-2xl overflow-hidden shadow-lg mb-6">
          <div className="bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-8 flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-400/40 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-bold text-blue-100">
                {getUserInitials(user?.username)}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {user?.username}
              </h1>
              {user?.is_staff && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-200 bg-white/10 rounded-full px-2.5 py-1">
                  <ShieldCheck size={12} />
                  مدیر سیستم
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100">
            <h2 className="text-base font-bold text-[#000c3e]">اطلاعات حساب</h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8] transition-colors"
              >
                <Edit3 size={15} />
                ویرایش
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditing(false);
                  setForm({
                    email: user.email || "",
                    phone_number: user.phone_number || "",
                  });
                }}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={15} />
                انصراف
              </button>
            )}
          </div>

          <div className="divide-y divide-blue-50">
            {/* Username - read only */}
            <div className="flex items-center gap-3 px-6 py-4">
              <User size={18} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-0.5">نام کاربری</p>
                <p className="text-sm font-medium text-[#000c3e]">
                  {user?.username}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 px-6 py-4">
              <Mail size={18} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-0.5">ایمیل</p>
                {editing ? (
                  <input
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-blue-200 px-3 py-1.5
                               focus:outline-none focus:border-blue-400"
                  />
                ) : (
                  <p className="text-sm font-medium text-[#000c3e]">
                    {user?.email || "—"}
                  </p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 px-6 py-4">
              <Phone size={18} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-0.5">شماره تماس</p>
                {editing ? (
                  <input
                    type="tel"
                    dir="ltr"
                    value={form.phone_number}
                    onChange={(e) =>
                      setForm({ ...form, phone_number: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-blue-200 px-3 py-1.5
                               focus:outline-none focus:border-blue-400"
                  />
                ) : (
                  <p className="text-sm font-medium text-[#000c3e]">
                    {user?.phone_number || "—"}
                  </p>
                )}
              </div>
            </div>

            {/* Join date */}
            {user?.date_joined && (
              <div className="flex items-center gap-3 px-6 py-4">
                <Calendar size={18} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">تاریخ عضویت</p>
                  <p className="text-sm font-medium text-[#000c3e]">
                    {new Date(user.date_joined).toLocaleDateString("fa-IR")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {editing && (
            <div className="px-6 py-4 bg-blue-50/50 flex items-center justify-between">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm font-medium text-white
                           bg-[#001a5c] hover:bg-[#00256b] disabled:opacity-60
                           rounded-lg px-4 py-2 transition-colors mr-auto"
              >
                <Save size={15} />
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </div>
          )}
        </div>

        {error && !editing && (
          <p className="text-sm text-red-500 mt-3 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
