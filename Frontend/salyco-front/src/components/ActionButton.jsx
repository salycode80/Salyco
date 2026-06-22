import React from 'react';

const ActionButton = ({ isRegistered, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-3 text-white font-semibold text-lg py-3.5 px-6 rounded-full shadow-lg transition-all duration-200 border ${
        isRegistered
          ? 'bg-[#00994d] hover:bg-[#004d26] border-[#3A7B68]'
          : 'bg-[#000099] hover:bg-[#000080] border-[#3C7A94]'
      }`}
    >
      {isRegistered ? (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          مشاهده گارانتی
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <div className="text-sm font-medium">
          ثبت گارانتی
          </div>
          
        </>
      )}
    </button>
  );
};

export default ActionButton;