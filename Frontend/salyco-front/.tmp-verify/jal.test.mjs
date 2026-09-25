import { toJalali, formatJalali, fromJalali, jalaliMonthLength, isJalaliLeapYear, formatJalaliDateTime } from "../src/utils/jalali.js";

// The exact pairs the backend's _check_jalali.py asserts, plus its extras.
const CASES = [
  ["2026-07-31", "1405/05/09"],
  ["2026-03-20", "1404/12/29"],
  ["2026-03-21", "1405/01/01"],
  ["2024-03-20", "1403/01/01"],
  ["2024-02-29", "1402/12/10"],
  ["2025-03-20", "1403/12/30"],
  ["2025-03-21", "1404/01/01"],
  ["2000-01-01", "1378/10/11"],
  ["2021-09-23", "1400/07/01"],
  ["2026-12-31", "1405/10/10"],
];
const fa = (s) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
let fails = 0;
for (const [g, want] of CASES) {
  const got = formatJalali(g);
  const ok = got === fa(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${g} -> ${got}${ok ? "" : ` (want ${fa(want)})`}`);
}

// Round-trip: every day of 1399..1410 must survive Jalali -> Gregorian -> Jalali.
let rt = 0;
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
console.log(`\nround-trip mismatches: ${rt}`);
console.log("1403 leap:", isJalaliLeapYear(1403), "| 1404 leap:", isJalaliLeapYear(1404), "| 1402 leap:", isJalaliLeapYear(1402));
console.log("esfand 1403:", jalaliMonthLength(1403, 12), "| esfand 1404:", jalaliMonthLength(1404, 12));
console.log("date-time:", formatJalaliDateTime(new Date(2026, 6, 31, 9, 5)));
console.log("empty:", JSON.stringify(formatJalali(null)), JSON.stringify(formatJalali(undefined)), JSON.stringify(formatJalali("")));
console.log(fails ? `${fails} FAILED` : "all backend pairs pass");
