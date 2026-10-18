"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export type ShiftTypeFormData = {
  name: string;
  shortCode: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  minimumStaffRn: number;
  minimumStaffMd: number;
  maximumStaff: number;
  crossesMidnight: boolean;
  traumaPremium: boolean;
};

export type ShiftTypePolicyRows = Record<string, { min: number; max: string }>;

const POLICY_ROLES = ["RN", "MD", "Tech", "any"] as const;

/* ─── Create / Edit Shift Type Modal ────────────────────────────────────── */
function ShiftTypeFormDialog(
  {
    open,
    onOpenChange,
    editingShift,
    formData,
    onFormDataChange,
    policyRows,
    onPolicyRowsChange,
    isSubmitting,
    onSave,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingShift: any;
    formData: ShiftTypeFormData;
    onFormDataChange: (next: ShiftTypeFormData) => void;
    policyRows: ShiftTypePolicyRows;
    onPolicyRowsChange: (next: ShiftTypePolicyRows) => void;
    isSubmitting: boolean;
    onSave: () => void;
  }
) {
  function update<K extends keyof ShiftTypeFormData>(key: K, value: ShiftTypeFormData[K]) {
    onFormDataChange({ ...formData, [key]: value });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-h-[90vh] w-[95vw] sm:max-w-[620px] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="pb-4">
          <DialogTitle>{editingShift ? "Edit shift type" : "Add shift type"}</DialogTitle>
          <DialogDescription>
            Configure timings, staffing minimums, and designation quotas for this shift pattern.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => e.preventDefault()} noValidate className="pt-2">
          <FieldGroup className="gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Shift name</FieldLabel>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Morning Shift"
                  required
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Short code (1–3 chars)</FieldLabel>
                <Input
                  type="text"
                  maxLength={3}
                  value={formData.shortCode}
                  onChange={(e) => update("shortCode", e.target.value.toUpperCase())}
                  placeholder="e.g. M"
                  required
                  className="uppercase font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Start time</FieldLabel>
                <Input type="time" value={formData.startTime} onChange={(e) => update("startTime", e.target.value)} required />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">End time</FieldLabel>
                <Input type="time" value={formData.endTime} onChange={(e) => update("endTime", e.target.value)} required />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Break (min)</FieldLabel>
                <Input
                  type="number"
                  value={formData.breakDurationMinutes}
                  onChange={(e) => update("breakDurationMinutes", Number(e.target.value))}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Min RNs</FieldLabel>
                <Input type="number" min={0} value={formData.minimumStaffRn} onChange={(e) => update("minimumStaffRn", Number(e.target.value))} required />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Min MDs</FieldLabel>
                <Input type="number" min={0} value={formData.minimumStaffMd} onChange={(e) => update("minimumStaffMd", Number(e.target.value))} required />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Max per shift</FieldLabel>
                <Input type="number" value={formData.maximumStaff} onChange={(e) => update("maximumStaff", Number(e.target.value))} />
              </Field>
            </div>

            <Field className="pt-1">
              <label className="flex items-center gap-2.5 text-sm font-medium text-[var(--ink)] cursor-pointer select-none">
                <Checkbox
                  id="crosses-midnight"
                  checked={formData.crossesMidnight}
                  onCheckedChange={(checked) => update("crossesMidnight", checked === true)}
                />
                Overnight shift (crosses midnight)
              </label>
            </Field>

            {/* Per-designation staffing policy — deviations from the type default */}
            <div className="rounded-2xl border border-[var(--ink-border)] bg-[var(--linen)]/50 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col gap-0.5">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  Staffing policy (per role)
                </div>
                <div className="text-xs text-[var(--ink-secondary)]">
                  Deviations from shift defaults. Empty &ldquo;Max&rdquo; = no limit. &ldquo;Any&rdquo; fills leftover slots.
                </div>
              </div>

              <div className="grid grid-cols-[80px_1fr_1fr] gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] pt-1 pb-1 border-b border-[var(--ink-border)]">
                <span>Role</span>
                <span>Minimum</span>
                <span>Max per shift</span>
              </div>

              <div className="space-y-2.5">
                {POLICY_ROLES.map((role) => (
                  <div key={role} className="grid grid-cols-[80px_1fr_1fr] items-center gap-3">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {role === "any" ? "Any" : role}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={policyRows[role]?.min ?? 0}
                      onChange={(e) =>
                        onPolicyRowsChange({
                          ...policyRows,
                          [role]: { ...policyRows[role], min: Number(e.target.value) || 0 },
                        })
                      }
                      className="h-9"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={policyRows[role]?.max ?? ""}
                      onChange={(e) =>
                        onPolicyRowsChange({
                          ...policyRows,
                          [role]: { ...policyRows[role], max: e.target.value },
                        })
                      }
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter className="mt-8 pt-5">
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
            disabled={isSubmitting}
            className="rounded-xl px-6 h-10 text-sm font-medium bg-[var(--honey)] text-[var(--ink)] hover:bg-[var(--honey-hover)]"
          >
            {editingShift ? "Save changes" : "Add shift type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ShiftTypeFormDialog };
