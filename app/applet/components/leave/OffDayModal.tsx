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

/* ─── Schedule Day Off Dialog ───────────────────────────────────────────── */
export function OffDayModal({
  open,
  onOpenChange,
  employees,
  employeeId,
  onEmployeeIdChange,
  date,
  onDateChange,
  reason,
  onReasonChange,
  isSubmitting,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<any>;
  employeeId: string;
  onEmployeeIdChange: (id: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  isSubmitting: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] p-6 sm:p-7">
        <DialogHeader className="pb-4">
          <DialogTitle>Schedule day off</DialogTitle>
          <DialogDescription>
            Record an approved planned day off or roster exception for a staff member.
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
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Select employee</FieldLabel>
              <Select
                required
                value={employeeId}
                onValueChange={(value) => onEmployeeIdChange(value ?? "")}
              >
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

            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Date</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                required
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Reason / Note (optional)</FieldLabel>
              <Input
                type="text"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="e.g. Conference attendance, personal day"
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
            disabled={isSubmitting || !employeeId || !date}
            className="rounded-xl px-6 h-10 text-sm font-medium bg-[var(--honey)] text-[var(--ink)] hover:bg-[var(--honey-hover)]"
          >
            {isSubmitting ? "Saving…" : "Save day off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
