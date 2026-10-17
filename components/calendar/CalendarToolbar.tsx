"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type CalendarViewMode = "month" | "week";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ─── Calendar Controls Surface ─────────────────────────────────────────── */

export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  currentMonth,
  currentYear,
  onPrevMonth,
  onNextMonth,
  selectedUnit,
  onUnitChange,
  selectedRole,
  onRoleChange,
  employeeCount,
  onOpenConflicts,
  canAssignShifts,
  onAssignShift,
}: {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  currentMonth: number;
  currentYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedUnit: string;
  onUnitChange: (unit: string) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  employeeCount: number;
  onOpenConflicts: () => void;
  canAssignShifts: boolean;
  onAssignShift: () => void;
}) {
  return (
    <div className="zelt-surface flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* View Mode Switcher */}
        <ToggleGroup
          value={[viewMode]}
          onValueChange={(value) => {
            const next = value[0];
            if (next) onViewModeChange(next as CalendarViewMode);
          }}
          variant="outline"
          className="rounded-xl border bg-muted p-0.5 shadow-none"
          aria-label="Calendar view mode"
        >
          <ToggleGroupItem value="month" className="px-3.5 py-1.5 text-[13px]">
            Month View
          </ToggleGroupItem>
          <ToggleGroupItem value="week" className="px-3.5 py-1.5 text-[13px]">
            Week View
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Month Stepper */}
        <div className="flex items-center gap-2 rounded-xl border bg-muted px-2.5 py-1">
          <Button variant="ghost" size="icon-sm" onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-medium text-foreground">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={onOpenConflicts}>
            <AlertTriangle data-icon="inline-start" className="text-destructive" />
            <span>2 Conflicts</span>
          </Button>
          {canAssignShifts && (
            <Button onClick={onAssignShift}>
              <Plus data-icon="inline-start" />
              <span>Assign shift</span>
            </Button>
          )}
        </div>
      </div>

      {/* Lower Row: Filter bar & Shift legend */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-t pt-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] font-medium text-muted-foreground">Filter:</span>
          <Select value={selectedUnit} onValueChange={(value) => onUnitChange(value ?? "All")}>
            <SelectTrigger aria-label="Filter by unit" className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Units ({employeeCount} staff)</SelectItem>
              <SelectItem value="Resuscitation">Trauma &amp; Resuscitation</SelectItem>
              <SelectItem value="Acute Care">Acute Care Bay</SelectItem>
              <SelectItem value="Rapid Assessment">Fast Track Ambulatory</SelectItem>
              <SelectItem value="Triage">Triage Station</SelectItem>
              <SelectItem value="Pediatric">Pediatric ED</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRole} onValueChange={(value) => onRoleChange(value ?? "All")}>
            <SelectTrigger aria-label="Filter by role" className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Roles</SelectItem>
              <SelectItem value="Physician">Physicians (MD)</SelectItem>
              <SelectItem value="Nurse">Nurses (RN)</SelectItem>
              <SelectItem value="Fellow">Fellows &amp; Residents</SelectItem>
              <SelectItem value="Triage">Triage Specialists</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clean Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="ztag ztag-neutral">D (07:00)</span>
          <span className="ztag ztag-neutral">E (15:00)</span>
          <span className="ztag ztag-warning">N (22:00)</span>
          <span className="ztag ztag-neutral">Leave</span>
          <span className="text-muted-foreground">Off</span>
        </div>
      </div>
    </div>
  );
}
