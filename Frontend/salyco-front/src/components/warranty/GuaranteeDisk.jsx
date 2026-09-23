import { Clock } from "lucide-react";
import { toPersianNumber } from "../../utils/persian";

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
  // The dashboard around this is Persian, so the accessible name is too — a
  // screen reader on an RTL page should not drop into English mid-widget.
  const ariaLabel = `باقی‌ماندهٔ گارانتی ${toPersianNumber(
    percentage
  )} درصد؛ ${toPersianNumber(product.remainingMonths)} ماه`;

  return (
    <div className="flex items-center gap-4" role="img" aria-label={ariaLabel}>
      <div className="relative h-20 w-20">
        <svg className="-rotate-90 h-20 w-20" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--color-brand-mist)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--color-brand-navy)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-text-primary">
          <span className="text-lg leading-none">
            {toPersianNumber(percentage)}٪
          </span>
          <span className="text-[10px] font-normal text-text-secondary">
            باقی‌مانده
          </span>
        </div>
      </div>
      <div dir="rtl">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Clock size={16} className="text-brand-navy" strokeWidth={2} />
          <span className="font-persian">زمان باقی‌مانده</span>
        </div>
        <span className="mt-2 inline-block rounded-full border border-brand-mist bg-brand-warm-white px-4 py-1 text-sm font-bold text-brand-navy">
          {toPersianNumber(product.remainingMonths)} ماه
        </span>
      </div>
    </div>
  );
};

export default GuaranteeDisk;
