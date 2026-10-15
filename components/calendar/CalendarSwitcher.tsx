"use client";

import { useTransition } from "react";
import { setCalendarPrefsAction } from "@/lib/actions/calendar";
import type { CalendarLocale, CalendarSystem } from "@/lib/calendar/types";

interface CalendarSwitcherProps {
  system: CalendarSystem; // resolved active system (server-rendered)
  compact?: boolean;
}

/**
 * Ghost segmented control "AD | BS" — display-only switch. Saves through a
 * server action (cookie + user row) and re-renders server components.
 */
export function CalendarSwitcher({ system, compact }: CalendarSwitcherProps) {
  const [pending, startTransition] = useTransition();

  function pick(next: CalendarSystem) {
    if (next === system) return;
    startTransition(async () => {
      await setCalendarPrefsAction({ system: next });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Calendar system"
      style={{
        display: "inline-flex",
        padding: 2,
        background: "transparent",
        border: "1px solid var(--ink-border)",
        borderRadius: 999,
        opacity: pending ? 0.6 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      {(["AD", "BS"] as const).map((s) => (
        <button
          key={s}
          role="tab"
          aria-selected={system === s}
          disabled={pending}
          onClick={() => pick(s)}
          style={{
            height: compact ? 24 : 28,
            padding: "0 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: system === s ? 500 : 400,
            color: "var(--ink)",
            background: system === s ? "var(--paper)" : "transparent",
            border: system === s ? "1px solid var(--ink-border-row)" : "1px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 0.2,
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

interface LocaleSwitcherProps {
  locale: CalendarLocale;
}

/** "EN | ने" toggle, lives inside the user menu. Display-only. */
export function LocaleSwitcher({ locale }: LocaleSwitcherProps) {
  const [pending, startTransition] = useTransition();

  function pick(next: CalendarLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setCalendarPrefsAction({ locale: next });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Date numerals locale"
      style={{ display: "inline-flex", gap: 2 }}
    >
      {(
        [
          { id: "en", label: "EN" },
          { id: "ne", label: "ने" },
        ] as const
      ).map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={locale === id}
          disabled={pending}
          onClick={() => pick(id)}
          style={{
            height: 26,
            padding: "0 8px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: locale === id ? 500 : 400,
            color: "var(--ink)",
            background: locale === id ? "var(--linen)" : "transparent",
            border: locale === id ? "1px solid var(--ink-border)" : "1px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
