import { useState } from "react";
import { Ruler, Tag } from "lucide-react";
import { getProductImageUrl } from "../../utils/productImage";
import { toPersianNumber } from "../../utils/persian";

const FALLBACK_IMAGE = "/matress.png";

// Shown right after a QR scan so the customer can compare the photo against the
// product in front of them before claiming the warranty. A mismatch is cheapest
// to catch here — before a login, a form, and an admin review.
const ProductPreviewCard = ({ warrantyData }) => {
  // Track only the failure, not the resolved URL: keeping the URL in state
  // would freeze it at mount and ignore a later refetch.
  const [imageFailed, setImageFailed] = useState(false);
  const src = imageFailed
    ? FALLBACK_IMAGE
    : getProductImageUrl(warrantyData.mattress_image);

  const {
    mattress_width: width,
    mattress_length: length,
    mattress_height: height,
  } = warrantyData;
  // All three default to 0 on the model, so only show the line when it is real.
  const dimensions =
    width && length && height
      ? `${toPersianNumber(width)} × ${toPersianNumber(length)} × ${toPersianNumber(
          height,
        )} سانتی‌متر`
      : null;

  return (
    <div
      className="mb-6 flex flex-col gap-4 rounded-xl border border-[#CBD2D6] bg-white p-4 text-right sm:flex-row sm:items-center sm:p-5"
      dir="rtl"
    >
      <img
        src={src}
        onError={() => setImageFailed(true)}
        alt={warrantyData.mattress_name || "تصویر محصول"}
        className="h-32 w-32 shrink-0 self-center rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] object-cover sm:h-28 sm:w-28"
      />

      <div className="min-w-0 flex-1">
        <p className="font-persian text-xs text-[#687173]">
          محصول اسکن‌شده — مطابقت را بررسی کنید
        </p>
        <h3 className="mt-1 font-persian text-lg font-semibold text-[#1A1A2E]">
          {warrantyData.mattress_name || "—"}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-persian text-sm text-[#687173]">
          {warrantyData.mattress_brand && (
            <span className="inline-flex items-center gap-1.5">
              <Tag size={14} className="text-[#009CDE]" strokeWidth={2} />
              {warrantyData.mattress_brand}
            </span>
          )}
          {warrantyData.mattress_category_label && (
            <span>{warrantyData.mattress_category_label}</span>
          )}
        </div>

        {dimensions && (
          <p className="mt-2 inline-flex items-center gap-1.5 font-persian text-sm text-[#1A1A2E]">
            <Ruler size={14} className="text-[#009CDE]" strokeWidth={2} />
            {dimensions}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductPreviewCard;
