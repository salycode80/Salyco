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
        className="rounded-xl bg-brand-navy p-3 shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover"
      >
        <Home size={32} className="text-white" strokeWidth={1.5} />
      </Link>
      <div className="flex-1" dir="rtl">
        <h2 className="font-persian text-2xl font-bold text-text-primary">
          {product.name}
        </h2>
        <button
          type="button"
          onClick={copySerial}
          className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-full border border-brand-mist bg-brand-warm-white px-4 py-1.5 text-sm font-medium text-brand-navy transition hover:border-brand-navy hover:bg-white"
          dir="ltr"
        >
          <QrCode size={16} className="text-brand-navy" />
          <span>SN: {product.serial}</span>
          <Copy size={14} className="text-text-secondary hover:text-text-primary" />
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
