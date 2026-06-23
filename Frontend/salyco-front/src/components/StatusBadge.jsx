const StatusBadge = ({ isRegistered }) => {
  return (
    <div className="ml-auto">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
          isRegistered
            ? "border-emerald-300/60 bg-emerald-50 text-emerald-700"
            : "border-amber-300/60 bg-amber-50 text-amber-700"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full ${
            isRegistered ? "bg-emerald-500" : "bg-amber-500"
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
