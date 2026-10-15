// lib/calendar/prefs.ts — SERVER-ONLY calendar preference resolution.
//
// Order: cookie (for no-flicker first paint) -> user row -> department default.
// This affects DISPLAY ONLY. No stored date is ever converted or changed.
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { CalendarLocale, CalendarSystem } from "./types";

export const CALENDAR_PREF_COOKIE = "hrms_cal_pref";
export const LOCALE_PREF_COOKIE = "hrms_locale_pref";

export interface CalendarPrefs {
  system: CalendarSystem;
  locale: CalendarLocale;
  /** true when resolved from the user row / cookie rather than department default */
  userSet: boolean;
}

function sanitizeSystem(v: string | undefined | null): CalendarSystem | null {
  return v === "BS" || v === "AD" ? v : null;
}

function sanitizeLocale(v: string | undefined | null): CalendarLocale | null {
  return v === "ne" || v === "en" ? v : null;
}

/**
 * Resolve the active calendar system + locale for a signed-in user.
 * Safe to call from Server Components: cookie first, then user row, then
 * the department default — so the FIRST PAINT already renders in the right
 * system without client flicker.
 */
export async function getCalendarPrefs(userId?: string | null): Promise<CalendarPrefs> {
  let system: CalendarSystem | null = null;
  let locale: CalendarLocale | null = null;

  // 1. Cookies (set by the switcher's server action; survive render on next paint)
  let userSet = false;
  try {
    const store = await cookies();
    const cs = sanitizeSystem(store.get(CALENDAR_PREF_COOKIE)?.value);
    const loc = sanitizeLocale(store.get(LOCALE_PREF_COOKIE)?.value);
    if (cs || loc) userSet = true;
    system = cs;
    locale = loc;
  } catch {
    // No cookies context (unit tests / route handlers) — fall through.
  }

  // 2. User row
  if (userId) {
    try {
      const user = await db.getUserById(userId);
      const cs = sanitizeSystem(user?.calendarSystem as string | undefined);
      const loc = sanitizeLocale(user?.uiLocale as string | undefined);
      if (cs || loc) userSet = true;
      system = system ?? cs;
      locale = locale ?? loc;
    } catch {
      // DB unavailable — keep cookie values / fall through to dept default.
    }
  }

  // 3. Department defaults
  if (!system || !locale) {
    try {
      const settings = await db.getDepartmentSettings();
      system = system ?? sanitizeSystem(settings?.defaultCalendarSystem as string | undefined) ?? "AD";
      locale = locale ?? sanitizeLocale(settings?.defaultLocale as string | undefined) ?? "en";
    } catch {
      system = system ?? "AD";
      locale = locale ?? "en";
    }
  }

  return { system: system!, locale: locale!, userSet };
}
