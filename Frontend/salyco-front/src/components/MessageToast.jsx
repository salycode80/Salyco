import React from 'react';

const MessageToast = ({ type, text }) => {
  return (
    <div
      className={`mt-4 px-5 py-3 rounded-xl text-sm font-medium border ${
        type === 'success'
          ? 'bg-[#DCF0E8] text-[#115D46] border-[#8BC4B0]'
          : 'bg-[#FFE5D9] text-[#983F1F] border-[#E8B49A]'
      }`}
    >
      {text}
    </div>
  );
};

export default MessageToast;