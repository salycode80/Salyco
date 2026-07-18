import { Clock } from "lucide-react";

const GuaranteeDisk = ({ product }) => {
  // remainingMonths is derived by rounding days, so it can slightly exceed the
  // total; clamp to 0–100 and guard against a zero/absent total warranty.
  const percentage = product.totalWarrantyMonths
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (product.remainingMonths / product.totalWarrantyMonths) * 100
          )
        )
      )
    : 0;
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
            stroke="#CBD2D6"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#003087"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-[#1A1A2E]">
          <span className="text-lg leading-none">{percentage}%</span>
          <span className="text-[10px] font-normal text-[#687173]">
            باقی‌مانده
          </span>
        </div>
      </div>
      <div dir="rtl">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A2E]">
          <Clock size={16} className="text-[#009CDE]" strokeWidth={2} />
          <span className="font-persian">زمان باقی‌مانده</span>
        </div>
        <span className="mt-2 inline-block rounded-full border border-[#CBD2D6] bg-[#F5F7FA] px-4 py-1 text-sm font-bold text-[#003087]">
          {product.remainingMonths} ماه
        </span>
      </div>
    </div>
  );
};

export default GuaranteeDisk;
