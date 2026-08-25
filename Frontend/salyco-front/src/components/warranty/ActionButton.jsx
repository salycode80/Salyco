import { CheckCircle2, PenLine, Clock, RotateCcw } from "lucide-react";

const ACTIONS = {
  APPROVED: {
    label: "مشاهده گارانتی",
    Icon: CheckCircle2,
    className: "bg-[#019C34] hover:brightness-95",
    disabled: false,
  },
  // Disabled on purpose: there is no customer action while an admin reviews.
  PENDING: {
    label: "در انتظار تأیید کارشناسان",
    Icon: Clock,
    className: "bg-[#009CDE]",
    disabled: true,
  },
  REJECTED: {
    label: "ثبت مجدد درخواست",
    Icon: RotateCcw,
    className: "bg-[#003087] hover:bg-[#00246B]",
    disabled: false,
  },
  UNREGISTERED: {
    label: "ثبت گارانتی",
    Icon: PenLine,
    className: "bg-[#003087] hover:bg-[#00246B]",
    disabled: false,
  },
};

const ActionButton = ({ status, onClick }) => {
  const action = ACTIONS[status] || ACTIONS.UNREGISTERED;
  const { Icon } = action;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={action.disabled}
      className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg px-6 text-lg font-medium text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${action.className}`}
    >
      <Icon size={20} strokeWidth={2} />
      <span className="font-persian text-base">{action.label}</span>
    </button>
  );
};

export default ActionButton;
