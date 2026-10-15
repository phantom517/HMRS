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
      <DialogContent className="max-w-md rounded-xl border border-(--ink-border) bg-(--paper) p-6">
        <DialogHeader>
          <DialogTitle>Review the effect of these rules</DialogTitle>
          <DialogDescription className="text-[13px] text-(--ink-secondary)">
            Checked against the current roster before anything is saved.
          </DialogDescription>
      </DialogHeader>
        {impact && (
          <div className="flex flex-col gap-3 text-[14px] text-(--ink)">
            <div className="rounded-[10px] bg-(--linen) px-4 py-3">
              {impact.addedCount === 0 && impact.clearedCount === 0 ? (
                <span>No changes to existing conflicts.</span>
              ) : (
                <span>
                  This adds{" "}
                  <strong className="font-semibold">{impact.addedCount}</strong>{" "}
                  {summarize(impact.addedByCode)} and clears{" "}
                  <strong className="font-semibold">{impact.clearedCount}</strong>{" "}
                  {summarize(impact.clearedByCode)}.
                </span>
              )}
            </div>
            {impact.affectedPeople.length > 0 && (
              <div>
                <div className="text-[13px] font-medium text-(--ink-secondary)">Affects</div>
                <div className="text-[13px] text-(--ink-secondary)">
                  {impact.affectedPeople.map((p) => p.name).join(", ")}
                </div>
              </div>
            )}
            {impact.affectedDates.length > 0 && (
              <div>
                <div className="text-[13px] font-medium text-(--ink-secondary)">Dates</div>
                <div className="text-[13px] text-(--ink-secondary)">
                  {impact.affectedDates.join(", ")}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-3">
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={busy}
            onClick={onCancel}
          >
            Not now
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl text-[15px] zbtn zbtn-primary"
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
