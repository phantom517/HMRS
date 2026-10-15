// ---------------------------------------------------------------------------
// lib/calendar — the ONLY place calendar arithmetic and formatting happen.
//
// Storage in this app is ALWAYS Gregorian (AD): `timestamptz` for instants,
// `date` columns for date-only fields. Bikram Sambat (BS) exists only at the
// display and input boundary — no DB column, type or schema holds a BS value.
// ---------------------------------------------------------------------------

export type CalendarSystem = "AD" | "BS";

/** Formatting locale (not the database of UI strings — that is i18n, phase 2). */
export type CalendarLocale = "en" | "ne";

/** Adahttps style kept minimal: ISO 'YYYY-MM-DD' is the canonical wire format. */
export type ISODate = string; // 'YYYY-MM-DD', Gregorian only

export interface BsDate {
  year: number; // e.g. 2083
  month: number; // 1–12 (1 = Baisakh)
  day: number;
}

/** Machine-readable error so callers can branch instead of string-matching. */
export type CalendarErrorCode = "OUT_OF_RANGE" | "INVALID_BS_DATE" | "INVALID_INPUT";

export class CalendarError extends Error {
  code: CalendarErrorCode;
  constructor(code: CalendarErrorCode, message: string) {
    super(message);
    this.name = "CalendarError";
    this.code = code;
  }
}

/** Styles supported by formatDate. */
export type DateFormatStyle = "short" | "long" | "monthYear" | "weekday";

/**
 * The department timezone. Nepal does not observe DST, so offsets are
 * constant and instants ⇄ local-date conversion is lossless.
 */
export const DEPARTMENT_TIMEZONE = "Asia/Kathmandu";
