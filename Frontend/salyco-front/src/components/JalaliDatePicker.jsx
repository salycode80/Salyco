import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  formatJalali,
  fromJalali,
  jalaliMonthLength,
  toApiDate,
  toDate,
  toJalali,
  todayJalali,
} from "../utils/jalali";
import { toPersianNumber } from "../utils/persian";

/**
 * A minimal Jalali date picker.
 *
 * `value` and `onChange` speak the same language the API does — a Gregorian
 * "YYYY-MM-DD" string — so swapping this in for an `<input type="date">` is a
 * contained change: nothing downstream has to know what a Jalali date is. Only
 * the face of the control is Persian.
 *
 * It is deliberately small. There is no time-of-day wheel, no range mode and no
 * year dropdown; a month grid, a clear action and "today" cover every date this
 * system captures (coupon windows, manufacture dates, purchase dates). Anything
 * more would be a calendar application, and this is a form field.
 *
 * The popover is anchored rather than portalled, matching ProductsMenu: it
 * closes on an outside click and on Escape, and the trigger reports its own
 * expanded state.
 */

const DAY_CELL =
  "flex h-9 w-9 items-center justify-center rounded-lg font-persian text-sm " +
  "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-brand-navy";

const NAV_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary " +
  "transition-colors hover:bg-brand-warm-white hover:text-brand-navy " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

const INPUT =
  "h-12 w-full rounded-lg border border-brand-mist bg-white ps-4 pe-12 font-persian " +
  "text-sm text-text-primary outline-none transition " +
  "focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 " +
  "disabled:cursor-not-allowed disabled:bg-brand-warm-white disabled:opacity-70";

export default function JalaliDatePicker({
  id,
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  disabled = false,
  clearable = true,
  className = "",
  invalid = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = toJalali(value);
  const today = todayJalali();

  // The month the grid is showing, which is independent of the value: paging
  // through months must not commit anything, and reopening should land on the
  // selection when there is one and on today when there is not.
  const [view, setView] = useState(() => {
    const anchor = selected || today;
    return { jy: anchor.jy, jm: anchor.jm };
  });

  // Re-anchor whenever the field opens, so a value set elsewhere in the form is
  // what the grid shows.
  useEffect(() => {
    if (!open) return;
    const anchor = toJalali(value) || todayJalali();
    setView({ jy: anchor.jy, jm: anchor.jm });
    // Deliberately keyed on `open` alone: re-running on `value` would fight the
    // user's own paging while the popover is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const { jy, jm } = view;
    const length = jalaliMonthLength(jy, jm);
    // Saturday-first. JS counts from Sunday, so Saturday is index 6 -> 0.
    const lead = (fromJalali(jy, jm, 1).getDay() + 1) % 7;
    const cells = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= length; d += 1) cells.push(d);
    return cells;
  }, [view]);

  const shift = (months) => {
    setView(({ jy, jm }) => {
      const total = jy * 12 + (jm - 1) + months;
      return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
    });
  };

  const commit = (jy, jm, jd) => {
    onChange?.(toApiDate(fromJalali(jy, jm, jd)));
    setOpen(false);
  };

  const isSelected = (d) =>
    !!selected &&
    selected.jy === view.jy &&
    selected.jm === view.jm &&
    selected.jd === d;

  const isToday = (d) =>
    today.jy === view.jy && today.jm === view.jm && today.jd === d;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        readOnly
        disabled={disabled}
        value={formatJalali(value)}
        placeholder={placeholder}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) setOpen((o) => !o);
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${INPUT} cursor-pointer ${
          invalid ? "border-status-error bg-status-error-bg" : ""
        }`}
      />

      <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center gap-1 pe-3">
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label="پاک کردن تاریخ"
            onClick={() => onChange?.("")}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-brand-warm-white hover:text-status-error"
          >
            <X size={14} />
          </button>
        )}
        <Calendar size={17} className="text-text-secondary" aria-hidden="true" />
      </span>

      {open && (
        <div
          role="dialog"
          aria-label="انتخاب تاریخ"
          className="absolute z-30 mt-1 w-[19rem] rounded-xl border border-brand-mist bg-white p-3 shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
        >
          <div className="flex items-center justify-between gap-1">
            {/* Under rtl the left chevron points forward, so it advances. */}
            <button
              type="button"
              className={NAV_BUTTON}
              onClick={() => shift(1)}
              aria-label="ماه بعد"
            >
              <ChevronLeft size={18} />
            </button>

            <p className="font-persian text-sm font-semibold text-brand-navy">
              {JALALI_MONTHS[view.jm - 1]} {toPersianNumber(view.jy)}
            </p>

            <button
              type="button"
              className={NAV_BUTTON}
              onClick={() => shift(-1)}
              aria-label="ماه قبل"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {JALALI_WEEKDAYS.map((d) => (
              <span
                key={d}
                className="flex h-8 items-center justify-center font-persian text-xs text-text-secondary"
              >
                {d}
              </span>
            ))}

            {days.map((d, i) =>
              d === null ? (
                <span key={`blank-${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => commit(view.jy, view.jm, d)}
                  aria-current={isSelected(d) ? "date" : undefined}
                  className={`${DAY_CELL} ${
                    isSelected(d)
                      ? "bg-brand-navy font-bold text-white"
                      : isToday(d)
                        ? "bg-brand-navy/[0.07] font-semibold text-brand-navy"
                        : "text-text-primary hover:bg-brand-warm-white"
                  }`}
                >
                  {toPersianNumber(d)}
                </button>
              ),
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-brand-mist pt-2">
            <button
              type="button"
              onClick={() => commit(today.jy, today.jm, today.jd)}
              className="rounded-lg px-3 py-1.5 font-persian text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-warm-white"
            >
              امروز
            </button>
            {selected && (
              <span className="font-persian text-xs text-text-secondary">
                {formatJalali(toDate(value))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
