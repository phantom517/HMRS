// lib/scheduling/settings.ts — the single source of truth for scheduling
// rule keys, option unions, bounds and defaults. PURE: no react, no drizzle,
// no next. Every page, form, tool and test imports from here — never inline
// a rule option list or a default again.
import { z } from "zod";

// ── Option unions ───────────────────────────────────────────────────────────
// These unions drive BOTH the zod enums and the UI <select> options, so a
// stored value can never fall outside the option list (blank selects are bugs).

export const SEVERITY_OPTIONS = ["warn", "block"] as const;
export type SeverityOption = (typeof SEVERITY_OPTIONS)[number];

export const LEAVE_ACTION_OPTIONS = ["warn", "ignore", "block"] as const;
export type LeaveActionOption = (typeof LEAVE_ACTION_OPTIONS)[number];

/** Numeric week-start days: 0 = Sunday, 1 = Monday, 6 = Saturday. */
export const WEEK_START_OPTIONS = [0, 1, 6] as const;
export type WeekStartOption = (typeof WEEK_START_OPTIONS)[number];

export const WEEK_START_LABELS: Record<WeekStartOption, string> = {
  0: "Sunday",
  1: "Monday",
  6: "Saturday",
};

export const SEVERITY_LABELS: Record<SeverityOption, string> = {
  warn: "Warn",
  block: "Block",
};

export const LEAVE_ACTION_LABELS: Record<LeaveActionOption, string> = {
  warn: "Warn",
  block: "Block",
  ignore: "Ignore",
};

// ── Bounds (shared by inputs, zod and server-side normalization) ────────────

export const RULE_BOUNDS = {
  minRestHoursBetweenShifts: { min: 0, max: 24, default: 11 },
  consecutiveShiftsCap: { min: 1, max: 14, default: 5 },
  maxNightsPerMonth: { min: 0, max: 31, default: 7 },
  weeklyHoursCap: { min: 1, max: 80, default: 48 },
  warningHoursCap: { min: 0, max: 80, default: 40 },
  rosterLockHoursAhead: { min: 0, max: 336, default: 72 },
} as const;

/** Storage keys the rules tab writes. rosterLockHoursAhead is read but hidden
 * until the engine implements it — the type stays so stored data survives. */
export interface RuleValues {
  minRestHoursBetweenShifts: number;
  consecutiveShiftsCap: number;
  maxNightsPerMonth: number;
  weeklyHoursCap: number;
  warningHoursCap: number;
  maxWeeklyHoursSeverity: SeverityOption;
  maxNightsSeverity: SeverityOption;
  pendingLeaveAction: LeaveActionOption;
  weekStartDay: WeekStartOption;
  timezone: string;
  /** Hidden until the engine implements roster lock (see rules-form registry). */
  rosterLockHoursAhead: number;
}

// ── Zod schema ──────────────────────────────────────────────────────────────

const clampedInt = (bound: { min: number; max: number }) =>
  z.coerce
    .number()
    .int("Whole numbers only.")
    .min(bound.min, `Minimum ${bound.min}.`)
    .max(bound.max, `Maximum ${bound.max}.`);

export const rulesSchema = z
  .object({
    minRestHoursBetweenShifts: clampedInt(RULE_BOUNDS.minRestHoursBetweenShifts),
    consecutiveShiftsCap: clampedInt(RULE_BOUNDS.consecutiveShiftsCap),
    maxNightsPerMonth: clampedInt(RULE_BOUNDS.maxNightsPerMonth),
    weeklyHoursCap: clampedInt(RULE_BOUNDS.weeklyHoursCap),
    warningHoursCap: clampedInt(RULE_BOUNDS.warningHoursCap),
    maxWeeklyHoursSeverity: z.enum(SEVERITY_OPTIONS),
    maxNightsSeverity: z.enum(SEVERITY_OPTIONS),
    pendingLeaveAction: z.enum(LEAVE_ACTION_OPTIONS),
    weekStartDay: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(6),
    ]), // WEEK_START_OPTIONS
    timezone: z.string().min(1).max(64),
    rosterLockHoursAhead: clampedInt(RULE_BOUNDS.rosterLockHoursAhead).optional(),
  })
  .superRefine((val, ctx) => {
    // Cross-field rule: the weekly warning must not exceed the weekly cap.
    if (val.warningHoursCap > val.weeklyHoursCap) {
      ctx.addIssue({
        code: "custom",
        path: ["warningHoursCap"],
        message: "Warn at must not exceed the weekly max.",
      });
    }
  });

export type ParsedRules = z.infer<typeof rulesSchema>;

// ── Defaults & normalization ────────────────────────────────────────────────

