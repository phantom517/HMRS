import { DateTime } from "luxon";
import type { ShiftTypeRecord } from "./types";

/**
 * One place that turns (calendar date + shift template + department timezone)
 * into concrete instants. Handles overnight shifts (end <= start means the end is
 * next day) and DST days (23h/25h days) using Luxon — offsets are never hand-rolled.
 */

export interface MaterializedShift {
  startAt: string; // ISO instant (timestamptz)
  endAt: string; // ISO instant; interval is half-open [startAt, endAt)
  paidHours: number; // duration minus break
}

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hour: h, minute: m || 0 };
}

function resolveZone(tz: string): string {
  // Luxon has no Zone.isValidZone static; probe a date in the zone and only
  // fall back to UTC when it is not a real zone.
  const probe = DateTime.fromISO("2000-01-01T00:00", { zone: tz });
  return probe.isValid ? tz : "UTC";
}

export function materializeShift(
  date: string, // local YYYY-MM-DD working day
  shiftType: Pick<ShiftTypeRecord, "startTime" | "endTime" | "breakDurationMinutes" | "crossesMidnight">,
  tz: string
): MaterializedShift {
  const zone = resolveZone(tz);
  const start = parseHHMM(shiftType.startTime);
  const end = parseHHMM(shiftType.endTime);

  const startAt = DateTime.fromISO(date, { zone }).set(start);
  let endAt = DateTime.fromISO(date, { zone }).set(end);

  // Overnight: end <= start means the end is the next calendar day.
  if (shiftType.crossesMidnight || endAt.toMillis() <= startAt.toMillis()) {
    endAt = endAt.plus({ days: 1 });
  }

  const paid =
    (endAt.toMillis() - startAt.toMillis()) / 3600000 -
    (shiftType.breakDurationMinutes || 0) / 60;

  return {
    startAt: startAt.toISO() as string,
    endAt: endAt.toISO() as string,
    paidHours: Math.max(0, Math.round(paid * 100) / 100),
  };
}

/** Local calendar date (YYYY-MM-DD) of an instant, in the department timezone. */
export function workingDayOf(instant: string, tz: string): string {
  return DateTime.fromISO(instant, { zone: resolveZone(tz) }).toFormat("yyyy-MM-dd");
}

export function addDaysLocal(date: string, days: number, tz: string): string {
  return DateTime.fromISO(date, { zone: resolveZone(tz) })
    .plus({ days })
    .toFormat("yyyy-MM-dd");
}

/** Difference in whole local days from `a` to `b` (positive when b is later). */
export function daysBetweenLocal(a: string, b: string, tz: string): number {
  const da = DateTime.fromISO(a, { zone: resolveZone(tz) });
  const db = DateTime.fromISO(b, { zone: resolveZone(tz) });
  return Math.round(db.diff(da.startOf("day"), "days").days);
}

/** weekKey for the configured week start: the Monday/Sunday-start anchor date. */
export function weekKeyOf(date: string, weekStartDay: number, tz: string): string {
  const d = DateTime.fromISO(date, { zone: resolveZone(tz) });
  const dow = (d.weekday % 7) as number; // Luxon: Mon=1..Sun=7 → 0=Sun
  const diff = (dow - weekStartDay + 7) % 7;
  return d.minus({ days: diff }).toFormat("yyyy-MM-dd");
}

export function monthKeyOf(date: string, tz: string): string {
  return DateTime.fromISO(date, { zone: resolveZone(tz) }).toFormat("yyyy-MM");
}

export function isWeekendDate(date: string, tz: string): boolean {
  const dow = DateTime.fromISO(date, { zone: resolveZone(tz) }).weekday % 7; // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

/** All local dates in an inclusive range, ascending. */
export function listLocalDates(from: string, to: string, tz: string): string[] {
  const out: string[] = [];
  let cursor = DateTime.fromISO(from, { zone: resolveZone(tz) });
  const end = DateTime.fromISO(to, { zone: resolveZone(tz) });
  while (cursor <= end) {
    out.push(cursor.toFormat("yyyy-MM-dd"));
    cursor = cursor.plus({ days: 1 });
  }
  return out;
}
