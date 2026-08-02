"""Throwaway check of the Jalali converter against known date pairs."""
from datetime import date

from mattress.utils import format_jalali

# Gregorian -> expected Shamsi. Includes the date from the SMS the user quoted,
# Nowruz boundaries, and leap-year edges in both calendars.
CASES = [
    (date(2026, 7, 31), "1405/05/09"),   # the reported SMS
    (date(2026, 3, 20), "1404/12/29"),   # last day of 1404
    (date(2026, 3, 21), "1405/01/01"),   # Nowruz 1405
    (date(2024, 3, 20), "1403/01/01"),   # Nowruz 1403
    (date(2024, 2, 29), "1402/12/10"),   # Gregorian leap day
    (date(2025, 3, 20), "1403/12/30"),   # 1403 is a Jalali leap year
    (date(2025, 3, 21), "1404/01/01"),
    (date(2000, 1, 1), "1378/10/11"),
    (date(2021, 9, 23), "1400/07/01"),
    (date(2026, 12, 31), "1405/10/10"),
]

fails = 0
for g, expected in CASES:
    got = format_jalali(g)
    ok = got == expected
    fails += not ok
    print(f"{'ok  ' if ok else 'FAIL'} {g} -> {got}" + ("" if ok else f" (expected {expected})"))

print()
print("empty date   :", repr(format_jalali(None)))
print("result       :", "all passed" if not fails else f"{fails} FAILED")
