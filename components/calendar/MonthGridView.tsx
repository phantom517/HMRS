"use client";

import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalendarDay = {
  dateString: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─── Month Grid View ───────────────────────────────────────────────────── */

export function MonthGridView({
  calendarDays,
  assignmentsByDate,
  leavesByDate,
  empMap,
  shiftMap,
  selectedDate,
  onSelectDate,
  canAssignShifts,
  onQuickAssign,
  onSelectAssignment,
  onSeeWeek,
}: {
  calendarDays: CalendarDay[];
  assignmentsByDate: Map<string, Array<any>>;
  leavesByDate: Map<string, Array<any>>;
  empMap: Map<string, any>;
  shiftMap: Map<string, any>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  canAssignShifts: boolean;
  onQuickAssign: (date: string) => void;
  onSelectAssignment: (assignment: any) => void;
  onSeeWeek: (date: string) => void;
}) {
  return (
    <div className="zelt-surface overflow-hidden">
      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 bg-muted px-0 py-2.5 text-center text-[13px] font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Grid Cells */}
      <div className="grid grid-cols-7 gap-px bg-border">
        {calendarDays.map((day) => {
          const dayAssignments = assignmentsByDate.get(day.dateString) || [];
          const dayLeaves = leavesByDate.get(day.dateString) || [];
          const isSelected = selectedDate === day.dateString;
          const hasConflict = dayAssignments.some((a) => a.conflictFlag);

          return (
            <div
              key={day.dateString}
              onClick={() => onSelectDate(day.dateString)}
              className={`flex min-h-30 cursor-pointer flex-col justify-between p-2 transition-colors ${
                isSelected
                  ? "bg-muted"
                  : day.isCurrentMonth
                  ? "hover:bg-muted/50"
                  : "opacity-55 hover:bg-muted/50"
              }`}
            >
              {/* Top Bar of Day Cell */}
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[13px] tabular-nums ${
                      day.isToday || isSelected ? "font-semibold" : ""
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  {hasConflict && <AlertTriangle className="size-3 text-destructive" />}
                </div>

                <div className="flex items-center gap-1">
                  {dayAssignments.length > 0 && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {dayAssignments.length} staff
                    </span>
                  )}
                  {canAssignShifts && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-4.5 text-muted-foreground hover:text-foreground"
                      title="Assign shift on this day"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAssign(day.dateString);
                      }}
                    >
                      <Plus />
                    </Button>
                  )}
                </div>
              </div>

              {/* List of Shift Badges in this Cell */}
              <div className="flex-1 overflow-hidden">
                {dayAssignments.slice(0, 3).map((asg) => {
                  const emp = empMap.get(asg.employeeId);
                  const shift = shiftMap.get(asg.shiftTypeId);
                  const isNight = shift?.shortCode === "N";

                  return (
                    <div
                      key={asg.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAssignment(asg);
                      }}
                      className="mb-1 flex items-center justify-between gap-1 truncate rounded-lg border px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        background: asg.conflictFlag ? undefined : isNight ? "var(--apricot)" : "var(--linen)",
                      }}
                    >
                      <span className={`font-semibold ${asg.conflictFlag ? "text-destructive" : ""}`}>
                        {shift?.shortCode || "D"}
                      </span>
                      <span className="truncate">
                        {emp?.fullName ? emp.fullName.split(" ").slice(-1)[0] : "Staff"}
                      </span>
                    </div>
                  );
                })}

                {dayAssignments.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeeWeek(day.dateString);
                    }}
                    className="pl-0.5 text-left text-[11px] text-muted-foreground hover:underline"
                  >
                    +{dayAssignments.length - 3} more...
                  </button>
                )}

                {dayLeaves.map((l) => {
                  const emp = empMap.get(l.employeeId);
                  return (
                    <div
                      key={l.id}
                      className="mb-1 rounded-lg border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      style={{ background: "var(--linen)" }}
                    >
                      Leave: {emp?.fullName?.split(" ").slice(-1)[0] || "Staff"}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Day Status Indicator */}
              <div className="flex justify-between pt-1 text-[11px] text-muted-foreground">
                <span>
                  {dayAssignments.length >= 6
                    ? "Full cover"
                    : dayAssignments.length > 0
                    ? "Min met"
                    : "Unscheduled"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
