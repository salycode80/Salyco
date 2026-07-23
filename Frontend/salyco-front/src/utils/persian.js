// Convert Latin digits in a value to Persian digits.
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianNumber(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

// Format a price with thousands separators, then convert to Persian digits.
export function formatPersianPrice(price) {
  return toPersianNumber(Number(price).toLocaleString());
}
