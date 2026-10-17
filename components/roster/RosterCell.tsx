"use client";

import { Plus } from "lucide-react";
import {
  netHoursOf,
  shiftTintOf,
  shortConflictReason,
  formatHours,
  type WeekDate,
} from "@/lib/schedule-cycle";
import { Button } from "@/components/ui/button";
import { SHIFT_TINTS } from "@/components/roster/rosterStyles";

/* ─── Grid day cell: assignment / leave / off / empty + conflict popover ─── */

/** Unit suffix only when the assignment's ward zone differs from the person's default unit */
export function wardZoneSuffix(assignment: any, empUnit: string): string {
  if (assignment && assignment.wardZone && !empUnit.includes(assignment.wardZone)) {
    return assignment.wardZone.split(" ")[0].replace(/Zoo?ne/i, "").trim().slice(0, 10);
  }
  return "";
}

function assignmentAriaLabel(args: {
  emp: any;
  date: string;
  asg: any;
  st: any;
  leave: any;
  isOff: boolean;
  unitSuffix: string;
}): string {
  const { emp, date, asg, st, leave, isOff, unitSuffix } = args;
  const isConflict = Boolean(asg?.conflictFlag);
  if (asg) {
    return `${emp.fullName}, ${date}: ${isConflict ? shortConflictReason(asg.conflictReason || "") + " — " : ""}${st?.name || "shift"} ${st?.startTime}-${st?.endTime}, ${formatHours(netHoursOf(st))}${unitSuffix ? ", " + asg.wardZone : ""}`;
  }
  if (leave || isOff) {
    return `${emp.fullName}, ${date}: ${leave ? "On leave" : "Rotational off-day"}`;
  }
  return `${emp.fullName}, ${date}: open slot`;
}

export function RosterCell({
  emp,
  day,
  assignment,
  shiftType,
  isOff,
  leaveRecord,
  canAssignShifts,
  isPopoverOpen,
  onTogglePopover,
  onOpen,
  onSwap,
}: {
  emp: any;
  day: WeekDate;
  assignment?: any;
  shiftType?: any;
  isOff: boolean;
  leaveRecord?: any;
  canAssignShifts: boolean;
  isPopoverOpen: boolean;
  onTogglePopover: () => void;
  /** Open the assignment drawer for this employee/date. */
  onOpen: () => void;
  /** "Swap staff": move the conflicted date onto a free colleague instead. */
  onSwap: () => void;
}) {
  const asg = assignment;
  const st = shiftType;
  const leave = leaveRecord;
  const isConflict = Boolean(asg?.conflictFlag);

  const unitSuffix = wardZoneSuffix(asg, emp.unit);

  const ariaLabel = assignmentAriaLabel({
    emp,
    date: day.date,
    asg,
    st,
    leave,
    isOff,
    unitSuffix,
  });

  return (
    <td className={day.isToday ? "today-col relative p-1 px-2 text-center" : "relative p-1 px-2 text-center"}>
      {leave || isOff ? (
        <Button
          variant="ghost"
          className="cell-btn h-12 w-full text-[13px] text-muted-foreground"
          aria-label={ariaLabel}
          disabled={!canAssignShifts}
          onClick={onOpen}
        >
          {leave ? "Leave" : "Off"}
        </Button>
      ) : asg && st ? (
        <Button
          className="cell-btn h-12 w-full justify-center gap-1.5 whitespace-nowrap px-2.5 text-foreground"
          aria-label={ariaLabel}
          style={{
            background: isConflict ? undefined : SHIFT_TINTS[shiftTintOf(st)]?.bg || "var(--linen)",
          }}
          variant={isConflict ? "destructive" : "secondary"}
          onClick={() => (isConflict && canAssignShifts ? onTogglePopover() : onOpen())}
          title={
            isConflict
              ? (asg.conflictReason || "Rule conflict")
              : `${st.name} · ${st.startTime}–${st.endTime} · ${formatHours(netHoursOf(st))} · ${asg.wardZone || emp.unit}`
          }
        >
          {isConflict ? (
            <span className="text-[13px] font-medium">
              {shortConflictReason(asg.conflictReason || "")}
            </span>
          ) : (
            <>
              <span className="text-sm tabular-nums">
                {st.startTime.slice(0, 5)}–{st.endTime.slice(0, 5)}
              </span>
              {unitSuffix && (
                <span className="text-xs text-muted-foreground">{unitSuffix}</span>
              )}
            </>
          )}
        </Button>
      ) : (
        <Button
          variant="ghost"
          aria-label={ariaLabel}
          disabled={!canAssignShifts}
          onClick={onOpen}
          className="cell-btn text-muted-foreground/45"
        >
          {canAssignShifts && <Plus className="cell-add" />}
        </Button>
      )}

      {/* Conflict popover: rule broken + actions */}
      {isConflict && isPopoverOpen && (
        <div className="absolute left-1/2 top-[calc(100%-4px)] z-30 w-54 -translate-x-1/2 rounded-xl border bg-popover p-3 text-left text-popover-foreground">
          <div className="mb-1 text-xs font-medium text-destructive">
            {shortConflictReason(asg.conflictReason || "")}
          </div>
          <div className="mb-2 text-xs leading-relaxed text-muted-foreground">
            {asg.conflictReason || ""} ({emp.fullName}, {day.date})
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onOpen}>
              Reassign
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onSwap}>
              Swap
            </Button>
          </div>
        </div>
      )}
    </td>
  );
}
