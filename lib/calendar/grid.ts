// lib/calendar/grid.ts — month grids, period ranges and input parsing.
import {
  adToBs,
  bsToAd,
  bsDaysInMonth,
  isValidBsDate,
  adIsoAddDays,
  adIsoWeekday,
  todayInDeptTz,
} from "./convert";
import { toAdDigits } from "./format";
import { CalendarError } from "./types";
import type { BsDate, CalendarLocale, CalendarSystem, ISODate } from "./types";

/** One cell in a month grid (used by the datepicker, roster header, calendar view). */
export interface GridCell {
  iso: ISODate; // canonical Gregorian wire value
  label: string; // day number in the ACTIVE system (Nepali digits when locale=ne)
  otherNumber?: number; // the other system's day number (for the dual line "26 / Oct 13")
  inMonth: boolean; // belongs to the displayed month?
  isToday: boolean;
}

export interface MonthGrid {
  system: CalendarSystem;
  year: number; // in the active system
  month: number; // 1-12 in the active system
  weeks: GridCell[][]; // weeks of 7 cells, Sunday-start unless overridden
  monthStartIso: ISODate; // first day of the month (always exists, in-month)
  monthDays: number; // days in the active-system month (28-31 AD, 29-32 BS)
}

/**
 * Weeks of cells for a month in either system, starting on `weekStart`
 * (0 = Sunday — the department default for Nepal).
 */
export function getMonthGrid(
  system: CalendarSystem,
  year: number,
  month: number,
  locale: CalendarLocale = "en",
  weekStart: 0 | 1 = 0, // 0=Sun (department default), 1=Mon
  todayIso?: ISODate // injectable for tests; defaults to department-tz today
): MonthGrid {
  // First day of the month as ISO, for both systems.
  const firstIso =
    system === "BS"
      ? bsToAd({ year, month, day: 1 })
      : isoFromParts(year, month, 1);

  const daysInMonth =
    system === "BS" ? bsDaysInMonth(year, month) : adDaysInMonth(year, month);

  const today = todayIso ?? todayInDeptTz();
  const cells: GridCell[] = [];
  for (let i = 0; i < daysInMonth; i++) {
    const iso = adIsoAddDays(firstIso, i);
    cells.push({
      iso,
      ...labelsFor(system, locale, i + 1, iso),
      inMonth: true,
      isToday: iso === today,
    });
  }

  // Pad the front so day 1 lands on its real weekday, then back to complete the last week.
  const startPad = (adIsoWeekday(firstIso) - weekStart + 7) % 7;
  for (let i = startPad; i > 0; i--) {
    const iso = adIsoAddDays(firstIso, -i);
    cells.unshift({ iso, ...labelsFor(system, locale, null, iso), inMonth: false, isToday: iso === today });
  }
  const endPad = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= endPad; i++) {
    const iso = adIsoAddDays(firstIso, daysInMonth - 1 + i);
    cells.push({ iso, ...labelsFor(system, locale, null, iso), inMonth: false, isToday: iso === today });
  }

  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    system,
    year,
    month,
    weeks,
    monthStartIso: firstIso,
    monthDays: daysInMonth,
  };
}

/** Day-number labels: active-system label + the other system's day number. */
function labelsFor(
  system: CalendarSystem,
  locale: CalendarLocale,
  day: number | null,
  iso: ISODate
): Pick<GridCell, "label" | "otherNumber"> {
  const digits = (n: number) => (locale === "ne" ? nepaliDigits(String(n)) : String(n));
  if (day != null) {
    // In-month cell: show the active system's day number, plus the other system's.
    const other =
      system === "BS"
        ? adDayOfMonth(iso) // active BS -> other is AD day
        : adToBsCached(iso).day; // active AD -> other is BS day
    return { label: digits(day), otherNumber: other };
  }
  // Out-of-month pad cells: label with the AD day (avoids extra BS math).
  return { label: digits(adDayOfMonth(iso)), otherNumber: undefined };
}

// Small per-call memo: adToBs is O(1) and cheap, but grids call it per cell.
const adToBsCache = new Map<ISODate, BsDate>();
function adToBsCached(iso: ISODate): BsDate {
  const hit = adToBsCache.get(iso);
  if (hit) return hit;
  const v = adToBs(iso);
  if (adToBsCache.size > 4096) adToBsCache.clear();
  adToBsCache.set(iso, v);
  return v;
}

function nepaliDigits(s: string): string {
  const DEV = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return s.replace(/\d/g, (d) => DEV[Number(d)]);
}

export function adDayOfMonth(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

export function isoFromParts(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function adDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new CalendarError("INVALID_INPUT", `AD month ${month} invalid.`);
  const probe = new Date(Date.UTC(year, month, 0));
  if (Number.isNaN(probe.getTime())) throw new CalendarError("OUT_OF_RANGE", `AD ${year}-${month} out of range.`);
  return probe.getUTCDate();
}

export interface PeriodRange {
  from: ISODate; // inclusive Gregorian start
  to: ISODate; // inclusive Gregorian end
}

/**
 * Gregorian [from, to] (both inclusive) for a month in EITHER system.
 * A BS month spans two AD months by design — expected, not a bug.
 */
export function rangeForPeriod(system: CalendarSystem, year: number, month: number): PeriodRange {
  if (system === "BS") {
    return {
      from: bsToAd({ year, month, day: 1 }),
      to: adIsoAddDays(bsToAd({ year, month, day: bsDaysInMonth(year, month) }), 0),
    };
  }
  return {
    from: isoFromParts(year, month, 1),
    to: isoFromParts(year, month, adDaysInMonth(year, month)),
  };
}

/**
 * Parse typed input in the active system to canonical Gregorian ISO.
 * Accepts Devanagari digits ("२०८३-०६-२७") for BS.
 * The value stored/sent is ALWAYS the Gregorian ISO string.
 */
export function parseDateInput(raw: string, system: CalendarSystem): ISODate {
  const cleaned = toAdDigits(raw.trim()).replace(/[/.\s]/g, "-");
  if (system === "BS") {
    const bs = isValidBsDate(cleaned);
    if (!bs) {
      throw new CalendarError(
        "INVALID_BS_DATE",
        `"${raw}" is not a valid Bikram Sambat date (YYYY-MM-DD, BS 1978–2099).`
      );
    }
    return bsToAd(bs);
  }
  const m = /^(\d{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/.exec(cleaned);
  if (!m) {
    throw new CalendarError("INVALID_INPUT", `"${raw}" is not a valid date (YYYY-MM-DD).`);
  }
  const iso = isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (probe.getUTCDate() !== Number(m[3]) || probe.getUTCMonth() !== Number(m[2]) - 1) {
    throw new CalendarError("INVALID_INPUT", `"${raw}" is not a real calendar date.`);
  }
  return iso;
}
