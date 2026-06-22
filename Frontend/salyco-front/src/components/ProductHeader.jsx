import React from 'react';

const ProductHeader = ({ product, onCopy }) => {
  const copySerial = () => {
    navigator.clipboard?.writeText(product.serial).then(() => {
      onCopy();
    });
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="bg-[#0A2E3F] text-white p-3 rounded-2xl shadow-md">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-[#0A2E3F] tracking-tight">{product.name}</h1>
        <div
          className="flex items-center gap-2 text-sm bg-slate-100 px-4 py-1.5 rounded-full w-fit border border-slate-200 text-[#1A4A5E] font-medium cursor-pointer hover:bg-slate-200 transition"
          onClick={copySerial}
        >
          <svg className="w-4 h-4 text-[#2C6E8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <span>SN: {product.serial}</span>
          <svg className="w-3.5 h-3.5 ml-1 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ProductHeader;