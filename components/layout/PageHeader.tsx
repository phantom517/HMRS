"use client";

import { UserRound } from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";

/** Derive 2-letter initials from a full name ("Eve Adams" → "EA"). Honorifics are skipped. */
export function initialsOf(name: string): string {
  return (name || "")
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Small line used under the page header — plain text, numbers in 500, red only for real problems. */
export function SummaryLine({
  parts,
}: {
  parts: Array<{
    label: string;
    value: string | number;
    critical?: boolean;
  }>;
}) {
  const visible = parts.filter((p) => p.critical || Number(p.value) !== 0 || typeof p.value !== "number");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        fontSize: 14,
        color: "var(--ink-secondary)",
        fontVariantNumeric: "tabular-nums",
        flexWrap: "wrap",
        whiteSpace: "nowrap",
      }}
    >
      {visible.map((p, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          {i > 0 && <span style={{ color: "var(--ink-tertiary)" }}>·</span>}
          <span style={{ fontWeight: 500, color: p.critical ? "var(--critical-text)" : "var(--ink)" }}>
            {p.value}
          </span>
          <span>{p.label}</span>
        </span>
      ))}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  summary?: React.ReactNode;
}

/**
 * One shared header for every page:
 *  - title 32/500/-0.38 matching the sidebar label exactly
 *  - one quiet subtitle line
 *  - right-aligned actions aligned with the title baseline
 *  - optional quiet summary line below
 */
export function PageHeader({ title, subtitle, actions, summary }: PageHeaderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: "-0.38px",
              color: "var(--ink)",
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 16,
              fontWeight: 400,
              color: "var(--ink-secondary)",
              margin: "4px 0 0",
              maxWidth: 640,
            }}
          >
            {subtitle}
          </p>
        </div>
        {actions && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              transform: "translateY(-6px)",
            }}
          >
            {actions}
          </div>
        )}
      </div>
      {summary && <div>{summary}</div>}
    </div>
  );
}

/** Styled select used everywhere (replaces native selects; custom chevron, no wrap). */
export const zSelectStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  background: "var(--linen)",
  border: "1px solid var(--ink-border)",
  fontSize: 13,
  color: "var(--ink)",
  fontFamily: "inherit",
  appearance: "none",
  WebkitAppearance: "none",
  padding: "0 32px 0 12px",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23121718' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  cursor: "pointer",
};

export const zFieldStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  background: "var(--linen)",
  border: "1px solid var(--ink-border)",
  fontSize: 13,
  color: "var(--ink)",
  fontFamily: "inherit",
  padding: "0 12px",
  outline: "none",
};

/** Text-only segmented tabs with quiet counts — shared across pages. */
export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--linen)",
        borderRadius: 12,
        border: "1px solid var(--ink-border)",
        flexShrink: 0,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: "var(--ink)",
              background: isActive ? "var(--paper)" : "transparent",
              border: isActive ? "1px solid var(--ink-border)" : "1px solid transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-tertiary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Empty state inside a paper surface. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--ink-secondary)", maxWidth: 360 }}>{hint}</div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
