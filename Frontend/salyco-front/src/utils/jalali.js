/**
 * The Jalali (Shamsi) calendar, in the browser.
 *
 * Ported from the backend's `mattress/utils.py:to_jalali` so the two agree day
 * for day — a date the SMS engine calls ۱۴۰۵/۰۵/۰۹ must not read as ۱۴۰۵/۰۵/۱۰
 * on the page that shows the same record. Hand-rolled rather than pulled from
 * jalaali-js/persiantools for the same reason it was hand-rolled there: this
 * needs a calendar, not a date library, and the algorithm is exact across
 * 1901–2099, which covers every date this system can hold.
 *
 * The conversion is day-number arithmetic. A Gregorian date becomes "days since
 * 1600-01-01", that count shifts by 79 days to land on the Jalali epoch
 * (1600-03-21 == 979-01-01), and the result walks the Jalali cycle: a 33-year
 * period of 12053 days, made of eight 1461-day four-year blocks plus one
 * trailing 365-day year. In each block the first year is the leap one, which is
 * why the month-12 length is decided by `(jy - 979) % 4`.
 */

import { toPersianNumber } from "./persian";

const GREGORIAN_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ⌊n / 12053⌋ and ⌊n / 1461⌋ in the source; spelled out here because the
// arithmetic below is easier to follow against the comments with them named.
const DAYS_PER_CYCLE = 12053; // 33 Jalali years
const DAYS_PER_BLOCK = 1461; // 4 Jalali years, the first of them leap

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// Saturday-first, matching `Intl` under fa-IR and the Iranian week.
export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const isGregorianLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The 0-based year within its 33-year cycle. */
const yearInCycle = (jy) => (((jy - 979) % 33) + 33) % 33;

/**
 * True when a Jalali year has 366 days.
 *
 * The first year of each four-year block is leap — except the cycle's 33rd
 * year, which is the stub left over after the eight complete blocks and is
 * always common.
 */
export function isJalaliLeapYear(jy) {
  const r = yearInCycle(jy);
  return r % 4 === 0 && r < 32;
}

/** 31 for the first six months, 30 for the next five, 29 or 30 for Esfand. */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** Days from 1600-01-01 to the given Gregorian date. */
function gregorianDayNumber(gy, gm, gd) {
  const gy2 = gy - 1600;
  let days =
    365 * gy2 +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400);
  for (let i = 0; i < gm - 1; i += 1) days += GREGORIAN_MONTH_LENGTHS[i];
  // March-onward dates in a Gregorian leap year fall after 29 February.
  if (gm > 2 && isGregorianLeap(gy)) days += 1;
  return days + gd - 1;
}

/** The inverse: a Gregorian date from days since 1600-01-01. */
function gregorianFromDayNumber(days) {
  let gy = 1600;
  let n = days;
  for (;;) {
    const length = isGregorianLeap(gy) ? 366 : 365;
    if (n < length) break;
    n -= length;
    gy += 1;
  }
  let gm = 1;
  for (let i = 0; i < 12; i += 1) {
    const length =
      i === 1 && isGregorianLeap(gy) ? 29 : GREGORIAN_MONTH_LENGTHS[i];
    if (n < length) {
      gm = i + 1;
      break;
    }
    n -= length;
  }
  return { gy, gm, gd: n + 1 };
}

/** Days from the Jalali epoch (979-01-01) to the start of a Jalali year. */
function jalaliYearStart(jy) {
  const n = jy - 979;
  const cycles = Math.floor(n / 33);
  const r = ((n % 33) + 33) % 33;
  const inCycle =
    Math.floor(r / 4) * DAYS_PER_BLOCK +
    (r % 4 === 0 ? 0 : 366 + (r % 4 - 1) * 365);
  return cycles * DAYS_PER_CYCLE + inCycle;
}

/** Days from the Jalali epoch to the given Jalali date. */
function jalaliDayNumber(jy, jm, jd) {
  let days = jalaliYearStart(jy);
  for (let m = 1; m < jm; m += 1) days += jalaliMonthLength(jy, m);
  return days + jd - 1;
}

/** A Jalali year/month/day triple. */
export function toJalali(value) {
  const date = toDate(value);
  if (!date) return null;

  const { gy, gm, gd } = {
    gy: date.getFullYear(),
    gm: date.getMonth() + 1,
    gd: date.getDate(),
  };

  // -79 shifts the Gregorian day count onto the Jalali epoch. The constant is
  // the backend's, carried over verbatim rather than re-derived: it is what
  // makes the two calendars agree, and re-deriving it is how they drift.
  let days = gregorianDayNumber(gy, gm, gd) - 79;

  const cycles = Math.floor(days / DAYS_PER_CYCLE);
  days %= DAYS_PER_CYCLE;

  let jy = 979 + 33 * cycles + 4 * Math.floor(days / DAYS_PER_BLOCK);
  days %= DAYS_PER_BLOCK;
  if (days >= 366) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  for (let m = 1; m <= 11; m += 1) {
    const length = m <= 6 ? 31 : 30;
    if (days < length) return { jy, jm: m, jd: days + 1 };
    days -= length;
  }
  return { jy, jm: 12, jd: days + 1 };
}

/** The Gregorian Date a Jalali year/month/day names, at local midnight. */
export function fromJalali(jy, jm, jd) {
  // The inverse of toJalali's `- 79`.
  const { gy, gm, gd } = gregorianFromDayNumber(jalaliDayNumber(jy, jm, jd) + 79);
  return new Date(gy, gm - 1, gd);
}

/**
 * Accepts a Date, an ISO string, or a "YYYY-MM-DD" string.
 *
 * A date-only string is parsed as *local* midnight, not UTC. `new Date("2026-07-31")`
 * is UTC midnight, which is 03:30 on the 31st in Tehran — but west of Greenwich
 * it is the 30th, and the Jalali day would come out one early. Splitting the
 * string avoids that entirely, and it is why the API's plain dates round-trip.
 */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * "۱۴۰۵/۰۵/۰۹" — the short form used in tables, cards and detail rows.
 * Empty input renders as "" rather than "Invalid Date", so a missing API field
 * leaves a blank cell instead of noise.
 */
export function formatJalali(value, { padded = true } = {}) {
  const j = toJalali(value);
  if (!j) return "";
  const mm = padded ? String(j.jm).padStart(2, "0") : String(j.jm);
  const dd = padded ? String(j.jd).padStart(2, "0") : String(j.jd);
  return toPersianNumber(`${j.jy}/${mm}/${dd}`);
}

/** "۹ مرداد ۱۴۰۵" — the long form, for headings and detail pages. */
export function formatJalaliLong(value) {
  const j = toJalali(value);
  if (!j) return "";
  return `${toPersianNumber(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toPersianNumber(j.jy)}`;
}

/** "۱۴۰۵/۰۵/۰۹ – ۱۴:۳۰" — a date and the local clock time beside it. */
export function formatJalaliDateTime(value) {
  const date = toDate(value);
  if (!date) return "";
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
  return `${formatJalali(date)} – ${toPersianNumber(time)}`;
}

/** The Gregorian "YYYY-MM-DD" an API field wants, from a Date. */
export function toApiDate(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today in the Jalali calendar — the picker's initial view. */
export function todayJalali() {
  return toJalali(new Date());
}
