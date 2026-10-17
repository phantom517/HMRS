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
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Schedule day off</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} noValidate>
          <FieldGroup>
            <Field data-invalid={!employeeId ? true : undefined}>
              <FieldLabel>Select employee</FieldLabel>
              <Select
                required
                value={employeeId}
                onValueChange={(value) => onEmployeeIdChange(value ?? "")}
              >
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
            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Input
                type="text"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter className="pt-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isSubmitting || !employeeId || !date}>
            Save day off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
