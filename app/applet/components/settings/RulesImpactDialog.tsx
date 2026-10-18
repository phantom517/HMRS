"use client";

// components/settings/RulesImpactDialog.tsx — shown before a rules save (B2):
// "This adds 3 conflicts and clears 1", listing affected people and dates.
// Nothing applies until the user confirms here.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { violationNoun, type RulesImpact } from "@/lib/scheduling/rules-impact";

export function RulesImpactDialog({
  open,
  impact,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  impact: RulesImpact | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[95vw] sm:max-w-[520px] rounded-2xl border border-[var(--ink-border-strong)] bg-[var(--paper)] p-6 sm:p-7">
        <DialogHeader className="pb-4">
          <DialogTitle>Review rule impact</DialogTitle>
          <DialogDescription className="text-sm text-[var(--ink-secondary)] mt-1">
            Checked against the current roster schedule before applying changes.
          </DialogDescription>
        </DialogHeader>

        {impact && (
          <div className="flex flex-col gap-4 text-sm text-[var(--ink)] pt-2">
            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--linen)] px-4 py-3.5">
              {impact.addedCount === 0 && impact.clearedCount === 0 ? (
                <span>No changes to existing conflicts.</span>
              ) : (
                <span>
                  This adds{" "}
                  <strong className="font-semibold text-critical">{impact.addedCount}</strong>{" "}
                  {summarize(impact.addedByCode)} and clears{" "}
                  <strong className="font-semibold text-green-700">{impact.clearedCount}</strong>{" "}
                  {summarize(impact.clearedByCode)}.
                </span>
              )}
            </div>

            {impact.affectedPeople.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">Affects staff</div>
                <div className="text-sm text-[var(--ink-secondary)]">
                  {impact.affectedPeople.map((p) => p.name).join(", ")}
                </div>
              </div>
            )}

            {impact.affectedDates.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">Affected dates</div>
                <div className="text-sm text-[var(--ink-secondary)]">
                  {impact.affectedDates.join(", ")}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-[var(--ink-border)]">
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl px-5 h-10 text-sm font-medium"
            disabled={busy}
            onClick={onCancel}
          >
            Not now
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl px-6 h-10 text-sm font-medium bg-[var(--honey)] text-[var(--ink)] hover:bg-[var(--honey-hover)]"
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function summarize(byCode: Record<string, number>): string {
  const parts = Object.entries(byCode).map(
    ([code, n]) => `${n} ${violationNoun(code)}`
  );
  return parts.length === 0 ? "conflicts" : parts.join(" and ");
}
