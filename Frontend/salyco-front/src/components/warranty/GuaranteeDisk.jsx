import { Clock } from "lucide-react";

const GuaranteeDisk = ({ product }) => {
  const percentage = Math.round(
    (product.remainingMonths / product.totalWarrantyMonths) * 100
  );
  const circumference = 276.46;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20">
        <svg className="-rotate-90 h-20 w-20" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#001a5c"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-[#000c3e]">
          <span className="text-lg leading-none">{percentage}%</span>
          <span className="text-[10px] font-normal text-[#000c3e]/60">
            باقی‌مانده
          </span>
        </div>
      </div>
      <div dir="rtl">
        <div className="flex items-center gap-2 text-sm font-medium text-[#000c3e]">
          <Clock size={16} className="text-blue-400" strokeWidth={2} />
          <span className="font-persian">زمان باقی‌مانده</span>
        </div>
        <span className="mt-2 inline-block rounded-full border border-blue-400/20 bg-blue-50/50 px-4 py-1 text-sm font-bold text-[#001a5c]">
          {product.remainingMonths} ماه
        </span>
      </div>
    </div>
  );
};

export default GuaranteeDisk;
