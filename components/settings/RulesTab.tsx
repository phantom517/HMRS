"use client";

// components/settings/RulesTab.tsx — the Rules tab (B2). One paper panel,
// 24px padding, groups looped from the rules-form registry (adding a rule =
// one entry in the domain file + one in the registry + one test — no layout
// code changes). Save opens the impact dialog first; nothing is applied
// silently. Audit logging with previous/new values stays in the action.
import { useCallback, useMemo, useState } from "react";
import { RULE_GROUPS } from "@/components/settings/rules-form";
import { RuleRow } from "@/components/settings/RuleRow";
import { RulesImpactDialog } from "@/components/settings/RulesImpactDialog";
import { Button } from "@/components/ui/button";
import {
  normalizeRules,
  parseRulesDraft,
  rulesAreDirty,
  type RuleValues,
} from "@/lib/scheduling/settings";
import { previewRulesImpactAction, updateDepartmentSettingsAction } from "@/lib/actions/shifts";
import type { RulesImpact } from "@/lib/scheduling/rules-impact";

type Draft = Record<string, string | number>;

export function RulesTab({
  settings,
  isSuperuser,
}: {
  settings: Partial<Record<keyof RuleValues, unknown>> | null;
  isSuperuser: boolean;
}) {
  const { values: stored, unknownValues } = useMemo(() => normalizeRules(settings), [settings]);

  const [draft, setDraft] = useState<Draft>(() => ({ ...stored }) as Draft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<RulesImpact | null>(null);

  const dirty = useMemo(
    () => rulesAreDirty(draft as Partial<Record<string, unknown>>, settings),
    [draft, settings]
  );

  // Stable handlers (rows are memoized; this keeps keystrokes re-render
  // confined to the changed row).
  const changeNumber = useCallback((key: string, v: number) => {
    setDraft((prev) => {
      if (Number(prev[key]) === v) return prev;
      return { ...prev, [key]: v };
    });
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined as unknown as string } : prev));
  }, []);

  const changeValue = useCallback((key: string, v: string) => {
    // Selects: parse back to the domain type (numbers for weekStartDay).
    setDraft((prev) => ({ ...prev, [key]: /^\d+$/.test(v) ? Number(v) : v }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined as unknown as string } : prev));
  }, []);

  const discard = useCallback(() => {
    setDraft({ ...stored } as Draft);
    setFieldErrors({});
    setSaveError(null);
  }, [stored]);

  async function beginSave() {
    setSaveError(null);
    const parsed = parseRulesDraft(draft);
    if (!parsed.ok) {
      const errs: Record<string, string> = {};
      for (const e of parsed.errors) errs[e.key] = e.message;
      setFieldErrors(errs);
      setSaveError("Fix the highlighted fields before saving.");
      return;
    }
    setBusy(true);
    try {
      const result = await previewRulesImpactAction(draft as never);
      setImpact(result);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSave() {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await updateDepartmentSettingsAction(draft);
      setImpact(null);
      // Keep the server's canonical row.
      setDraft({ ...res.settings } as Draft);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {saveError && (
        <div role="alert" className="rounded-xl border border-(--ink-border) bg-(--critical-bg) px-4 py-3 text-[14px] text-(--critical-text)">
          {saveError}
        </div>
      )}
      <div className="relative overflow-hidden rounded-xl border border-(--ink-border) bg-(--paper)">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void beginSave();
          }}
          className="flex flex-col p-6 pb-0"
        >
          {RULE_GROUPS.filter((g) => !g.rules.every((r) => r.hidden)).map((group, gi) => (
            <section key={group.id} className={gi > 0 ? "mt-6" : undefined}>
              <div className="pb-2 text-[13px] font-medium text-(--ink-tertiary)">{group.heading}</div>
              <div>
                {group.rules
                  .filter((r) => !r.hidden)
                  .map((rule) => (
                    <RuleRow
                      key={rule.key}
                      ruleKey={rule.key}
                      label={rule.label}
                      helper={rule.helper}
                      kind={rule.control.kind}
                      value={String(draft[rule.key] ?? "")}
                      unit={rule.control.kind === "number" ? rule.control.unit : undefined}
                      min={rule.control.kind === "number" ? rule.control.min : undefined}
                      max={rule.control.kind === "number" ? rule.control.max : undefined}
                      widthPx={rule.control.kind === "select" ? rule.control.widthPx : undefined}
                      options={rule.control.kind === "select" ? rule.control.options : undefined}
                      // Unknown stored select value -> inline error, never blank.
                      error={
                        fieldErrors[rule.key] ??
                        (rule.control.kind === "select" && unknownValues[rule.key as keyof RuleValues]
                          ? `Unknown stored value (${String(unknownValues[rule.key as keyof RuleValues])}) — pick one to fix it.`
                          : null)
                      }
                      disabled={!isSuperuser}
                      onChange={changeValue}
                      onNumberChange={changeNumber}
                    />
                  ))}
              </div>
            </section>
          ))}

          {dirty && (
            <div className="sticky bottom-0 -mx-6 mt-4 flex items-center justify-between gap-3 rounded-b-xl border-t border-(--ink-border) bg-(--paper) px-6 py-3">
              <span className="text-[13px] text-(--ink-secondary)">Unsaved changes to scheduling rules.</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={discard}
                  className="h-8 px-3 text-[13px] font-medium text-(--ink-secondary) hover:bg-(--linen) hover:text-(--ink)"
                >
                  Discard
                </Button>
                <Button type="submit" disabled={busy} className="rounded-xl text-[15px] zbtn zbtn-primary">
                  Save changes
                </Button>
              </div>
            </div>
          )}
          {/* keeps the section's last row border tidy above the footer */}
          <div className="h-6" aria-hidden />
        </form>
      </div>

      <RulesImpactDialog
        open={impact != null}
        impact={impact}
        busy={busy}
        onConfirm={confirmSave}
        onCancel={() => setImpact(null)}
      />
    </div>
  );
}

