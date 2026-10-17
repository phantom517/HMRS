"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { RosterWeek } from "@/lib/schedule-cycle";
import { Button } from "@/components/ui/button";
import { RosterGuardrailBadge, type FatigueAlert, type UnfilledAlert } from "@/components/roster/RosterGuardrailBadge";

/* ─── Header: title, live guardrail badge, week nav, primary action ─────── */

export function RosterHeader({
  week,
  conflictCount,
  onOpenConflicts,
  fatigueAlerts,
  unfilledAlerts,
  onOpenDrawerFromAlert,
  onSmartFill,
  isSmartFilling,
  canAssignShifts,
  onAssignShift,
}: {
  week: RosterWeek;
  conflictCount: number;
  onOpenConflicts: () => void;
  fatigueAlerts: FatigueAlert[];
  unfilledAlerts: UnfilledAlert[];
  onOpenDrawerFromAlert: (employee: any, date: string, shiftTypeId?: string) => void;
  onSmartFill: () => void;
  isSmartFilling: boolean;
  canAssignShifts: boolean;
  /** Open the assignment drawer on today's date (first employee preselected). */
  onAssignShift: () => void;
}) {
  return (
    <div className="roster-header-container flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-70 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[32px] font-medium leading-tight tracking-tight text-foreground">
            Roster
          </h1>

          {/* ── Automated Real-Time Guardrail Notification Badge ── */}
          <RosterGuardrailBadge
            fatigueAlerts={fatigueAlerts}
            unfilledAlerts={unfilledAlerts}
            onOpenDrawer={onOpenDrawerFromAlert}
            onSmartFill={onSmartFill}
            isSmartFilling={isSmartFilling}
          />

          {conflictCount > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={onOpenConflicts}
              className="text-destructive"
            >
              {conflictCount} conflicts · Review
            </Button>
          )}
        </div>

        {/* Week: derived from the SAME date source the server page used */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" aria-label="Previous week">
            <ChevronLeft />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{week.weekLabel}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Next week">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Today
          </Button>
        </div>
      </div>

      {/* Exactly ONE honey action in the viewport */}
      {canAssignShifts && (
        <Button onClick={onAssignShift} className="h-10 shrink-0 rounded-xl px-5">
          <Plus data-icon="inline-start" />
          <span>Assign shift</span>
        </Button>
      )}
    </div>
  );
}
