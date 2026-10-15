"use client";

// components/settings/RuleRow.tsx — one memoized row of the rules form (B2).
// Row: min 72px, 16px vertical padding, hairline (ink 6%) between rows.
// Left: label 15px/500 + helper 13px tertiary (max 60ch).
// Right: FIXED 220px control column — input 96px x 40px right-aligned, then a
// fixed 56px suffix cell, so every input's right edge lines up vertically.
// Selects occupy the same column at 160px with a styled control.
import { memo, useCallback } from "react";

export const ruleControlInputCls =
  "h-10 rounded-[12px] border border-(--ink-border) bg-(--paper) text-[14px] text-(--ink) outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--ink) [font-variant-numeric:tabular-nums]";

function RuleSelectControl({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  widthPx,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
  disabled: boolean;
  ariaLabel: string;
  widthPx: number;
}) {
  const known = options.some(([v]) => v === value);
  const shownValue = known ? value : "";
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
    [onChange]
  );
  return (
    <div className="relative" style={{ width: widthPx }}>
      <select
        aria-label={ariaLabel}
        value={shownValue}
        disabled={disabled}
        onChange={handleChange}
        className={`${ruleControlInputCls} w-full appearance-none pr-8 pl-3`}
        style={{ width: widthPx }}
      >
        {/* Unknown stored value: surfaced, never blanked (blank selects are bugs). */}
        {!known && (
          <option value="" disabled>
            Unknown ({value})
          </option>
        )}
        {options.map(([opt, label]) => (
          <option key={opt} value={opt}>
            {label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-(--ink-secondary)"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export const RuleRow = memo(function RuleRow({
  ruleKey,
  label,
  helper,
  kind,
  value,
  unit,
  min,
  max,
  widthPx,
  options,
  error,
  disabled,
  onChange,
  onNumberChange,
}: {
  ruleKey: string;
  label: string;
  helper?: string;
  kind: "number" | "select";
  value: string;
  unit?: string;
  min?: number;
  max?: number;
  widthPx?: number;
  options?: Array<[string, string]>;
  error?: string | null;
  disabled: boolean;
  onChange: (key: string, v: string) => void;
  onNumberChange: (key: string, v: number) => void;
}) {
  const handleNumber = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      onNumberChange(ruleKey, Number.isFinite(n) ? n : min ?? 0);
    },
    [ruleKey, onNumberChange, min]
  );

  return (
    <div className="flex min-h-[72px] items-center justify-between gap-4 border-b border-(--ink-border-row) py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-(--ink)">{label}</div>
        {helper && (
          <div className="mt-0.5 max-w-[60ch] text-[13px] leading-snug text-(--ink-tertiary)">
            {helper}
          </div>
        )}
        {error && (
          <div role="alert" className="mt-1 text-[13px] text-(--critical-text)">
            {error}
          </div>
        )}
      </div>
      <div className="flex h-10 w-[220px] shrink-0 items-center justify-end gap-0">
        {kind === "number" ? (
          <>
            <input
              type="number"
              aria-label={label}
              min={min}
              max={max}
              value={value}
              disabled={disabled}
              onChange={handleNumber}
              className={`${ruleControlInputCls} text-right`}
              style={{ width: 96 }}
            />
            <span className="inline-flex h-10 w-[56px] items-center justify-start pl-2 text-[13px] text-(--ink-tertiary)">
              {unit}
            </span>
          </>
        ) : (
          <RuleSelectControl
            ariaLabel={label}
            value={value}
            options={options ?? []}
            onChange={(v) => onChange(ruleKey, v)}
            disabled={disabled}
            widthPx={widthPx ?? 160}
          />
        )}
      </div>
    </div>
  );
});