export const DEFAULT_RULES: RuleValues = {
  minRestHoursBetweenShifts: RULE_BOUNDS.minRestHoursBetweenShifts.default,
  consecutiveShiftsCap: RULE_BOUNDS.consecutiveShiftsCap.default,
  maxNightsPerMonth: RULE_BOUNDS.maxNightsPerMonth.default,
  weeklyHoursCap: RULE_BOUNDS.weeklyHoursCap.default,
  warningHoursCap: RULE_BOUNDS.warningHoursCap.default,
  maxWeeklyHoursSeverity: "warn",
  maxNightsSeverity: "warn",
  pendingLeaveAction: "warn",
  // Spec default: Sunday. (Engine resolveRules falls back to Monday only when
  // the stored row is entirely missing this field.)
  weekStartDay: 0,
  timezone: "UTC",
  rosterLockHoursAhead: RULE_BOUNDS.rosterLockHoursAhead.default,
};

const RULE_KINDS: Record<string, "number" | "severity" | "leaveAction" | "weekStart"> = {
  minRestHoursBetweenShifts: "number",
  consecutiveShiftsCap: "number",
  maxNightsPerMonth: "number",
  weeklyHoursCap: "number",
  warningHoursCap: "number",
  rosterLockHoursAhead: "number",
  maxWeeklyHoursSeverity: "severity",
  maxNightsSeverity: "severity",
  pendingLeaveAction: "leaveAction",
  weekStartDay: "weekStart",
};

/** Legacy spellings seen in old rows — mapped to canonical values on read. */
const NORMALIZERS = {
  severity: (v: unknown) => {
    const s = String(v).trim().toUpperCase();
    if (s === "BLOCK" || s === "BLOCKING") return "block";
    if (s === "WARN" || s === "WARNING") return "warn";
    return null;
  },
  leaveAction: (v: unknown) => {
    const s = String(v).trim().toUpperCase();
    if (s === "BLOCK") return "block";
    if (s === "IGNORE" || s === "IGNORED") return "ignore";
    if (s === "WARN" || s === "WARNING") return "warn";
    return null;
  },
  weekStart: (v: unknown) => {
    const s = String(v).trim().toUpperCase();
    if (s === "SUNDAY" || s === "SUN") return 0;
    if (s === "MONDAY" || s === "MON") return 1;
    if (s === "SATURDAY" || s === "SAT") return 6;
    return null;
  },
} as const;

/**
 * Normalize a stored settings row into typed RuleValues. Unknown enum values
 * are surfaced as `unknownValues` NOT silently replaced — the UI shows them
 * as "Unknown (X)" with an inline error; only saves fix them.
 * This is the migration helper: read through it, write through parseRulesDraft.
 */
export function normalizeRules(row: Partial<Record<keyof RuleValues, unknown>> | null | undefined): {
  values: RuleValues;
  unknownValues: Partial<Record<keyof RuleValues, string>>;
} {
  const values: RuleValues = { ...DEFAULT_RULES };
  const unknownValues: Partial<Record<keyof RuleValues, string>> = {};

  if (row) {
    for (const key of Object.keys(RULE_KINDS) as Array<keyof RuleValues>) {
      const stored = row[key];
      const kind = RULE_KINDS[String(key)];
      let out: unknown;
      switch (kind) {
        case "number": {
          const n = Number(stored);
          out = Number.isFinite(n) ? n : DEFAULT_RULES[key] as number;
          break;
        }
        case "severity":
          out = NORMALIZERS.severity(stored) ?? DEFAULT_RULES.maxWeeklyHoursSeverity;
          if (!NORMALIZERS.severity(stored) && stored != null && stored !== "")
            unknownValues[key] = String(stored);
          break;
        case "leaveAction":
          out = NORMALIZERS.leaveAction(stored) ?? DEFAULT_RULES.pendingLeaveAction;
          if (!NORMALIZERS.leaveAction(stored) && stored != null && stored !== "")
            unknownValues[key] = String(stored);
          break;
        case "weekStart":
          out = NORMALIZERS.weekStart(stored) ?? DEFAULT_RULES.weekStartDay;
          if (!NORMALIZERS.weekStart(stored) && stored != null && stored !== "")
            unknownValues[key] = String(stored);
          break;
      }
      (values as unknown as Record<string, unknown>)[key] = out;
    }
    if (typeof row.timezone === "string" && row.timezone && row.timezone !== "any")
      values.timezone = row.timezone;
  }

  return { values, unknownValues };
}

export type RulesParseResult =
  | { ok: true; value: ParsedRules }
  | { ok: false; errors: Array<{ key: string; message: string; received?: unknown }> };

/** Validate a draft (the single write path, shared with the assistant tool). */
export function parseRulesDraft(
  draft: Partial<Record<string, unknown>>
): RulesParseResult {
  const result = rulesSchema.safeParse(draft);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      key: String(issue.path[0] ?? "rules"),
      message: issue.message,
      received: issue.path[0] != null ? (draft as Record<string, unknown>)[String(issue.path[0])] : undefined,
    })),
  };
}

/** True when a draft differs from the stored row (string compare, per field). */
export function rulesAreDirty(
  draft: Partial<Record<string, unknown>>,
  stored: Partial<Record<keyof RuleValues, unknown>> | null | undefined
): boolean {
  const { values } = normalizeRules(stored);
  return (Object.keys(DEFAULT_RULES) as Array<keyof RuleValues>).some((key) =>
    String((draft as Record<string, unknown>)[key] ?? "") !== String(values[key] ?? "")
  );
}
