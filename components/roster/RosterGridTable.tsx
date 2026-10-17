"use client";

import { formatHours, isNightShiftType, netHoursOf, type RosterWeek, type WeekDate } from "@/lib/schedule-cycle";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileDaySelector } from "@/components/roster/MobileDaySelector";
import { RosterCell } from "@/components/roster/RosterCell";
import { ZAvatar } from "@/components/shared/ZAvatar";

interface RosterGridTableProps {
  week: RosterWeek;
  visibleDates: WeekDate[];
  selectedDayMobile: string;
  onSelectDayMobile: (day: string) => void;
  groupedRows: Array<[string, any[]]>;
  assignments: Array<any>;
  shiftTypes: Array<any>;
  offDays: Array<any>;
  leaveRecords: Array<any>;
  weeklyHoursCap: number;
  canAssignShifts: boolean;
  conflictPopoverFor: string | null;
  onToggleConflictPopover: (assignmentId: string) => void;
  onOpenCell: (emp: any, date: string) => void;
  onSwapFromConflict: (emp: any, date: string) => void;
  weeklyTotals: {
    hours: number;
    nights: number;
    perDay: Record<string, { scheduled: number; hours: number; conflicts: number }>;
  };
  requiredPerDay: number;
  employeesCount: number;
}

/* ─── Spreadsheet grid: staff rows across the selected days ─────────────── */

