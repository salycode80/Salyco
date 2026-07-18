const StatusBadge = ({ isRegistered }) => {
  return (
    <div className="ml-auto">
      <span
        className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold ${
          isRegistered
            ? "bg-[#E6F4EA] text-[#019C34]"
            : "bg-[#FFF8E1] text-[#F5BA2E]"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full ${
            isRegistered ? "bg-[#019C34]" : "bg-[#F5BA2E]"
          }`}
        />
        <span className="font-persian">
          {isRegistered ? "فعال" : "غیرفعال"}
        </span>
      </span>
    </div>
  );
};

export default StatusBadge;
