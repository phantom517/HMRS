"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Adjust leave balance: {employeeName}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Leave type</FieldLabel>
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
            <Field>
              <FieldLabel>Adjustment (days)</FieldLabel>
              <Input
                type="number"
                value={String(amount)}
                onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Input type="text" value={reason} onChange={(e) => onReasonChange(e.target.value)} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter className="pt-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
