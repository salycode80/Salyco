import { CheckCircle2, Clock, XCircle, Circle, ShieldOff } from "lucide-react";

// Four states, not a boolean: a submitted request is waiting on an admin, and a
// rejected one has to say so or the customer sees no difference from never
// having applied. `expired` is a separate axis — an approved warranty whose
// period has run out — so callers that track it can pass it in.
const STATES = {
  APPROVED: {
    label: "فعال",
    fill: "bg-status-success-bg",
    text: "text-status-success",
    Icon: CheckCircle2,
  },
  PENDING: {
    label: "در انتظار تأیید",
    fill: "bg-status-info-bg",
    text: "text-brand-navy",
    Icon: Clock,
  },
  REJECTED: {
    label: "رد شده",
    fill: "bg-status-error-bg",
    text: "text-status-error",
    Icon: XCircle,
  },
  UNREGISTERED: {
    label: "غیرفعال",
    fill: "bg-status-warning-bg",
    text: "text-status-warning",
    Icon: Circle,
  },
  EXPIRED: {
    label: "منقضی",
    fill: "bg-brand-warm-white",
    text: "text-text-secondary",
    Icon: ShieldOff,
  },
};

const StatusBadge = ({ status, expired = false }) => {
  const key = status === "APPROVED" && expired ? "EXPIRED" : status;
  const state = STATES[key] || STATES.UNREGISTERED;
  const { Icon } = state;

  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold ${state.fill} ${state.text}`}
    >
      <Icon size={14} strokeWidth={2} />
      <span className="font-persian">{state.label}</span>
    </span>
  );
};

export default StatusBadge;
