"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ZAvatar } from "@/components/shared/ZAvatar";

/* ─── TAB 2: Days off ───────────────────────────────────────────────────── */

export function OffDaysTab({
  offDays,
  empMap,
  canAssignShifts,
  isSubmitting,
  onScheduleDayOff,
  onDeleteOffDay,
}: {
  offDays: Array<any>;
  empMap: Map<string, any>;
  canAssignShifts: boolean;
  isSubmitting: boolean;
  onScheduleDayOff: () => void;
  onDeleteOffDay: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table className="ztable">
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead className="text-left">Staff</TableHead>
            <TableHead className="w-[140px] text-left">Date</TableHead>
            <TableHead className="text-left">Reason</TableHead>
            <TableHead className="w-[160px] text-left">Scheduled by</TableHead>
            <TableHead className="w-[90px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offDays.length === 0 ? (
            <TableRow className="hover:bg-background">
              <TableCell colSpan={5} className="border-b-0">
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>No days off scheduled</EmptyTitle>
                    <EmptyDescription>Rotational days off appear here once scheduled.</EmptyDescription>
                  </EmptyHeader>
                  {canAssignShifts && (
                    <Button variant="secondary" onClick={onScheduleDayOff}>
                      Schedule day off
                    </Button>
                  )}
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            offDays.map((od) => {
              const emp = empMap.get(od.employeeId);
              return (
                <TableRow key={od.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5 whitespace-nowrap">
                      <ZAvatar name={emp?.fullName || "?"} />
                      <div>
                        <div className="text-[15px] font-medium whitespace-nowrap text-foreground">
                          {emp?.fullName || "Unknown staff"}
                        </div>
                        <div className="text-[13px] text-muted-foreground">{emp?.employeeId}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {od.date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {od.reason || "Day off"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                    {od.recordedBy || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canAssignShifts && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={isSubmitting}
                        onClick={() => onDeleteOffDay(od.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
