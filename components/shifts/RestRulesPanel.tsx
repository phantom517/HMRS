"use client";

import { Check } from "lucide-react";
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

export type RestRuleEditFields = {
  restHours: number;
  maxConsecutiveDays: number;
  maxWeeklyHours: number;
  maxNights: number;
  weekStartDay: number;
  timezone: string;
  pendingLeaveAction: "warn" | "ignore" | "block";
  maxWeeklyHoursSeverity: "warn" | "block";
  maxNightsSeverity: "warn" | "block";
};

const TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Dubai",
  "UTC",
];

/* ─── SECTION 1: Rest rules (one quiet panel, real shared values) ───────── */

export function RestRulesPanel({
  settings,
  isEditing,
  editFields,
  onEditFieldsChange,
  isSubmitting,
  canManage,
  onToggleEdit,
}: {
  settings: any;
  isEditing: boolean;
  editFields: RestRuleEditFields;
  onEditFieldsChange: (next: RestRuleEditFields) => void;
  isSubmitting: boolean;
  canManage: boolean;
  /** Open the inline editor, or save when it is already open. */
  onToggleEdit: () => void;
}) {
  return (
    <div className="mb-8 rounded-xl border bg-background p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-medium text-foreground">Rest rules</h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Used to flag conflicts on the roster.
          </p>
        </div>
        {canManage && (
          <Button variant="ghost" onClick={onToggleEdit} disabled={isSubmitting}>
            {isEditing ? (
              <>
                <Check data-icon="inline-start" /> Save
              </>
            ) : (
              "Edit"
            )}
          </Button>
        )}
      </div>

      <FieldGroup className="mt-5 grid grid-cols-3 gap-6">
        {isEditing ? (
          <>
            <RuleEditor label="Minimum rest between shifts" unit="h" value={editFields.restHours} onChange={(v) => onEditFieldsChange({ ...editFields, restHours: v })} />
            <RuleEditor label="Maximum days in a row" unit="days" value={editFields.maxConsecutiveDays} onChange={(v) => onEditFieldsChange({ ...editFields, maxConsecutiveDays: v })} />
            <RuleEditor label="Maximum nights per month" unit="nights" value={editFields.maxNights} onChange={(v) => onEditFieldsChange({ ...editFields, maxNights: v })} />
            <RuleEditor label="Maximum hours per week" unit="h" value={editFields.maxWeeklyHours} onChange={(v) => onEditFieldsChange({ ...editFields, maxWeeklyHours: v })} />
            <RuleEditor label="Week starts on" unit="(0=Sun, 1=Mon)" value={editFields.weekStartDay} onChange={(v) => onEditFieldsChange({ ...editFields, weekStartDay: v })} />
            <RuleEditor
              label="Max-hours severity"
              unit="(0=warn, 1=block)"
              value={editFields.maxWeeklyHoursSeverity === "block" ? 1 : 0}
              onChange={(v) => onEditFieldsChange({ ...editFields, maxWeeklyHoursSeverity: v === 1 ? "block" : "warn" })}
            />
            <RuleEditor
              label="Max-nights severity"
              unit="(0=warn, 1=block)"
              value={editFields.maxNightsSeverity === "block" ? 1 : 0}
              onChange={(v) => onEditFieldsChange({ ...editFields, maxNightsSeverity: v === 1 ? "block" : "warn" })}
            />
            <RuleEditor
              label="Pending leave blocks"
              unit="(0=ignore, 1=block, 2=warn)"
              value={editFields.pendingLeaveAction === "block" ? 1 : editFields.pendingLeaveAction === "ignore" ? 0 : 2}
              onChange={(v) => onEditFieldsChange({ ...editFields, pendingLeaveAction: v === 1 ? "block" : v === 0 ? "ignore" : "warn" })}
            />
            <Field>
              <FieldLabel className="text-[13px] text-muted-foreground">Timezone</FieldLabel>
              <Select
                value={editFields.timezone}
                onValueChange={(value) => value && onEditFieldsChange({ ...editFields, timezone: value })}
              >
                <SelectTrigger className="h-10 rounded-xl w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        ) : (
          <>
            <RuleDisplay label="Minimum rest between shifts" value={settings.minRestHoursBetweenShifts || 11} unit="h" />
            <RuleDisplay label="Maximum days in a row" value={settings.consecutiveShiftsCap || 5} unit="days" />
            <RuleDisplay label="Maximum nights per month" value={settings.maxNightsPerMonth || 7} unit="nights" />
            <RuleDisplay label="Maximum hours per week" value={settings.weeklyHoursCap || 48} unit="h" />
            <RuleDisplay label="Week starts on" value={settings.weekStartDay ?? 1} unit="(0=Sun, 1=Mon)" />
            <RuleDisplay label="Hours cap severity" value={settings.maxWeeklyHoursSeverity === "block" ? "block" : "warn"} unit="" />
            <RuleDisplay label="Nights cap severity" value={settings.maxNightsSeverity === "block" ? "block" : "warn"} unit="" />
            <RuleDisplay label="Pending leave" value={settings.pendingLeaveAction || "warn"} unit="" />
            <RuleDisplay label="Timezone" value={settings.timezone || "UTC"} unit="" />
          </>
        )}
      </FieldGroup>
    </div>
  );
}

function RuleDisplay({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div>
      <div className="mb-1 text-[13px] text-muted-foreground">{label}</div>
      <div className="text-xl font-medium text-foreground tabular-nums">
        {value} {unit}
      </div>
    </div>
  );
}

function RuleEditor({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <Field>
      <FieldLabel className="text-[13px] text-muted-foreground">{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20"
        />
        <span className="text-[13px] text-muted-foreground">{unit}</span>
      </div>
    </Field>
  );
}
