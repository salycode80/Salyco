// Convert Latin digits in a value to Persian digits.
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianNumber(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

// Format a price with thousands separators, then convert to Persian digits.
export function formatPersianPrice(price) {
  return toPersianNumber(Number(price).toLocaleString());
}

// Convert Latin digits inside a display string that comes from the API.
//
// Product subtitles and descriptions are authored in the database and mix
// scripts, e.g. "تشک سالیکو مدل ایمپریال با 10 سال گارانتی". Design.md §3 wants
// displayed specs in Persian digits, so those strings go through here on the way
// to the screen. Only ever apply this to copy meant for reading — never to
// serial numbers, slugs, URLs or QR payloads, which must round-trip byte for
// byte (§3, §11).
export function toPersianDigitsInText(value) {
  return value == null ? "" : toPersianNumber(String(value));
}

// Normalise Persian/Arabic-Indic digits to Latin so typed input can be validated.
export function toLatinDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
