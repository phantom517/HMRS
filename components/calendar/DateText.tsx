// components/calendar/DateText.tsx — the ONLY way user-visible dates render.
// Server-safe: reads the resolved calendar prefs (cookie -> user -> dept) once
// per request via React `cache`, and formats through lib/calendar exclusively.
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarPrefs } from "@/lib/calendar/prefs";
import { adToBs } from "@/lib/calendar/convert";
import { formatDate, periodLabel } from "@/lib/calendar/format";
import { rangeForPeriod } from "@/lib/calendar/grid";
import type { CalendarLocale, CalendarSystem, DateFormatStyle } from "@/lib/calendar/types";

/** Per-request memoized prefs (cookies + user row + dept default). */
const resolvePrefs = cache(async () => {
  try {
    const user = await getCurrentUser();
    return getCalendarPrefs(user?.id ?? null);
  } catch {
    return { system: "AD" as CalendarSystem, locale: "en" as CalendarLocale, userSet: false };
  }
});

interface DateTextProps {
  iso: string; // ALWAYS Gregorian
  format?: DateFormatStyle;
  /** Optional explicit override (e.g. a report forced to a fixed system) */
  system?: CalendarSystem;
  locale?: CalendarLocale;
}

export async function DateText({ iso, format = "short", system, locale }: DateTextProps) {
  const prefs = await resolvePrefs();
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatDate(iso, {
        system: system ?? prefs.system,
        locale: locale ?? prefs.locale,
        style: format,
      })}
    </span>
  );
}

interface DateRangeTextProps {
  from: string; // Gregorian inclusive
  to: string; // Gregorian inclusive
  system?: CalendarSystem;
  locale?: CalendarLocale;
}

/** "Ashwin 27 – Kartik 5, 2083" or AD "Oct 13 – Nov 9, 2026"; same-month collapses. */
export async function DateRangeText({ from, to, system, locale }: DateRangeTextProps) {
  const prefs = await resolvePrefs();
  const sys = system ?? prefs.system;
  const loc = locale ?? prefs.locale;

  if (sys === "BS") {
    const start = tryAdToBs(from);
    const end = tryAdToBs(to);
    if (start && end && start.year === end.year && start.month === end.month) {
      // Same BS month: "Ashwin 27 – 5, 2083" style collapse
      const startText = formatDate(from, { system: "BS", locale: loc });
      const startShort = startText.split(",").slice(0, 1).join(",");
      return (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {`${startShort.split(" ").slice(0, 1).join(" ")} ${start.day} – ${end.day}, ${start.year}`}
        </span>
      );
    }
    return (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatDate(from, { system: "BS", locale: loc })} – {formatDate(to, { system: "BS", locale: loc })}
      </span>
    );
  }

  // AD: collapse to "Oct 13 – Nov 9, 2026" when same month
  if (from.slice(0, 7) === to.slice(0, 7)) {
    const endText = formatDate(to, { system: "AD", locale: loc });
    return (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatDate(from, { system: "AD", locale: loc })} – {endText.split(" ").slice(1).join(" ")}
      </span>
    );
  }
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatDate(from, { system: "AD", locale: loc })} – {formatDate(to, { system: "AD", locale: loc })}
    </span>
  );
}

function tryAdToBs(iso: string) {
  try {
    return adToBs(iso);
  } catch {
    return null;
  }
}

/**
 * "Period basis" note for filter bars:
 * "BS month: Ashwin 2083 · Oct 11 – Nov 9, 2026"
 */
export async function PeriodBasisText({ from, to }: { from: string; to: string }) {
  const prefs = await resolvePrefs();
  if (prefs.system === "AD") return null;

  const bsStart = tryAdToBs(from);
  if (!bsStart) return null;
  const bsRange = rangeForPeriod("BS", bsStart.year, bsStart.month);
  return (
    <span style={{ fontSize: 12, color: "var(--ink-tertiary)", fontVariantNumeric: "tabular-nums" }}>
      BS month: {periodLabel("BS", bsStart.year, bsStart.month, prefs.locale)} ·{" "}
      {formatDate(from, { system: "AD" })} – {formatDate(to, { system: "AD" })}
      {bsRange.to !== to ? ` (range trims to selected period)` : ""}
    </span>
  );
}
