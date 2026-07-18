import { Home, QrCode, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const ProductHeader = ({ product, onCopy }) => {
  const copySerial = () => {
    navigator.clipboard?.writeText(product.serial).then(() => {
      onCopy();
    });
  };

  return (
    <div className="mb-6 flex items-center gap-4">
      <Link
        to="/"
        aria-label="بازگشت به صفحه اصلی"
        className="rounded-xl bg-[#003087] p-3 shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B]"
      >
        <Home size={32} className="text-white" strokeWidth={1.5} />
      </Link>
      <div className="flex-1" dir="rtl">
        <h2 className="font-sans text-2xl font-bold tracking-wide text-[#1A1A2E]">
          {product.name}
        </h2>
        <button
          type="button"
          onClick={copySerial}
          className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-full border border-[#CBD2D6] bg-[#F5F7FA] px-4 py-1.5 text-sm font-medium text-[#003087] transition hover:border-[#009CDE] hover:bg-white"
          dir="ltr"
        >
          <QrCode size={16} className="text-[#009CDE]" />
          <span>SN: {product.serial}</span>
          <Copy size={14} className="text-[#687173] hover:text-[#1A1A2E]" />
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
