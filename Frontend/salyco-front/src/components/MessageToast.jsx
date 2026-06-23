const MessageToast = ({ type, text }) => {
  return (
    <div
      className={`mt-4 rounded-xl border px-5 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-300/60 bg-emerald-50 text-emerald-700"
          : "border-red-300/60 bg-red-50 text-red-700"
      }`}
      dir="rtl"
    >
      <span className="font-persian">{text}</span>
    </div>
  );
};

export default MessageToast;
