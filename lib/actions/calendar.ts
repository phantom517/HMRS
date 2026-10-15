"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  CALENDAR_PREF_COOKIE,
  LOCALE_PREF_COOKIE,
} from "@/lib/calendar/prefs";
import type { CalendarLocale, CalendarSystem } from "@/lib/calendar/types";

/**
 * Save display preferences for the signed-in user. Affects DISPLAY ONLY —
 * no stored data is ever converted. Cookie is set too so the NEXT server
 * render (first paint) already shows the chosen system with no flicker.
 */
export async function setCalendarPrefsAction(prefs: {
  system?: CalendarSystem;
  locale?: CalendarLocale;
}): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (!user) {
    // Not signed in — still allow a session-scoped display preference.
    const store = await cookies();
    if (prefs.system) store.set(CALENDAR_PREF_COOKIE, prefs.system, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    if (prefs.locale) store.set(LOCALE_PREF_COOKIE, prefs.locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const updates: Record<string, string> = {};
  if (prefs.system) {
    updates.calendarSystem = prefs.system;
  }
  if (prefs.locale) {
    updates.uiLocale = prefs.locale;
  }
  if (Object.keys(updates).length > 0) {
    await db.updateUser(user.id, updates);
  }

  const store = await cookies();
  if (prefs.system) store.set(CALENDAR_PREF_COOKIE, prefs.system, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  if (prefs.locale) store.set(LOCALE_PREF_COOKIE, prefs.locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  // Refresh server components so every <DateText /> repaints in the new system.
  revalidatePath("/", "layout");
  return { ok: true };
}
