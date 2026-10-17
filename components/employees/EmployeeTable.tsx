"use client";

import { ChevronRight } from "lucide-react";
import { netHoursOf, formatHours } from "@/lib/schedule-cycle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ZAvatar } from "@/components/shared/ZAvatar";
import { credentialStateOf, CRED_LABEL, groupByDesignation } from "@/components/employees/employeeUtils";

/* ─── Grouped employee table ────────────────────────────────────────────── */

export function EmployeeTable({
  filteredEmployees,
  assignments,
  shiftTypes,
  weeklyHoursCap,
  onOpenDetail,
}: {
  filteredEmployees: Array<any>;
  assignments: Array<any>;
  shiftTypes: Array<any>;
  weeklyHoursCap: number;
  onOpenDetail: (emp: any) => void;
}) {
  const groupedRows = groupByDesignation(filteredEmployees);

  function weekHoursOf(emp: any): number {
    return assignments
      .filter((a) => a.employeeId === emp.id && a.status !== "cancelled")
      .reduce((acc, a) => acc + netHoursOf(shiftTypes.find((s) => s.id === a.shiftTypeId)), 0);
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table className="ztable">
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead className="text-left">Name</TableHead>
            <TableHead className="w-[180px] text-left">Role</TableHead>
            <TableHead className="w-[170px] text-left">Unit</TableHead>
            <TableHead className="num w-[120px] text-center">Hours · this week</TableHead>
            <TableHead className="num w-[70px] text-center">Nights</TableHead>
            <TableHead className="w-[110px] text-right">Credentials</TableHead>
            <TableHead className="w-9" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredEmployees.length === 0 ? (
            <TableRow className="hover:bg-background">
              <TableCell colSpan={7} className="border-b-0">
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>No staff match these filters</EmptyTitle>
                    <EmptyDescription>Try clearing the search or picking another tab.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            groupedRows.map(([designation, group]) => [
              <TableRow key={`grp-${designation}`} className="hover:bg-muted/50">
                <TableCell
                  colSpan={7}
                  className="h-9 border-b bg-muted px-2 text-[13px] font-medium"
                >
                  {designation} · {group.length}
                </TableCell>
              </TableRow>,
              ...group.map((emp) => {
                const hours = weekHoursOf(emp);
                const over = hours > weeklyHoursCap;
                const credState = credentialStateOf(emp);
                const empAsgs = assignments.filter(
                  (a) => a.employeeId === emp.id && a.status !== "cancelled"
                );
                const nights = empAsgs.filter((a) => {
                  const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
                  return st && (st.crossesMidnight || st.shortCode === "N");
                }).length;
                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => onOpenDetail(emp)}
                  >
                    <TableCell>
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
                    <TableCell className="whitespace-nowrap text-sm text-foreground">
                      {emp.designation}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {emp.unit}
                    </TableCell>
                    <TableCell
                      className="num text-center text-[15px] font-medium tabular-nums"
                      style={{ color: over ? "var(--critical-text)" : undefined }}
                      title={over ? `Over ${weeklyHoursCap}h weekly max` : undefined}
                    >
                      {formatHours(hours)}
                    </TableCell>
                    <TableCell className="num text-center tabular-nums text-muted-foreground">
                      {nights}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={credState === "expiring" ? "outline" : "secondary"}
                        style={
                          credState === "expiring"
                            ? { background: "var(--apricot)" }
                            : undefined
                        }
                      >
                        {CRED_LABEL[credState]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <ChevronRight className="size-4" />
                    </TableCell>
                  </TableRow>
                );
              }),
            ])
          )}
        </TableBody>
      </Table>
    </div>
  );
}
