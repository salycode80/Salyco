const MessageToast = ({ type, text }) => {
  return (
    <div
      className={`mt-4 rounded-lg border border-brand-mist px-5 py-3 text-sm font-medium ${
        type === "success"
          ? "bg-status-success-bg text-status-success"
          : "bg-status-error-bg text-status-error"
      }`}
      dir="rtl"
    >
      <span className="font-persian">{text}</span>
    </div>
  );
};

export default MessageToast;