export function RosterGridTable({
  week,
  visibleDates,
  selectedDayMobile,
  onSelectDayMobile,
  groupedRows,
  assignments,
  shiftTypes,
  offDays,
  leaveRecords,
  weeklyHoursCap,
  canAssignShifts,
  conflictPopoverFor,
  onToggleConflictPopover,
  onOpenCell,
  onSwapFromConflict,
  weeklyTotals,
  requiredPerDay,
  employeesCount,
}: RosterGridTableProps) {
  return (
    <>
      <MobileDaySelector
        dates={week.dates}
        selectedDayMobile={selectedDayMobile}
        onSelect={onSelectDayMobile}
      />

      <div className="ztable-roster-wrap min-h-80 max-h-[calc(100vh-320px)] overflow-auto rounded-xl border bg-background">
        <Table className="ztable ztable-roster">
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 64 }} />
            {visibleDates.map((d) => (
              <col key={d.date} style={{ width: selectedDayMobile === "all" ? 112 : "auto", minWidth: 100 }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-background">
              <TableHead className="staff-cell sticky left-0 z-10 bg-background text-left">
                Staff member
              </TableHead>
              <TableHead className="num text-center">Hours</TableHead>
              <TableHead className="num text-center">Nights</TableHead>
              {visibleDates.map((d) => (
                <TableHead key={d.date} className="relative text-center">
                  <span className="text-[13px] text-muted-foreground">{d.weekday}</span>
                  {d.isToday ? (
                    <span className="mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground tabular-nums">
                      {d.dayNumber}
                    </span>
                  ) : (
                    <span className="mt-0.5 text-base font-medium text-foreground tabular-nums">
                      {d.dayNumber}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedRows.length === 0 && (
              <TableRow className="hover:bg-background">
                <TableCell
                  colSpan={3 + visibleDates.length}
                  className="text-sm text-muted-foreground"
                >
                  No staff match these filters.
                </TableCell>
              </TableRow>
            )}
            {groupedRows.map(([designation, group]) => [
              <TableRow key={`hdr-${designation}`} className="roster-group-row hover:bg-muted/50">
                <TableCell
                  className="staff-cell h-9 sticky left-0 border-b bg-muted px-2 text-[13px] font-medium"
                  colSpan={3 + visibleDates.length}
                >
                  {designation} · {group.length}
                </TableCell>
              </TableRow>,
              ...group.map((emp) => {
                const empAssignments = assignments.filter(
                  (a) => a.employeeId === emp.id && a.status !== "cancelled"
                );
                const totalHours = empAssignments.reduce((acc, a) => {
                  const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
                  return acc + netHoursOf(st);
                }, 0);
                const nightsCount = empAssignments.filter((a) =>
                  isNightShiftType(shiftTypes.find((s) => s.id === a.shiftTypeId))
                ).length;
                const overHours = totalHours > weeklyHoursCap;

                return (
                  <TableRow key={emp.id} className="hover:bg-linen/55 dark:hover:bg-muted/50">
                    <TableCell className="staff-cell sticky left-0 z-2 border-b bg-background">
                      <div className="flex items-center gap-2.5 whitespace-nowrap">
                        <ZAvatar name={emp.fullName} />
                        <div>
                          <div className="text-[15px] font-medium leading-tight text-foreground">
                            {emp.fullName}
                          </div>
                          <div className="text-[13px] leading-tight text-muted-foreground">
                            {emp.employeeId}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell
                      className="num text-center text-[13px] font-medium"
                      style={{ color: overHours ? "var(--critical-text)" : undefined }}
                      title={overHours ? `Over ${weeklyHoursCap}h weekly max` : undefined}
                    >
                      {totalHours.toFixed(1)}
                    </TableCell>
                    <TableCell className="num text-center text-muted-foreground">
                      {nightsCount}
                    </TableCell>

                    {visibleDates.map((d) => {
                      const asg = assignments.find(
                        (a) => a.employeeId === emp.id && a.date === d.date && a.status !== "cancelled"
                      );
                      const st = asg ? shiftTypes.find((s) => s.id === asg.shiftTypeId) : null;
                      const isOff = offDays.some(
                        (o) => o.employeeId === emp.id && o.date === d.date
                      );
                      const leave = leaveRecords.find(
                        (l) =>
                          l.employeeId === emp.id &&
                          l.status === "approved" &&
                          l.startDate <= d.date &&
                          l.endDate >= d.date
                      );

                      return (
                        <RosterCell
                          key={d.date}
                          emp={emp}
                          day={d}
                          assignment={asg}
                          shiftType={st}
                          isOff={isOff}
                          leaveRecord={leave}
                          canAssignShifts={canAssignShifts}
                          isPopoverOpen={Boolean(asg && conflictPopoverFor === asg.id)}
                          onTogglePopover={() => asg && onToggleConflictPopover(asg.id)}
                          onOpen={() => onOpenCell(emp, d.date)}
                          onSwap={() => onSwapFromConflict(emp, d.date)}
                        />
                      );
                    })}
                  </TableRow>
                );
              }),
            ])}
          </TableBody>
          <TableFooter className="border-t-0 bg-muted">
            <TableRow className="bg-muted hover:bg-muted">
              <TableCell className="staff-cell sticky left-0 z-3 border-b-0 bg-muted px-2 font-medium">
                <div className="font-medium leading-tight text-foreground">Coverage</div>
                <div className="text-xs leading-tight text-muted-foreground">
                  present / required
                </div>
              </TableCell>
              <TableCell className="num border-b-0 bg-muted px-2 text-center text-[13px] font-medium">
                {formatHours(weeklyTotals.hours)}
              </TableCell>
              <TableCell className="num border-b-0 bg-muted px-2 text-center text-muted-foreground">
                {weeklyTotals.nights}
              </TableCell>
              {visibleDates.map((d) => {
                const day = weeklyTotals.perDay[d.date];
                const short = day.scheduled < requiredPerDay;
                return (
                  <TableCell
                    key={d.date}
                    className="border-b-0 bg-muted px-2 text-center text-[13px] whitespace-nowrap tabular-nums"
                    style={{
                      color: short ? "var(--critical-text)" : undefined,
                      fontWeight: short ? 500 : 400,
                    }}
                    title={`${day.scheduled} scheduled · ${requiredPerDay} required (${employeesCount} active staff)`}
                  >
                    {day.scheduled} / {requiredPerDay}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
