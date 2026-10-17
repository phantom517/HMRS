"use client";

import { computedNetHours, shiftTintOf } from "@/lib/schedule-cycle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/* ─── SECTION 2: Shift type table + not-working pseudo types ────────────── */

export function ShiftTypesTables({
  realShifts,
  notWorking,
  hasMultipleCategories,
  canManage,
  onEdit,
  onAdd,
}: {
  realShifts: Array<any>;
  notWorking: Array<any>;
  hasMultipleCategories: boolean;
  canManage: boolean;
  onEdit: (shift: any) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-background">
        <Table className="ztable">
          <TableHeader>
            <TableRow className="hover:bg-background">
              <TableHead className="text-left">Shift</TableHead>
              {hasMultipleCategories && <TableHead className="w-[130px] text-left">Type</TableHead>}
              <TableHead className="w-[120px] text-center">Hours</TableHead>
              <TableHead className="num w-[100px] text-center">Paid hours</TableHead>
              <TableHead className="num w-[90px] text-center">Break</TableHead>
              <TableHead className="w-[140px] text-left">Min staffing</TableHead>
              {canManage && <TableHead className="w-[90px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {realShifts.length === 0 ? (
              <TableRow className="hover:bg-background">
                <TableCell colSpan={7} className="border-b-0">
                  <Empty className="py-8">
                    <EmptyHeader>
                      <EmptyTitle>No shift types</EmptyTitle>
                      <EmptyDescription>Add one to start building rosters.</EmptyDescription>
                    </EmptyHeader>
                    {canManage && (
                      <Button variant="secondary" onClick={onAdd}>
                        Add shift type
                      </Button>
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              realShifts.map((st) => {
                const paidHours = computedNetHours(
                  st.startTime,
                  st.endTime,
                  st.breakDurationMinutes || 0,
                  Boolean(st.crossesMidnight)
                );
                const tint = shiftTintOf(st);
                const tintBg =
                  tint === "night" ? "var(--apricot)" : tint === "oncall" ? "var(--parchment)" : "var(--linen)";
                return (
                  <TableRow key={st.id}>
                    <TableCell>
                      <div
                        className="flex items-center gap-2.5 whitespace-nowrap"
                        title={st.description && st.description !== "Emergency department clinical shift." ? st.description : undefined}
                      >
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium"
                          style={{ background: tintBg }}
                        >
                          {st.shortCode}
                        </span>
                        <div>
                          <div className="text-[15px] font-medium leading-tight text-foreground">
                            {st.name}
                          </div>
                          {!st.active && (
                            <Badge variant="outline" className="mt-0.5">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    {hasMultipleCategories && (
                      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                        {st.category || "REGULAR"}
                      </TableCell>
                    )}
                    <TableCell className="text-center whitespace-nowrap tabular-nums text-muted-foreground">
                      {st.startTime}–{st.endTime}
                    </TableCell>
                    <TableCell className="num text-center whitespace-nowrap font-medium tabular-nums">
                      {paidHours.toFixed(1)} h
                    </TableCell>
                    <TableCell className="num text-center whitespace-nowrap tabular-nums text-muted-foreground">
                      {st.breakDurationMinutes ? `${st.breakDurationMinutes} min` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-foreground">
                      {st.minimumStaffRn || 0} RN · {st.minimumStaffMd || 0} MD
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(st)}>
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Not working pseudo-types (e.g. Off Day) — not shifts, shown separately */}
      {notWorking.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[13px] font-medium text-muted-foreground">
            Not working
          </div>
          <div className="overflow-hidden rounded-xl border bg-background">
            <Table className="ztable">
              <TableHeader>
                <TableRow className="hover:bg-background">
                  <TableHead className="text-left">Type</TableHead>
                  <TableHead className="text-left">Purpose</TableHead>
                  {canManage && <TableHead className="w-[90px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {notWorking.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell className="whitespace-nowrap text-[15px] font-medium text-foreground">
                      {st.name}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      Marks a day a person is deliberately not rostered. No hours, break, or staffing minimums.
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(st)}>
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
