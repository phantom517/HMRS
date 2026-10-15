// lib/calendar/format.ts — the only date-formatting boundary. No component
// may call date-fns/open/luxon formatters for user-visible dates.
import { adToBs, bsToAd, adIsoWeekday } from "./convert";
import type { BsDate, CalendarLocale, CalendarSystem, DateFormatStyle, ISODate } from "./types";

/** BS month names — transliteration and Nepali script. */
export const BS_MONTHS_EN = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];
export const BS_MONTHS_NE = [
  "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत",
];
/** Weekday: index = JS getUTCDay() (0=Sun). en / ne. */
export const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
/** Long weekday names. */
export const WEEKDAYS_EN_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
export const WEEKDAYS_NE_LONG = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार",
];

const DEV_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/** Western digits -> Devanagari digits. */
export function toNepaliDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => DEV_DIGITS[Number(d)]);
}

/** Devanagari digits (and mixed) -> Western digits. Used by parseDateInput. */
export function toAdDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
}

export function bsMonthName(month: number, locale: CalendarLocale): string {
  return locale === "ne" ? BS_MONTHS_NE[month - 1] : BS_MONTHS_EN[month - 1];
}

/**
 * format a date in the requested calendar system + locale.
 * - system='AD', locale='en': "Oct 13, 2026"
 * - system='BS', locale='en': "Ashwin 27, 2083"
 * - system='BS', locale='ne': "असोज २७, २०८३"
 * - system='AD', locale='en', style='monthYear': "Oct 2026"
 * - system='AD', locale='en', style='weekday': "Tue" / "Tuesday"
 *
 * User-visible dates ONLY. tabular digits in both sets are font-enabled via CSS.
 */
export function formatDate(
  iso: ISODate,
  opts: { system?: CalendarSystem; locale?: CalendarLocale; style?: DateFormatStyle }
): string {
  const { system = "AD", locale = "en", style = "short" } = opts;
  if (system === "AD") return formatAd(iso, locale, style);
  return formatBs(iso, locale, style);
}

function digitize(s: string, locale: CalendarLocale): string {
  return locale === "ne" ? toNepaliDigits(s) : s;
}

function formatAd(iso: ISODate, locale: CalendarLocale, style: DateFormatStyle): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Month/weekday names stay English for locale='en'; for locale='ne' use Nepali names.
  const MON = locale === "ne"
    ? ["जन", "फेब", "मार्च", "अप्र", "मे", "जुन", "जुल", "अग", "सेप्ट", "अक्ट", "नोभ", "डिस"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const w = adIsoWeekday(iso);
  const weekday = locale === "ne" ? WEEKDAYS_NE[w] : WEEKDAYS_EN[w];
  const weekdayLong = locale === "ne" ? WEEKDAYS_NE_LONG[w] : WEEKDAYS_EN_LONG[w];
  switch (style) {
    case "weekday":
      return digitize(weekdayLong, locale);
    case "monthYear":
      return digitize(`${MON[m - 1]} ${y}`, locale);
    case "long":
      return digitize(`${weekdayLong}, ${MON[m - 1]} ${d}, ${y}`, locale);
    case "short":
    default:
      return digitize(`${MON[m - 1]} ${d}, ${y}`, locale);
  }
}

function formatBs(iso: ISODate, locale: CalendarLocale, style: DateFormatStyle): string {
  const bs = adToBs(iso);
  return formatBsParts(bs, locale, style);
}

/** Format an already-converted BS date (avoids double conversion in grids). */
export function formatBsParts(
  bs: BsDate,
  locale: CalendarLocale,
  style: DateFormatStyle
): string {
  // Weekday must come from the AD equivalent (BS years don't expose weekday directly).
  const adIso = bsToAd(bs);
  const w = adIsoWeekday(adIso);
  const monthName = bsMonthName(bs.month, locale);
  const dayStr = String(bs.day);
  switch (style) {
    case "weekday": {
      const weekdayLong = locale === "ne" ? WEEKDAYS_NE_LONG[w] : WEEKDAYS_EN_LONG[w];
      return digitize(weekdayLong, locale);
    }
    case "monthYear": {
      return digitize(`${monthName} ${bs.year}`, locale);
    }
    case "long": {
      const weekdayLong = locale === "ne" ? WEEKDAYS_NE_LONG[w] : WEEKDAYS_EN_LONG[w];
      return digitize(
        `${weekdayLong}, ${monthName} ${dayStr}, ${bs.year}`,
        locale
      );
    }
    case "short":
    default:
      return digitize(`${monthName} ${dayStr}, ${bs.year}`, locale);
  }
}

/** Quiet second line: the other system's equivalent, e.g. "= Oct 13, 2026". */
export function otherSystemEquivalent(iso: ISODate, active: CalendarSystem, locale: CalendarLocale): string {
  const other: CalendarSystem = active === "BS" ? "AD" : "BS";
  return `= ${formatDate(iso, { system: other, locale })}`;
}

/**
 * Header label for a period: e.g. BS -> "Ashwin 2083"; AD -> "October 2026".
 */
export function periodLabel(
  system: CalendarSystem,
  year: number,
  month: number,
  locale: CalendarLocale
): string {
  if (system === "BS") {
    return digitize(`${bsMonthName(month, locale)} ${year}`, locale);
  }
  const MON = locale === "ne"
    ? ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return digitize(`${MON[month - 1]} ${year}`, locale);
}
