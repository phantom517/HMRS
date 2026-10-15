// components/settings/rules-form.ts — UI-ONLY layout for the rules form:
// group, label, helper text, unit suffix and control shape, keyed by the
// domain rule keys in lib/scheduling/settings.ts. DATA ONLY — no react,
// no imports from actions or services. Option lists come from the domain
// module so the <select> options and the zod enum can never diverge.
import {
  LEAVE_ACTION_OPTIONS,
  LEAVE_ACTION_LABELS,
  SEVERITY_OPTIONS,
  SEVERITY_LABELS,
  WEEK_START_OPTIONS,
  WEEK_START_LABELS,
  RULE_BOUNDS,
  type RuleValues,
} from "@/lib/scheduling/settings";

export type RuleControl =
  | { kind: "number"; min: number; max: number; unit: string; inputWidthPx: number }
  | { kind: "select"; labelFor: (v: string) => string; options: Array<[string, string]>; widthPx: number };

export interface RuleDefinition {
  key: keyof RuleValues;
  label: string;
  helper?: string;
  control: RuleControl;
  /** Rows the engine does not implement yet are never shown (no dead controls). */
  hidden?: boolean;
}

export const RULE_GROUPS: Array<{ id: string; heading: string; rules: RuleDefinition[] }> = [
  {
    id: "rest",
    heading: "Rest",
    rules: [
      {
        key: "minRestHoursBetweenShifts",
        label: "Minimum rest between shifts",
        helper: "Hours between the end of one shift and the start of the next.",
        control: {
          kind: "number",
          min: RULE_BOUNDS.minRestHoursBetweenShifts.min,
          max: RULE_BOUNDS.minRestHoursBetweenShifts.max,
          unit: "h",
          inputWidthPx: 96,
        },
      },
      {
        key: "pendingLeaveAction",
        label: "Pending leave requests",
        helper: "How scheduling treats shifts that fall on a pending request.",
        control: {
          kind: "select",
          options: LEAVE_ACTION_OPTIONS.map((o) => [o, LEAVE_ACTION_LABELS[o]]),
          labelFor: (v) => LEAVE_ACTION_LABELS[v as keyof typeof LEAVE_ACTION_LABELS] ?? v,
          widthPx: 160,
        },
      },
    ],
  },
  {
    id: "limits",
    heading: "Limits",
    rules: [
      {
        key: "consecutiveShiftsCap",
        label: "Max days in a row",
        helper: "Working days allowed before a rest day is required.",
        control: {
          kind: "number",
          min: RULE_BOUNDS.consecutiveShiftsCap.min,
          max: RULE_BOUNDS.consecutiveShiftsCap.max,
          unit: "days",
          inputWidthPx: 96,
        },
      },
      {
        key: "maxNightsPerMonth",
        label: "Max nights per month",
        helper: "Night shifts allowed in one month.",
        control: {
          kind: "number",
          min: RULE_BOUNDS.maxNightsPerMonth.min,
          max: RULE_BOUNDS.maxNightsPerMonth.max,
          unit: "shifts",
          inputWidthPx: 96,
        },
      },
      {
        key: "weeklyHoursCap",
        label: "Max hours per week",
        helper: "Paid hours allowed in one week.",
        control: {
          kind: "number",
          min: RULE_BOUNDS.weeklyHoursCap.min,
          max: RULE_BOUNDS.weeklyHoursCap.max,
          unit: "h",
          inputWidthPx: 96,
        },
      },
      {
        key: "warningHoursCap",
        label: "Warn at",
        helper: "Show a warning when weekly hours pass this. Must not exceed the max.",
        control: {
          kind: "number",
          min: RULE_BOUNDS.warningHoursCap.min,
          max: RULE_BOUNDS.warningHoursCap.max,
          unit: "h",
          inputWidthPx: 96,
        },
      },
      {
        key: "maxWeeklyHoursSeverity",
        label: "When weekly hours go over",
        control: {
          kind: "select",
          options: SEVERITY_OPTIONS.map((o) => [o, SEVERITY_LABELS[o]]),
          labelFor: (v) => SEVERITY_LABELS[v as keyof typeof SEVERITY_LABELS] ?? v,
          widthPx: 160,
        },
      },
      {
        key: "maxNightsSeverity",
        label: "When night shifts go over",
        control: {
          kind: "select",
          options: SEVERITY_OPTIONS.map((o) => [o, SEVERITY_LABELS[o]]),
          labelFor: (v) => SEVERITY_LABELS[v as keyof typeof SEVERITY_LABELS] ?? v,
          widthPx: 160,
        },
      },
    ],
  },
  {
    id: "calendar",
    heading: "Calendar",
    rules: [
      {
        key: "weekStartDay",
        label: "Week starts on",
        control: {
          kind: "select",
          options: WEEK_START_OPTIONS.map((o) => [String(o), WEEK_START_LABELS[o]]),
          labelFor: (v) => WEEK_START_LABELS[Number(v) as keyof typeof WEEK_START_LABELS] ?? v,
          widthPx: 160,
        },
      },
    ],
  },
  {
    id: "lock",
    heading: "Lock",
    rules: [
      {
        key: "rosterLockHoursAhead",
        label: "Roster lock",
        helper: "Shifts starting within this window can't be edited without override permission.",
        control: {
          kind: "number",
          min: RULE_BOUNDS.rosterLockHoursAhead.min,
          max: RULE_BOUNDS.rosterLockHoursAhead.max,
          unit: "h",
          inputWidthPx: 96,
        },
        // The engine does not read this yet — the engine keys on
        // rosterLockHoursAhead place. Hidden until it is implemented so we
        // never ship a control that does nothing.
        hidden: true,
      },
    ],
  },
];

/** Flat list of every rendered rule (groups in order, hidden excluded). */
export function visibleRules(): Array<RuleDefinition & { group: string }> {
  return RULE_GROUPS.flatMap((group) =>
    group.rules
      .filter((r) => !r.hidden)
      .map((r) => ({ ...r, group: group.heading }))
  );
}
