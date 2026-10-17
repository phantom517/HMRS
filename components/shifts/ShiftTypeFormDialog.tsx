"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="max-h-[90vh] max-w-[500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingShift ? "Edit shift type" : "Add shift type"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => e.preventDefault()} noValidate>
          <FieldGroup className="gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Shift name</FieldLabel>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Short code (1–3 chars)</FieldLabel>
                <Input
                  type="text"
                  maxLength={3}
                  value={formData.shortCode}
                  onChange={(e) => update("shortCode", e.target.value.toUpperCase())}
                  required
                  className="uppercase"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel>Start time</FieldLabel>
                <Input type="time" value={formData.startTime} onChange={(e) => update("startTime", e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel>End time</FieldLabel>
                <Input type="time" value={formData.endTime} onChange={(e) => update("endTime", e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel>Break (min)</FieldLabel>
                <Input
                  type="number"
                  value={formData.breakDurationMinutes}
                  onChange={(e) => update("breakDurationMinutes", Number(e.target.value))}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel>Min RNs</FieldLabel>
                <Input type="number" min={0} value={formData.minimumStaffRn} onChange={(e) => update("minimumStaffRn", Number(e.target.value))} required />
              </Field>
              <Field>
                <FieldLabel>Min MDs</FieldLabel>
                <Input type="number" min={0} value={formData.minimumStaffMd} onChange={(e) => update("minimumStaffMd", Number(e.target.value))} required />
              </Field>
              <Field>
                <FieldLabel>Max per shift</FieldLabel>
                <Input type="number" value={formData.maximumStaff} onChange={(e) => update("maximumStaff", Number(e.target.value))} />
              </Field>
            </div>

            <Field>
              <FieldLabel className="flex items-center gap-2" htmlFor="crosses-midnight">
                <Checkbox
                  id="crosses-midnight"
                  checked={formData.crossesMidnight}
                  onCheckedChange={(checked) => update("crossesMidnight", checked === true)}
                />
                Overnight shift (crosses midnight)
              </FieldLabel>
            </Field>

            {/* Per-designation staffing policy — deviations from the type default */}
            <div className="pt-2">
              <div className="mb-1.5 text-[13px] font-medium text-foreground">
                Staffing policy (per role)
              </div>
              <div className="mb-1 grid grid-cols-[70px_1fr_1fr] gap-2 text-xs text-muted-foreground">
                <span>Role</span>
                <span>Minimum</span>
                <span>Max per shift</span>
              </div>
              {POLICY_ROLES.map((role) => (
                <div key={role} className="grid grid-cols-[70px_1fr_1fr] items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">
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
              <div className="mt-1 text-xs text-muted-foreground">
                Empty “Max” = no limit. “Any” fills leftover slots with any designation.
              </div>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter className="pt-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isSubmitting}>
            {editingShift ? "Save changes" : "Add shift type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ShiftTypeFormDialog };
