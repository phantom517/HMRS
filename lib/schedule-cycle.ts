/**
 * The department's schedule cycle.
 *
 * "Today" is computed LIVE in the department timezone (Asia/Kathmandu,
 * UTC+05:45 — no DST, so a fixed offset is always correct). Every page,
 * client component and the AI assistant derives ALL dates from this single
 * source so the page header, the grid's "Today" column, the coverage footer,
 * the sidebar badge and the assistant's live context can never disagree again.
 */
export const DEPARTMENT_TZ_OFFSET_MINUTES = 345; // Asia/Kathmandu = UTC+05:45

/**
 * The real current date in the department timezone (ISO 'YYYY-MM-DD').
 * Computed per call so long-lived server processes never serve a stale day.
 */
export function cycleToday(now: Date = new Date()): string {
  return new Date(now.getTime() + DEPARTMENT_TZ_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * @deprecated use cycleToday() — kept as a live-computed value for callers
 * that still import the old name.
 */
export const CYCLE_TODAY = cycleToday();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function asUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function shiftDate(iso: string, offsetDays: number): string {
  return toISO(new Date(asUTC(iso).getTime() + offsetDays * MS_PER_DAY));
}

/** Monday-start week containing `today`. */
function mondayOfWeek(today: Date): Date {
  const dow = today.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(today.getTime() - back * MS_PER_DAY);
}

export interface WeekDate {
  date: string;
  weekday: string; // Mon
  dayNumber: string; // 21
  fullLabel: string; // Mon 21
  isWeekend: boolean;
  isToday: boolean;
}

export interface RosterWeek {
  offset: number;
  startDate: string;
  endDate: string;
  dates: WeekDate[];
  /** e.g. "Oct 21 – 27, 2024" */
  weekLabel: string;
  /** e.g. "43" (ISO week of the cycle), or null when it doesn't match the cycle */
  isoWeek: string | null;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** ISO-8601 week number (Monday-start week) for an ISO date string. */
export function isoWeekOf(iso: string): number {
  const d = asUTC(iso);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
}

/**
 * The roster week for a plain (non-database-coupled) cycle date, e.g. the
 * department's fixed "today". Any week offset navigates in whole weeks.
 */
export function getRosterWeek(offset = 0): RosterWeek {
  const todayStr = cycleToday();
  const monday = new Date(asUTC(todayStr).getTime() + offset * 7 * MS_PER_DAY);
  const startDate = toISO(monday);
  const endDate = shiftDate(startDate, 6);

  const dates: WeekDate[] = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDate(startDate, i);
    const dow = i; // Monday-start order
    dates.push({
      date: d,
      weekday: WEEKDAY_NAMES[dow],
      dayNumber: d.slice(8, 10).replace(/^0/, ""),
      fullLabel: `${WEEKDAY_NAMES[dow]} ${d.slice(8, 10)}`,
      isWeekend: dow >= 5,
      isToday: d === todayStr,
    });
  }

  const end = asUTC(endDate);
  const label =
    monday.getUTCMonth() === end.getUTCMonth()
      ? `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`
      : `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;

  return {
    offset,
    startDate,
    endDate,
    dates,
    weekLabel: label,
    isoWeek: String(isoWeekOf(todayStr)),
  };
}

/** Net (break-subtracted) duration in hours for a shift type record. */
export function netHoursOf(shiftType: any): number {
  const n = parseFloat(shiftType?.netDurationHours);
  return Number.isFinite(n) && n > 0 ? n : 8.0;
}

/**
 * COMPUTE paid hours from times: (end − start, overnight-aware) minus break.
 * This is the single source every page uses for "Paid hours" — never trust a
 * stored netDurationHours that may drift from the times.
 */
export function computedNetHours(
  startTime: string,
  endTime: string,
  breakMinutes = 0,
  crossesMidnight = false
): number {
  const [sh, sm] = String(startTime).split(":").map(Number);
  const [eh, em] = String(endTime).split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins || crossesMidnight) endMins += 24 * 60;
  return Math.max(0, (endMins - startMins - breakMinutes) / 60);
}

/** True when a shift type is a night / +1-day overnight shift. */
export function isNightShiftType(shiftType: any): boolean {
  if (!shiftType) return false;
  return Boolean(shiftType.crossesMidnight) || shiftType.shortCode === "N";
}

/** Category of shift tints used across the roster grid (single source). */
export type ShiftTint = "day" | "night" | "oncall" | "none";

export function shiftTintOf(shiftType: any): ShiftTint {
  if (!shiftType) return "none";
  if (isNightShiftType(shiftType)) return "night";
  if (/STANDBY|ON-?CALL/i.test(shiftType.category || "")) return "oncall";
  return "day";
}

/** Short, specific conflict reason for grid cells ("Rest < 10h", "Over max hours"). */
export function shortConflictReason(rawReason: string): string {
  const r = (rawReason || "").toLowerCase();
  if (/rest|turnaround/.test(r)) {
    const m = rawReason.match(/([\d.]+)\s*h/i);
    return m ? `Rest < ${m[1]}h` : "Rest < 11h";
  }
  if (/consecutive|fatigue/.test(r)) return "Too many days";
  if (/over|weekly|max hours|overtime/.test(r)) return "Over max hours";
  if (/leave|off.?day/.test(r)) return "On leave";
  return rawReason ? rawReason.split(/[.;(\n-]/)[0].trim().slice(0, 24) : "Conflict";
}

export function formatHours(h: number): string {
  return `${(Math.round(h * 10) / 10).toFixed(1)}h`;
}
