import { CheckCircle2, PenLine } from "lucide-react";

const ActionButton = ({ isRegistered, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-3 rounded-full border py-3.5 px-6 text-lg font-semibold text-white shadow-lg transition-all duration-200 ${
        isRegistered
          ? "border-emerald-600/30 bg-emerald-600 hover:bg-emerald-700"
          : "border-blue-400/20 bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] hover:brightness-110"
      }`}
    >
      {isRegistered ? (
        <>
          <CheckCircle2 size={20} strokeWidth={2} />
          <span className="font-persian text-base">مشاهده گارانتی</span>
        </>
      ) : (
        <>
          <PenLine size={20} strokeWidth={2} />
          <span className="font-persian text-base">ثبت گارانتی</span>
        </>
      )}
    </button>
  );
};

export default ActionButton;
