const MessageToast = ({ type, text }) => {
  return (
    <div
      className={`mt-4 rounded-lg border border-[#CBD2D6] px-5 py-3 text-sm font-medium ${
        type === "success"
          ? "bg-[#E6F4EA] text-[#019C34]"
          : "bg-[#FDE7E7] text-[#D20000]"
      }`}
      dir="rtl"
    >
      <span className="font-persian">{text}</span>
    </div>
  );
};

export default MessageToast;
