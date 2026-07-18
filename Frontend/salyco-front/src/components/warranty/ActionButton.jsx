import { CheckCircle2, PenLine } from "lucide-react";

const ActionButton = ({ isRegistered, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg px-6 text-lg font-medium text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-200 ${
        isRegistered
          ? "bg-[#019C34] hover:brightness-95"
          : "bg-[#003087] hover:bg-[#00246B]"
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
