"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEAVE_TYPE_OPTIONS = [
  { value: "lt_annual", label: "Annual vacation" },
  { value: "lt_sick", label: "Sick leave" },
  { value: "lt_cme", label: "CME" },
  { value: "lt_casual", label: "Casual day" },
];

/* ─── Adjust Leave Balance Dialog ───────────────────────────────────────── */
export function AdjustBalanceDialog({
  open,
  onOpenChange,
  employeeName,
  leaveTypeId,
  onLeaveTypeIdChange,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  leaveTypeId: string;
  onLeaveTypeIdChange: (id: string) => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] p-6 sm:p-7">
        <DialogHeader className="pb-4">
          <DialogTitle>Adjust leave balance</DialogTitle>
          <DialogDescription>
            Updating balance for <span className="font-medium text-[var(--ink)]">{employeeName}</span>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
          className="pt-2"
        >
          <FieldGroup className="gap-5">
            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Leave type</FieldLabel>
              <Select value={leaveTypeId} onValueChange={(value) => value && onLeaveTypeIdChange(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Adjustment (days)</FieldLabel>
              <Input
                type="number"
                value={String(amount)}
                onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 1 or -1"
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Reason</FieldLabel>
              <Input
                type="text"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="e.g. Carryover correction, medical board approval"
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter className="mt-7 pt-5">
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl px-5 h-10 text-sm font-medium"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            className="rounded-xl px-6 h-10 text-sm font-medium bg-[var(--honey)] text-[var(--ink)] hover:bg-[var(--honey-hover)]"
          >
            Apply adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
