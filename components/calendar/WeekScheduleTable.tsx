"use client";

import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ZAvatar } from "@/components/shared/ZAvatar";

/* ─── Week View: 7-day schedule with expanded employee rows ─────────────── */

export function WeekScheduleTable({
  weekDays,
  filteredEmployees,
  assignments,
  leaveRecords,
  offDays,
  shiftMap,
  canAssignShifts,
  onQuickAssign,
  onSelectAssignment,
}: {
  weekDays: Array<{ dateString: string; dayNum: number }>;
  filteredEmployees: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  shiftMap: Map<string, any>;
  canAssignShifts: boolean;
  onQuickAssign: (date: string) => void;
  onSelectAssignment: (assignment: any) => void;
}) {
  return (
    <div className="zelt-surface overflow-hidden">
      <div className="flex items-center justify-between bg-muted px-5 py-4">
        <div className="text-sm font-medium text-foreground">
          Week Schedule: {weekDays[0]?.dateString} to {weekDays[6]?.dateString}
        </div>
        <div className="text-[13px] text-muted-foreground">
          {filteredEmployees.length} staff across 7 clinical duty days
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="ztable min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-background">
              <TableHead className="w-[240px] text-left">Staff member</TableHead>
              {weekDays.map((d) => (
                <TableHead key={d.dateString} className="text-center">
                  <div>
                    {new Date(d.dateString + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-foreground">
                    {d.dayNum}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.slice(0, 15).map((emp) => (
              <TableRow key={emp.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <ZAvatar name={emp.fullName} />
                    <div>
                      <div className="font-medium text-foreground">{emp.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {emp.designation} &middot; {emp.unit}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {weekDays.map((d) => {
                  const asg = assignments.find(
                    (a) => a.employeeId === emp.id && a.date === d.dateString
                  );
                  const isLeave = leaveRecords.some(
                    (l) =>
                      l.employeeId === emp.id &&
                      l.status === "approved" &&
                      d.dateString >= l.startDate &&
                      d.dateString <= l.endDate
                  );
                  const isOff = offDays.some(
                    (o) => o.employeeId === emp.id && o.date === d.dateString
                  );
                  const shift = asg ? shiftMap.get(asg.shiftTypeId) : null;
                  const isNight = shift?.shortCode === "N";

                  return (
                    <TableCell key={d.dateString} className="text-center align-middle">
                      {asg ? (
                        <button
                          onClick={() => onSelectAssignment(asg)}
                          className="flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-xs font-medium text-foreground"
                          style={{
                            width: "100%",
                            background: asg.conflictFlag ? "var(--critical-bg)" : isNight ? "var(--apricot)" : "var(--linen)",
                            color: asg.conflictFlag ? "var(--critical-text)" : undefined,
                          }}
                        >
                          <span>{shift?.shortCode}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {shift?.startTime.slice(0, 5)}
                          </span>
                        </button>
                      ) : isLeave ? (
                        <span className="ztag ztag-warning px-2 py-0.5 text-[11px]">Leave</span>
                      ) : isOff ? (
                        <span className="text-xs text-muted-foreground">Off</span>
                      ) : canAssignShifts ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          onClick={() => onQuickAssign(d.dateString)}
                        >
                          <Plus />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
