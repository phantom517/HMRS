// bun test lib/scheduling — every stored value must map to a rendered option,
// unknown values must surface instead of going blank, bounds/cross-fields hold.
import { describe, it, expect } from "bun:test";
import {
  SEVERITY_OPTIONS,
  LEAVE_ACTION_OPTIONS,
  WEEK_START_OPTIONS,
  normalizeRules,
  parseRulesDraft,
  rulesAreDirty,
  DEFAULT_RULES,
} from "../settings";
import { RULE_GROUPS } from "@/components/settings/rules-form";

describe("stored values map to a rendered option", () => {
  it("legacy spellings normalize into the option unions", () => {
    const { values, unknownValues } = normalizeRules({
      maxWeeklyHoursSeverity: "BLOCK",
      maxNightsSeverity: "WARNING",
      pendingLeaveAction: "IGNORED",
      weekStartDay: "SATURDAY",
      timezone: "UTC",
    });
    expect(SEVERITY_OPTIONS).toContain(values.maxWeeklyHoursSeverity);
    expect(SEVERITY_OPTIONS).toContain(values.maxNightsSeverity);
    expect(LEAVE_ACTION_OPTIONS).toContain(values.pendingLeaveAction);
    expect(WEEK_START_OPTIONS).toContain(values.weekStartDay);
    expect(values.weekStartDay).toBe(6);
    expect(unknownValues).toEqual({});
  });

  it("unmappable stored values are SURFACED, never silently blanked", () => {
    const { values, unknownValues } = normalizeRules({
      maxWeeklyHoursSeverity: "YES",
      pendingLeaveAction: "maybe",
      weekStartDay: "SUNDAY",
      timezone: "UTC",
    } as unknown as Record<string, unknown>);
    expect(values.maxWeeklyHoursSeverity).toBe(DEFAULT_RULES.maxWeeklyHoursSeverity);
    expect(unknownValues.maxWeeklyHoursSeverity).toBe("YES");
    expect(unknownValues.pendingLeaveAction).toBe("maybe");
  });

  it("every registry select option validates through the domain schema", () => {
    for (const group of RULE_GROUPS) {
      for (const rule of group.rules) {
        if (rule.control.kind !== "select") continue;
        for (const [opt] of rule.control.options) {
          // The form's own type coercion (RuleRow changeValue: numeric strings -> numbers).
          const value = /^\d+$/.test(opt) ? Number(opt) : opt;
          const parsed = parseRulesDraft({ ...DEFAULT_RULES, [rule.key]: value as never });
          expect(parsed.ok).toBe(true);
        }
      }
    }
  });
});

describe("draft parsing", () => {
  it("accepts the default rule set", () => {
    expect(parseRulesDraft({ ...DEFAULT_RULES }).ok).toBe(true);
  });

  it("rejects out-of-bounds numbers with the real bounds", () => {
    const r = parseRulesDraft({ ...DEFAULT_RULES, minRestHoursBetweenShifts: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toContain("Maximum 24");
  });

  it("rejects warn-at above the weekly max (cross-field)", () => {
    const r = parseRulesDraft({ ...DEFAULT_RULES, weeklyHoursCap: 40, warningHoursCap: 48 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const warn = r.errors.find((e) => e.key === "warningHoursCap");
      expect(warn?.message).toContain("must not exceed");
    }
  });

  it("rejects week starts outside the Sunday/Monday/Saturday union", () => {
    expect(parseRulesDraft({ ...DEFAULT_RULES, weekStartDay: 3 }).ok).toBe(false);
  });
});

describe("dirty tracking", () => {
  it("unchanged draft is not dirty", () => {
    expect(rulesAreDirty({ ...DEFAULT_RULES }, { ...DEFAULT_RULES })).toBe(false);
  });
  it("changed draft is dirty", () => {
    expect(rulesAreDirty({ ...DEFAULT_RULES, weeklyHoursCap: 55 }, { ...DEFAULT_RULES })).toBe(true);
  });
});
