// ---------------------------------------------------------------------------
// lib/calendar/convert.ts — the only conversion boundary. No other module,
// page or component may convert dates itself.
//
// ENGINE: @sbmdkl/nepali-date-converter@2.0.5 (MIT), pinned exact in package.json.
//   Range: BS 1978–2099 / AD 1921–2040. Outside that a typed error is thrown —
//   a wrong date is never returned.
//   Its arithmetic is UTC-safe (both 'YYYY-MM-DD' anchors parse as UTC).
// The rest of the app depends only on THIS module's exports, so the engine can
// be swapped without touching callers or the DB.
// ---------------------------------------------------------------------------
import { adToBs as libAdToBs, bsToAd as libBsToAd } from "@sbmdkl/nepali-date-converter";
import { DateTime } from "luxon";
import { CalendarError, DEPARTMENT_TIMEZONE } from "./types";
import type { BsDate, ISODate } from "./types";

const ISO_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Minimal AD validity: real calendar date (rejects 2026-02-30 etc.). */
export function isValidAdDate(iso: string): boolean {
  if (!ISO_RE.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** AD 'YYYY-MM-DD' -> BsDate. Throws CalendarError('OUT_OF_RANGE') outside the engine's table. */
export function adToBs(iso: ISODate): BsDate {
  if (!isValidAdDate(iso)) {
    throw new CalendarError("INVALID_INPUT", `Not a valid Gregorian date: "${iso}" (expected YYYY-MM-DD).`);
  }
  try {
    const [year, month, day] = String(libAdToBs(iso)).split("-").map(Number);
    if (!year || !month || !day) throw new Error("unparseable");
    return { year, month, day };
  } catch {
    throw new CalendarError(
      "OUT_OF_RANGE",
      `Date ${iso} AD is outside the supported Bikram Sambat table (BS 1978–2099 / AD 1921–2040).`
    );
  }
}

/** BsDate -> AD 'YYYY-MM-DD'. Throws CalendarError for invalid or out-of-table dates. */
export function bsToAd(bs: BsDate): ISODate {
  const msg = validateBsParts(bs);
  if (msg) throw new CalendarError("INVALID_BS_DATE", msg);
  try {
    const iso = libBsToAd(fmtBs(bs));
    if (typeof iso !== "string" || !ISO_RE.test(iso)) throw new Error("unparseable");
    return iso;
  } catch {
    throw new CalendarError(
      "OUT_OF_RANGE",
      `BS ${fmtBs(bs)} is outside the supported table (BS 1978–2099).`
    );
  }
}

/** Accepts 'YYYY-MM-DD' numeric BS input and returns a BsDate, or null when invalid. */
export function isValidBsDate(input: string): BsDate | null {
  const m = /^([12]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[0-2])$/.exec(input.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1978 || y > 2099) return null;
  try {
    bsToAd({ year: y, month: mo, day: d });
    return { year: y, month: mo, day: d };
  } catch {
    return null;
  }
}

export function bsDaysInMonth(year: number, month: number): number {
  guardBsYear(year);
  guardMonth(month);
  // Length via AD distance between the firsts of this and the next month.
  const start = bsToAd({ year, month, day: 1 });
  const { year: ny, month: nm } = month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
  let next: ISODate;
  try {
    next = bsToAd({ year: ny, month: nm, day: 1 });
  } catch {
    throw new CalendarError("OUT_OF_RANGE", `Year ${year + 1} BS is beyond the supported table.`);
  }
  return adDaysBetween(start, next);
}

/** Weekday (0=Sun..6=Sat) of the first day of a BS month. */
export function bsMonthStartWeekday(year: number, month: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const start = bsToAd({ year, month, day: 1 });
  return adIsoWeekday(start);
}

/** Today's date (AD) in the department timezone. */
export function todayInDeptTz(now?: Date): ISODate {
  const dt = DateTime.fromJSDate(now ?? new Date()).setZone(DEPARTMENT_TIMEZONE);
  return dt.toFormat("yyyy-MM-dd");
}

// ─── internals ──────────────────────────────────────────────────────────────

function fmtBs(bs: BsDate): string {
  const pad = (n: number): string => (n > 9 ? String(n) : "0" + n);
  return `${pad(bs.year)}-${pad(bs.month)}-${pad(bs.day)}`;
}

function validateBsParts(bs: BsDate): string | null {
  if (!Number.isInteger(bs.year) || bs.year < 1978 || bs.year > 2099) {
    return `BS year ${bs.year} is outside the supported table (1978–2099).`;
  }
  if (!Number.isInteger(bs.month) || bs.month < 1 || bs.month > 12) return `BS month ${bs.month} invalid.`;
  if (!Number.isInteger(bs.day) || bs.day < 1) return `BS day ${bs.day} invalid.`;
  return null;
}

function guardBsYear(year: number): void {
  if (!Number.isInteger(year) || year < 1978 || year > 2098) {
    throw new CalendarError("OUT_OF_RANGE", `BS year ${year} is out of range 1978–2098 (need year+1 in table).`);
  }
}

function guardMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new CalendarError("INVALID_BS_DATE", `BS month ${month} invalid.`);
  }
}

/** Whole days between two ISO dates (UTC-safe date-only arithmetic). */
export function adDaysBetween(from: ISODate, to: ISODate): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Weekday 0=Sunday..6=Saturday for an ISO date. Pure UTC math, TZ-independent. */
export function adIsoWeekday(iso: ISODate): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as 0;
}

/** ISO date + n days, pure UTC arithmetic. */
export function adIsoAddDays(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
