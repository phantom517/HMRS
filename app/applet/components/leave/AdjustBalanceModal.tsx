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
      <DialogContent className="w-[95vw] sm:max-w-[500px] p-6 sm:p-7">
        <DialogHeader className="pb-4">
          <DialogTitle>Adjust leave balance</DialogTitle>
          <DialogDescription>
            Directly credit or debit an employee&apos;s allocated balance. Logged with audit trail.
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
            <Field className="gap-1.5" data-invalid={!employeeId ? true : undefined}>
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Employee</FieldLabel>
              <Select value={employeeId} onValueChange={(value) => onEmployeeIdChange(value ?? "")}>
                <SelectTrigger aria-invalid={!employeeId || undefined} className="w-full">
                  <SelectValue placeholder="— Choose staff member —" />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Leave type</FieldLabel>
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

              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Days (+/−)</FieldLabel>
                <Input
                  type="number"
                  step="0.5"
                  value={amount}
                  onChange={(e) => onAmountChange(Number(e.target.value))}
                  required
                  placeholder="+1.0 or -0.5"
                />
              </Field>
            </div>

            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Reason for adjustment</FieldLabel>
              <Input
                type="text"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                required
                placeholder="e.g. Approved lieu days compensation"
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
            disabled={isSubmitting || !employeeId}
            className="rounded-xl px-6 h-10 text-sm font-medium bg-[var(--honey)] text-[var(--ink)] hover:bg-[var(--honey-hover)]"
          >
            {isSubmitting ? "Saving…" : "Apply & log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
