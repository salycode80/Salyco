import React from 'react';

const GuaranteeDisk = ({ product }) => {
  const percentage = Math.round((product.remainingMonths / product.totalWarrantyMonths) * 100);
  const circumference = 276.46;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#1F6E5A"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-[#0A2E3F]">
          <span className="text-lg leading-none">{percentage}%</span>
          <span className="text-[10px] font-normal text-[#2C5A70]"> باقی مانده</span>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-[#1A4A5E]">
          <svg className="w-4 h-4 text-[#1F6E5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>زمان باقی مانده</span>
        </div>
        <span className="bg-[#E6F0F5] text-[#0F4157] px-4 py-1 rounded-full text-sm font-bold border border-[#BCD3E2] mt-2 inline-block">
            {product.remainingMonths} months
        </span>
      </div>
    </div>
  );
};

export default GuaranteeDisk;