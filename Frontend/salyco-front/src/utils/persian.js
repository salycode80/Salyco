// Convert Latin digits in a value to Persian digits.
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianNumber(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

// Format a price with thousands separators, then convert to Persian digits.
export function formatPersianPrice(price) {
  return toPersianNumber(Number(price).toLocaleString());
}

// Normalise Persian/Arabic-Indic digits to Latin so typed input can be validated.
export function toLatinDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
