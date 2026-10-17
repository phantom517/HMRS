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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EmployeeFormData = {
  employeeId: string;
  fullName: string;
  designation: string;
  unit: string;
  phoneNumber: string;
  email: string;
  dateJoined: string;
  credentials: string;
};

export type EmployeeExceptionFields = {
  maxHoursPerWeek: string;
  canWorkNights: boolean;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b pb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

/** Role/unit select that keeps the current value selectable even when it is no
 *  longer in the admin dictionary (e.g. renamed after the employee was created). */
function LabeledSelect({
  label,
  value,
  onChange,
  options,
  extraOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  extraOption?: string;
}) {
  const list = [...options];
  if (extraOption && !list.some((o) => o.value === extraOption)) {
    list.push({ value: extraOption, label: `${extraOption} (not in list)` });
  }
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {list.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

/* ─── Add / Edit Clinician Dialog ───────────────────────────────────────── */

export function EmployeeFormDialog({
  open,
  onOpenChange,
  isAdd,
  editingName,
  formData,
  onFormDataChange,
  roleOptions,
  unitOptions,
  exceptionFields,
  onExceptionFieldsChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdd: boolean;
  editingName?: string;
  formData: EmployeeFormData;
  onFormDataChange: (next: EmployeeFormData) => void;
  roleOptions: Array<any>;
  unitOptions: Array<any>;
  exceptionFields?: EmployeeExceptionFields;
  onExceptionFieldsChange?: (next: EmployeeExceptionFields) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-h-[calc(100vh-48px)] max-w-[720px] overflow-y-auto">
        <DialogHeader className="rounded-t-lg bg-muted">
          <DialogTitle className="text-xl">
            {isAdd ? "Register new employee" : `Edit profile: ${editingName}`}
          </DialogTitle>
          <DialogDescription>
            {isAdd
              ? "Add a staff member to the ED roster. Role and unit are selected from the department lists."
              : "Update this employee's details. Changes take effect immediately."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
        >
          <FieldGroup className="gap-6">
            <section>
              <SectionLabel>Role &amp; placement</SectionLabel>
              <div className="mt-2.5 grid grid-cols-2 gap-4">
                <LabeledSelect
                  label="Role / designation"
                  value={formData.designation}
                  onChange={(v) => onFormDataChange({ ...formData, designation: v })}
                  options={roleOptions.map((r) => ({
                    value: r.name,
                    label: r.description ? `${r.name} — ${r.description}` : r.name,
                  }))}
                  extraOption={formData.designation}
                />
                <LabeledSelect
                  label="Unit"
                  value={formData.unit}
                  onChange={(v) => onFormDataChange({ ...formData, unit: v })}
                  options={unitOptions.map((u) => ({
                    value: u.name,
                    label: u.description ? `${u.name} — ${u.description}` : u.name,
                  }))}
                  extraOption={formData.unit}
                />
              </div>
              {(roleOptions.length === 0 || unitOptions.length === 0) && (
                <FieldDescription className="mt-2">
                  No roles or units configured yet — add them under Settings → Units / Roles.
                </FieldDescription>
              )}
            </section>

            <section>
              <SectionLabel>Identity</SectionLabel>
              <div className="mt-2.5 grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Employee ID"
                  value={formData.employeeId}
                  disabled={!isAdd}
                  onChange={(v) => onFormDataChange({ ...formData, employeeId: v })}
                />
                <LabeledInput
                  label="Full name"
                  value={formData.fullName}
                  onChange={(v) => onFormDataChange({ ...formData, fullName: v })}
                  placeholder="e.g. Dr. John Doe, MD"
                />
                <LabeledInput
                  label="Date joined"
                  type="date"
                  value={formData.dateJoined}
                  onChange={(v) => onFormDataChange({ ...formData, dateJoined: v })}
                />
              </div>
            </section>

            <section>
              <SectionLabel>Contact</SectionLabel>
              <div className="mt-2.5 grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Hospital email"
                  type="email"
                  value={formData.email}
                  onChange={(v) => onFormDataChange({ ...formData, email: v })}
                  placeholder="name@hospital.org"
                />
                <LabeledInput
                  label="Phone number"
                  value={formData.phoneNumber}
                  onChange={(v) => onFormDataChange({ ...formData, phoneNumber: v })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </section>

            {/* ── Section: Credentials (create only) ── */}
            {isAdd && (
              <section>
                <SectionLabel>Credentials</SectionLabel>
                <div className="mt-2.5">
                  <LabeledInput
                    label="Certifications (comma-separated)"
                    value={formData.credentials}
                    onChange={(v) => onFormDataChange({ ...formData, credentials: v })}
                    placeholder="e.g. ACLS, TNCC, BLS"
                  />
                </div>
              </section>
            )}

            {/* ── Section: Scheduling exceptions (edit only) ── */}
            {!isAdd && exceptionFields && onExceptionFieldsChange && (
              <section>
                <SectionLabel>Scheduling exceptions (optional)</SectionLabel>
                <div className="mt-2.5 grid grid-cols-2 gap-4 rounded-xl bg-muted p-4">
                  <LabeledInput
                    label="Max hours per week (blank = department default)"
                    type="number"
                    value={exceptionFields.maxHoursPerWeek}
                    onChange={(v) => onExceptionFieldsChange({ ...exceptionFields, maxHoursPerWeek: v })}
                  />
                  <Field>
                    <FieldLabel>Night shifts</FieldLabel>
                    <div className="flex items-center gap-2 text-[13px]">
                      <Checkbox
                        id="can-work-nights"
                        checked={exceptionFields.canWorkNights}
                        onCheckedChange={(checked) =>
                          onExceptionFieldsChange({ ...exceptionFields, canWorkNights: checked === true })
                        }
                      />
                      <span>Allowed to work nights</span>
                    </div>
                  </Field>
                </div>
              </section>
            )}
          </FieldGroup>
        </form>

        <DialogFooter className="pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            {isAdd ? "Add employee" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
