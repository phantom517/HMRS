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
    <div className="border-b border-[var(--ink-border)] pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
      {children}
    </div>
  );
}

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
    <Field className="gap-1.5">
      <FieldLabel className="text-xs font-semibold text-[var(--ink)]">{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="w-full h-10 px-3.5 text-sm rounded-xl border border-[var(--ink-border-strong)] bg-[var(--paper)]">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
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
    <Field className="gap-1.5">
      <FieldLabel className="text-xs font-semibold text-[var(--ink)]">{label}</FieldLabel>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 px-3.5 text-sm rounded-xl border border-[var(--ink-border-strong)] bg-[var(--paper)]"
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
      <DialogContent className="max-h-[calc(100vh-48px)] w-[95vw] sm:max-w-[700px] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold tracking-tight text-[var(--ink)]">
            {isAdd ? "Register new employee" : `Edit profile: ${editingName}`}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--ink-secondary)] mt-1">
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
          className="pt-2"
        >
          <FieldGroup className="gap-7">
            {/* ── Section: Role & Placement ── */}
            <section className="space-y-3.5">
              <SectionLabel>Role &amp; placement</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
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
                <FieldDescription className="mt-2 text-xs text-[var(--ink-secondary)]">
                  No roles or units configured yet — add them under Settings → Units / Roles.
                </FieldDescription>
              )}
            </section>

            {/* ── Section: Identity ── */}
            <section className="space-y-3.5">
              <SectionLabel>Identity</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="sm:col-span-2">
                  <LabeledInput
                    label="Full name"
                    value={formData.fullName}
                    onChange={(v) => onFormDataChange({ ...formData, fullName: v })}
                    placeholder="e.g. Dr. John Doe, MD"
                  />
                </div>
                <LabeledInput
                  label="Employee ID"
                  value={formData.employeeId}
                  disabled={!isAdd}
                  onChange={(v) => onFormDataChange({ ...formData, employeeId: v })}
                />
                <LabeledInput
                  label="Date joined"
                  type="date"
                  value={formData.dateJoined}
                  onChange={(v) => onFormDataChange({ ...formData, dateJoined: v })}
                />
              </div>
            </section>

            {/* ── Section: Contact ── */}
            <section className="space-y-3.5">
              <SectionLabel>Contact</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
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
              <section className="space-y-3.5">
                <SectionLabel>Credentials</SectionLabel>
                <div>
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
              <section className="space-y-3.5">
                <SectionLabel>Scheduling exceptions (optional)</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 rounded-2xl border border-[var(--ink-border)] bg-[var(--linen)]/60 p-4 sm:p-5">
                  <LabeledInput
                    label="Max hours per week (blank = department default)"
                    type="number"
                    value={exceptionFields.maxHoursPerWeek}
                    onChange={(v) => onExceptionFieldsChange({ ...exceptionFields, maxHoursPerWeek: v })}
                  />
                  <Field className="gap-2 justify-center">
                    <FieldLabel className="text-xs font-semibold text-[var(--ink)]">Night shifts</FieldLabel>
                    <div className="flex items-center gap-2.5 text-sm text-[var(--ink)] mt-1">
                      <Checkbox
                        id="can-work-nights"
                        checked={exceptionFields.canWorkNights}
                        onCheckedChange={(checked) =>
                          onExceptionFieldsChange({ ...exceptionFields, canWorkNights: checked === true })
                        }
                      />
                      <label htmlFor="can-work-nights" className="cursor-pointer select-none">
                        Allowed to work nights
                      </label>
                    </div>
                  </Field>
                </div>
              </section>
            )}
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
            className="rounded-xl px-6 h-10 text-sm font-medium bg-[var(--honey)] text-[var(--ink)] hover:bg-[var(--honey-hover)]"
          >
            {isAdd ? "Add employee" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
