"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Shift Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border bg-muted px-4 py-3">
          <div className="text-sm font-medium text-foreground">
            {employee?.fullName}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {employee?.designation} &middot; {assignment.wardZone}
          </div>
          <div className="text-[13px] text-muted-foreground">{assignment.date}</div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-medium text-foreground">Status</span>
          <ToggleGroup
            value={[assignment.status]}
            onValueChange={(value) => {
              const next = value[0];
              if (next && next !== assignment.status) onStatusChange(next as AssignmentStatus);
            }}
            variant="outline"
            spacing={8}
            className="grid grid-cols-3 gap-2"
          >
            {STATUS_OPTIONS.map((st) => (
              <ToggleGroupItem
                key={st}
                value={st}
                className="rounded-xl px-3 py-2 text-[13px] capitalize"
                disabled={isSubmitting}
              >
                {st}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <DialogFooter className="justify-between border-t pt-4">
          <Button
            variant="link"
            className="text-destructive"
            disabled={isSubmitting}
            onClick={onDelete}
          >
            Delete assignment
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
