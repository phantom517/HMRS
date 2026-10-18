"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const STATUS_OPTIONS = ["assigned", "completed", "cancelled"] as const;
export type AssignmentStatus = (typeof STATUS_OPTIONS)[number];

/* ─── Selected Assignment Detail Dialog ─────────────────────────────────── */
export function AssignmentDetailDialog({
  assignment,
  onClose,
  employee,
  onStatusChange,
  onDelete,
  isSubmitting,
}: {
  assignment: any | null;
  onClose: () => void;
  employee?: any;
  onStatusChange: (status: AssignmentStatus) => void;
  onDelete: () => void;
  isSubmitting: boolean;
}) {
  if (!assignment) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] p-6 sm:p-7">
        <DialogHeader className="pb-4">
          <DialogTitle>Shift assignment</DialogTitle>
          <DialogDescription>
            View or update the current shift assignment status and roster placement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-2xl border border-[var(--ink-border)] bg-[var(--linen)]/60 p-4 sm:p-5">
            <div className="text-base font-semibold text-[var(--ink)]">
              {employee?.fullName}
            </div>
            <div className="mt-1 text-sm text-[var(--ink-secondary)]">
              {employee?.designation} &middot; <span className="font-medium text-[var(--ink)]">{assignment.wardZone}</span>
            </div>
            <div className="mt-2 text-xs font-medium text-[var(--ink-tertiary)] uppercase tracking-wider">
              {assignment.date}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
              Assignment status
            </span>
            <ToggleGroup
              value={[assignment.status]}
              onValueChange={(value) => {
                const next = value[0];
                if (next && next !== assignment.status) onStatusChange(next as AssignmentStatus);
              }}
              variant="outline"
              spacing={8}
              className="grid grid-cols-3 gap-2.5"
            >
              {STATUS_OPTIONS.map((st) => (
                <ToggleGroupItem
                  key={st}
                  value={st}
                  className="rounded-xl h-10 px-3 text-sm capitalize font-medium transition-all"
                  disabled={isSubmitting}
                >
                  {st}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter className="mt-7 pt-5 justify-between flex-row">
          <Button
            variant="link"
            className="text-destructive hover:text-destructive/80 p-0 h-auto text-sm"
            disabled={isSubmitting}
            onClick={onDelete}
          >
            Delete assignment
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl px-5 h-10 text-sm font-medium"
            onClick={onClose}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
