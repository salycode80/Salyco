import React from 'react';

const StatusBadge = ({ isRegistered }) => {
  return (
    <div className="ml-auto">
      <span
        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border ${
          isRegistered
            ? 'bg-[#DCF0E8] text-[#115D46] border-[#8BC4B0]'
            : 'bg-[#FFF0E0] text-[#A84E2A] border-[#F3C9AA]'
        }`}
      >
        <span
          className={`w-3 h-3 rounded-full ${
            isRegistered ? 'bg-[#1F6E5A]' : 'bg-[#B1562B]'
          }`}
        />
        {isRegistered ? 'فعال' : 'غیر فعال'}
      </span>
    </div>
  );
};

export default StatusBadge;