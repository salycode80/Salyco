// src/utils/persian.js
var PERSIAN_DIGITS = ["\u06F0", "\u06F1", "\u06F2", "\u06F3", "\u06F4", "\u06F5", "\u06F6", "\u06F7", "\u06F8", "\u06F9"];
function toPersianNumber(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

// src/utils/jalali.js
var GREGORIAN_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var DAYS_PER_CYCLE = 12053;
var DAYS_PER_BLOCK = 1461;
var isGregorianLeap = (y) => y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
var yearInCycle = (jy) => ((jy - 979) % 33 + 33) % 33;
function isJalaliLeapYear(jy) {
  const r = yearInCycle(jy);
  return r % 4 === 0 && r < 32;
}
function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}
function gregorianDayNumber(gy, gm, gd) {
  const gy2 = gy - 1600;
  let days = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);
  for (let i = 0; i < gm - 1; i += 1) days += GREGORIAN_MONTH_LENGTHS[i];
  if (gm > 2 && isGregorianLeap(gy)) days += 1;
  return days + gd - 1;
}
function gregorianFromDayNumber(days) {
  let gy = 1600;
  let n = days;
  for (; ; ) {
    const length = isGregorianLeap(gy) ? 366 : 365;
    if (n < length) break;
    n -= length;
    gy += 1;
  }
  let gm = 1;
  for (let i = 0; i < 12; i += 1) {
    const length = i === 1 && isGregorianLeap(gy) ? 29 : GREGORIAN_MONTH_LENGTHS[i];
    if (n < length) {
      gm = i + 1;
      break;
    }
    n -= length;
  }
  return { gy, gm, gd: n + 1 };
}
function jalaliYearStart(jy) {
  const n = jy - 979;
  const cycles = Math.floor(n / 33);
  const r = (n % 33 + 33) % 33;
  const inCycle = Math.floor(r / 4) * DAYS_PER_BLOCK + (r % 4 === 0 ? 0 : 366 + (r % 4 - 1) * 365);
  return cycles * DAYS_PER_CYCLE + inCycle;
}
function jalaliDayNumber(jy, jm, jd) {
  let days = jalaliYearStart(jy);
  for (let m = 1; m < jm; m += 1) days += jalaliMonthLength(jy, m);
  return days + jd - 1;
}
function toJalali(value) {
  const date = toDate(value);
  if (!date) return null;
  const { gy, gm, gd } = {
    gy: date.getFullYear(),
    gm: date.getMonth() + 1,
    gd: date.getDate()
  };
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
function fromJalali(jy, jm, jd) {
  const { gy, gm, gd } = gregorianFromDayNumber(jalaliDayNumber(jy, jm, jd) + 79);
  return new Date(gy, gm - 1, gd);
}
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatJalali(value, { padded = true } = {}) {
  const j = toJalali(value);
  if (!j) return "";
  const mm = padded ? String(j.jm).padStart(2, "0") : String(j.jm);
  const dd = padded ? String(j.jd).padStart(2, "0") : String(j.jd);
  return toPersianNumber(`${j.jy}/${mm}/${dd}`);
}
function formatJalaliDateTime(value) {
  const date = toDate(value);
  if (!date) return "";
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
  return `${formatJalali(date)} \u2013 ${toPersianNumber(time)}`;
}

// .tmp-verify/jal.test.mjs
var CASES = [
  ["2026-07-31", "1405/05/09"],
  ["2026-03-20", "1404/12/29"],
  ["2026-03-21", "1405/01/01"],
  ["2024-03-20", "1403/01/01"],
  ["2024-02-29", "1402/12/10"],
  ["2025-03-20", "1403/12/30"],
  ["2025-03-21", "1404/01/01"],
  ["2000-01-01", "1378/10/11"],
  ["2021-09-23", "1400/07/01"],
  ["2026-12-31", "1405/10/10"]
];
var fa = (s) => s.replace(/\d/g, (d) => "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"[d]);
var fails = 0;
for (const [g, want] of CASES) {
  const got = formatJalali(g);
  const ok = got === fa(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${g} -> ${got}${ok ? "" : ` (want ${fa(want)})`}`);
}
var rt = 0;
for (let jy = 1399; jy <= 1410; jy++) {
  for (let jm = 1; jm <= 12; jm++) {
    const len = jalaliMonthLength(jy, jm);
    for (let jd = 1; jd <= len; jd++) {
      const back = toJalali(fromJalali(jy, jm, jd));
      if (back.jy !== jy || back.jm !== jm || back.jd !== jd) {
        if (rt++ < 5) console.log(`RT FAIL ${jy}/${jm}/${jd} -> ${JSON.stringify(back)}`);
      }
    }
  }
}
console.log(`
round-trip mismatches: ${rt}`);
console.log("1403 leap:", isJalaliLeapYear(1403), "| 1404 leap:", isJalaliLeapYear(1404), "| 1402 leap:", isJalaliLeapYear(1402));
console.log("esfand 1403:", jalaliMonthLength(1403, 12), "| esfand 1404:", jalaliMonthLength(1404, 12));
console.log("date-time:", formatJalaliDateTime(new Date(2026, 6, 31, 9, 5)));
console.log("empty:", JSON.stringify(formatJalali(null)), JSON.stringify(formatJalali(void 0)), JSON.stringify(formatJalali("")));
console.log(fails ? `${fails} FAILED` : "all backend pairs pass");
