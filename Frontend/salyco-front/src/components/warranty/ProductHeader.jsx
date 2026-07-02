import { Home, QrCode, Copy } from "lucide-react";

const ProductHeader = ({ product, onCopy }) => {
  const copySerial = () => {
    navigator.clipboard?.writeText(product.serial).then(() => {
      onCopy();
    });
  };

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b] p-3 shadow-md">
        <Home size={32} className="text-blue-200" strokeWidth={1.5} />
      </div>
      <div className="flex-1" dir="rtl">
        <h2 className="font-sans text-2xl font-bold tracking-wide text-[#000c3e]">
          {product.name}
        </h2>
        <button
          type="button"
          onClick={copySerial}
          className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-full border border-blue-400/20 bg-[#F5F7FA] px-4 py-1.5 text-sm font-medium text-[#001a5c] transition hover:border-blue-400/40 hover:bg-blue-50/50"
          dir="ltr"
        >
          <QrCode size={16} className="text-blue-400" />
          <span>SN: {product.serial}</span>
          <Copy size={14} className="text-[#000c3e]/40 hover:text-[#000c3e]/70" />
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
