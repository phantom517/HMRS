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

/* ─── Adjust Balance Dialog (Superuser) ─────────────────────────────────── */

export function AdjustBalanceModal({
  open,
  onOpenChange,
  employees,
  leaveTypes,
  employeeId,
  onEmployeeIdChange,
  leaveTypeId,
  onLeaveTypeIdChange,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  isSubmitting,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<any>;
  leaveTypes: Array<any>;
  employeeId: string;
  onEmployeeIdChange: (id: string) => void;
  leaveTypeId: string;
  onLeaveTypeIdChange: (id: string) => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  isSubmitting: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Adjust leave balance</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} noValidate>
          <FieldGroup>
            <Field data-invalid={!employeeId ? true : undefined}>
              <FieldLabel>Employee</FieldLabel>
              <Select value={employeeId} onValueChange={(value) => onEmployeeIdChange(value ?? "")}>
                <SelectTrigger aria-invalid={!employeeId || undefined} className="w-full">
                  <SelectValue placeholder="— choose staff —" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName} ({e.designation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Leave type</FieldLabel>
                <Select value={leaveTypeId} onValueChange={(value) => onLeaveTypeIdChange(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Days (+/−)</FieldLabel>
                <Input
                  type="number"
                  step="0.5"
                  value={amount}
                  onChange={(e) => onAmountChange(Number(e.target.value))}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Input
                type="text"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter className="pt-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isSubmitting || !employeeId}>
            Apply &amp; log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
