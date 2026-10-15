"use client";import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { getMonthGrid, parseDateInput } from "@/lib/calendar/grid";
import { formatDate, otherSystemEquivalent, periodLabel } from "@/lib/calendar/format";
import { todayInDeptTz, adToBs } from "@/lib/calendar/convert";
import type { CalendarLocale, CalendarSystem } from "@/lib/calendar/types";

interface DatePickerProps {
  /**
   * The current value — ALWAYS Gregorian 'YYYY-MM-DD', even in BS mode.
   * The form stores and submits exactly this string.
   */
  value: string | null;
  /** Called with the Gregorian ISO string, never a BS value. */
  onChange: (iso: string | null) => void;
  system: CalendarSystem;
  locale?: CalendarLocale;
  placeholder?: string;
  minIso?: string;
  maxIso?: string;
  id?: string;
}

/**
 * shadcn-style popover datepicker. Renders in the user's calendar system
 * (grid from {@link getMonthGrid}); the value bound to the form state is the
 * Gregorian ISO string — conversion happens HERE in the picker, never in
 * validation or storage. A quiet "= Oct 13, 2026" line shows the other
 * system's equivalent for the selected date.
 */
export function DatePicker({
  value,
  onChange,
  system,
  locale = "en",
  placeholder = "Select date",
  minIso,
  maxIso,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);

  // View anchor: the month being displayed, per system (BS needs year+month, AD same).
  const [view, setView] = useState(() => anchorOf(value, system));

  // When the system toggles mid-edit, KEEP the stored Gregorian value and
  // re-anchor the view to that same date in the new system. Adjusted during
  // render (not in an effect) per React's recommended state-reset pattern.
  const [prevSystem, setPrevSystem] = useState(system);
  if (prevSystem !== system) {
    setPrevSystem(system);
    setView(anchorOf(value, system));
    setTyped("");
    setTypeError(null);
  }

  const todayIso = useMemo(() => todayInDeptTz(), []);
  const grid = useMemo(
    () => getMonthGrid(system, view.year, view.month, locale, 0, todayIso),
    [system, view.year, view.month, locale, todayIso]
  );

  const monthTitle = periodLabel(system, view.year, view.month, locale);
  const weekdayHeader = useMemo(
    () =>
      (system === "BS" && locale === "ne"
        ? ["आइ", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
    [system, locale]
  );

  function stepMonth(dir: 1 | -1) {
    let { year, month } = view;
    month += dir;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    setView({ system, year, month });
  }

  function commitTyped(raw: string) {
    if (!raw.trim()) { setTypeError(null); return; }
    try {
      const iso = parseDateInput(raw, system);
      if (minIso && iso < minIso) { setTypeError(`Before allowed range (${minIso})`); return; }
      if (maxIso && iso > maxIso) { setTypeError(`After allowed range (${maxIso})`); return; }
      setTypeError(null);
      onChange(iso);
      setView(anchorOf(iso, system));
      setTyped("");
      setOpen(false);
    } catch (err: unknown) {
      setTypeError(err instanceof Error ? err.message : "Invalid date");
    }
  }

  const displayText = value
    ? formatDate(value, { system, locale })
    : placeholder;
  const quietLine = value ? otherSystemEquivalent(value, system, locale) : null;

  return (
    <div style={{ position: "relative" }}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          minHeight: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 10,
          fontSize: 13,
          color: value ? "var(--ink)" : "var(--ink-tertiary)",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <Calendar style={{ width: 15, height: 15, strokeWidth: 1.5, flexShrink: 0, color: "var(--ink-secondary)" }} />
        <span style={{ fontVariantNumeric: "tabular-nums", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayText}
        </span>
        {value && (
          <span
            role="button"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            style={{ color: "var(--ink-tertiary)", display: "flex" }}
          >
            <X style={{ width: 14, height: 14 }} />
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="zelt-surface"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 41,
              width: 300,
              padding: 14,
              boxShadow: "0 8px 30px rgba(18, 23, 24, 0.10)",
            }}
          >
            {/* Month navigator — labels follow the ACTIVE system */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" style={navBtn}>
                <ChevronLeft style={{ width: 15, height: 15 }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {monthTitle}
              </span>
              <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" style={navBtn}>
                <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* Weekday header, Sunday-first */}
            <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
              {weekdayHeader.map((d) => (
                <span key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--ink-tertiary)" }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Grid: 7-wide weeks of cells */}
            <div>
              {grid.weeks.map((week, wi) => (
                <div key={wi} style={{ display: "flex", gap: 2 }}>
                  {week.map((cell) => {
                    const disabled = Boolean(
                      (minIso && cell.iso < minIso) || (maxIso && cell.iso > maxIso)
                    );
                    const selected = cell.iso === value;
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onChange(cell.iso); // Gregorian ISO — the wire format
                          setOpen(false);
                        }}
                        style={{
                          flex: 1,
                          height: 30,
                          borderRadius: 8,
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                          color:
                            selected ? "var(--paper)"
                            : disabled ? "var(--ink-border)"
                            : !cell.inMonth ? "var(--ink-tertiary)"
                            : cell.isToday ? "var(--brand)"
                            : "var(--ink)",
                          background: selected ? "var(--ink)" : cell.isToday ? "var(--linen)" : "transparent",
                          border: selected ? "1px solid var(--ink)" : "1px solid transparent",
                          cursor: disabled ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                        }}
                        title={formatDate(cell.iso, {
                          system: cell.inMonth ? system : system,
                          locale,
                        })}
                      >
                        {cell.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Type a date — parses in the active system, commits the Gregorian ISO */}
            <input
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                commitTypedDebounced(e.target.value, commitTyped);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTyped(typed);
                }
              }}
              placeholder={system === "BS" ? "Type 2083-06-27 (BS)" : "Type 2026-10-13"}
              style={{
                marginTop: 10,
                width: "100%",
                minHeight: 32,
                padding: "0 10px",
                background: "var(--parchment)",
                border: "1px solid var(--ink-border)",
                borderRadius: 8,
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ink)",
                fontFamily: "inherit",
              }}
            />
            {typed && typeError && (
              <div style={{ fontSize: 11, color: "var(--critical-text)", marginTop: 4 }}>{typeError}</div>
            )}

            {/* Quiet equivalent line: the OTHER system for the selected date */}
            {quietLine && (
              <div style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
                {quietLine}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Debounce just enough that typing "2083-06-27" doesn't error per keystroke.
let commitTimer: ReturnType<typeof setTimeout> | undefined;
function commitTypedDebounced(raw: string, commit: (raw: string) => void) {
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => commit(raw), 450);
}

function anchorOf(value: string | null, system: CalendarSystem): { system: CalendarSystem; year: number; month: number } {
  try {
    if (value) {
      if (system === "BS") {
        const bs = adToBs(value);
        return { system, year: bs.year, month: bs.month };
      }
      return { system, year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
    }
  } catch {
    // fall through to today
  }
  // Today in the department timezone, expressed in the ACTIVE system
  const today = todayInDeptTz();
  if (system === "BS") {
    const bs = adToBs(today);
    return { system, year: bs.year, month: bs.month };
  }
  return { system, year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

const navBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  background: "transparent",
  border: "1px solid transparent",
  cursor: "pointer",
  color: "var(--ink)",
};
