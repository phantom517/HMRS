"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ZAvatar } from "@/components/shared/ZAvatar";

/* ─── TAB 3: Balances ───────────────────────────────────────────────────── */

export function LeaveBalancesTab({
  employees,
  records,
}: {
  employees: Array<any>;
  records: Array<any>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table className="ztable">
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead className="text-left">Staff</TableHead>
            <TableHead className="text-left">Role</TableHead>
            <TableHead className="num text-left">Sick</TableHead>
            <TableHead className="num text-left">Annual</TableHead>
            <TableHead className="num text-left">Casual</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.slice(0, 15).map((emp) => {
            const isDoctor =
              emp.designation.includes("Physician") || emp.designation.includes("Attending");
            const sickTotal = isDoctor ? 12 : 14;
            const annualTotal = isDoctor ? 25 : 20;
            const casualTotal = 7;

            const empRecords = records.filter(
              (r) => r.employeeId === emp.id && r.status === "approved"
            );
            const sickTaken = empRecords
              .filter((r) => r.leaveTypeId === "lt_sick")
              .reduce((sum, r) => sum + Number(r.durationDays || 0), 0);
            const annualTaken = empRecords
              .filter((r) => r.leaveTypeId === "lt_annual")
              .reduce((sum, r) => sum + Number(r.durationDays || 0), 0);

            const balanceCell = (taken: number, total: number) => (
              <>
                <span className="font-medium text-foreground">{total - taken}</span>
                <span className="text-muted-foreground"> / {total} d</span>
              </>
            );

            return (
              <TableRow key={emp.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <ZAvatar name={emp.fullName} />
                    <div>
                      <div className="text-[15px] font-medium text-foreground">{emp.fullName}</div>
                      <div className="text-[13px] text-muted-foreground">{emp.employeeId}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {emp.designation}
                </TableCell>
                <TableCell className="num whitespace-nowrap tabular-nums">
                  {balanceCell(sickTaken, sickTotal)}
                </TableCell>
                <TableCell className="num whitespace-nowrap tabular-nums">
                  {balanceCell(annualTaken, annualTotal)}
                </TableCell>
                <TableCell className="num whitespace-nowrap tabular-nums">
                  {balanceCell(0, casualTotal)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
