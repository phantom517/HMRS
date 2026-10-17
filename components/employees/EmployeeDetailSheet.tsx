"use client";

import { Archive, Clock, Edit, Trash2 } from "lucide-react";
import { formatHours, netHoursOf } from "@/lib/schedule-cycle";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZAvatar } from "@/components/shared/ZAvatar";

/* ─── Detail slide-over: profile, stats, history, actions ───────────────── */

export function EmployeeDetailSheet({
  open,
  onOpenChange,
  selectedEmployee,
  assignments,
  shiftTypes,
  leaveRecords,
  canEditEmployees,
  canAssignShifts,
  canDeleteEmployees,
  onEdit,
  onQuickAssign,
  onArchiveToggle,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: any;
  assignments: Array<any>;
  shiftTypes: Array<any>;
  leaveRecords: Array<any>;
  canEditEmployees: boolean;
  canAssignShifts: boolean;
  canDeleteEmployees: boolean;
  onEdit: () => void;
  onQuickAssign: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const selectedAssignments = assignments.filter(
    (a) => a.employeeId === selectedEmployee.id && a.status !== "cancelled"
  );
  const selectedLeaves = leaveRecords.filter((l) => l.employeeId === selectedEmployee.id);
  const hours = selectedAssignments.reduce(
    (acc, a) =>
      acc + netHoursOf(shiftTypes.find((s) => s.id === a.shiftTypeId)),
    0
  );
  const nights = selectedAssignments.filter((a) => {
    const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
    return st && (st.crossesMidnight || st.shortCode === "N");
  }).length;
  const creds = Array.isArray(selectedEmployee.credentials) ? selectedEmployee.credentials : [];

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-[420px]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <ZAvatar
              name={selectedEmployee.fullName}
              style={{ width: 44, height: 44, fontSize: 16 }}
            />
            <div className="flex-1">
              <SheetTitle className="font-medium">{selectedEmployee.fullName}</SheetTitle>
              <SheetDescription>
                {selectedEmployee.designation} · {selectedEmployee.employeeId}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 py-5">
          <div className="flex gap-6">
            <Stat label="Hours · this week" value={formatHours(hours)} />
            <Stat label="Nights" value={String(nights)} />
            <Stat
              label="Completed"
              value={String(selectedAssignments.filter((a) => a.status === "completed").length)}
            />
          </div>

          <div>
            <SectionLabel>Credentials</SectionLabel>
            {creds.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">None on record.</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {creds.map((c: any, i: number) => (
                  <Badge key={i} variant="secondary">
                    {c.name}
                    {c.expires ? ` · exp ${c.expires}` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Recent shifts</SectionLabel>
            {selectedAssignments.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">No shifts scheduled this week.</div>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {selectedAssignments.slice(0, 8).map((asg) => {
                  const st = shiftTypes.find((s) => s.id === asg.shiftTypeId);
                  return (
                    <div
                      key={asg.id}
                      className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span className="text-[13px] tabular-nums text-foreground">{asg.date}</span>
                      </div>
                      <span className="whitespace-nowrap text-[13px] text-muted-foreground">
                        {st?.name} {st?.startTime}–{st?.endTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Leave requests</SectionLabel>
            {selectedLeaves.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">No leave requests on file.</div>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {selectedLeaves.map((l) => (
                  <div key={l.id} className="rounded-lg bg-muted px-3 py-2">
                    <div className="flex justify-between">
                      <span className="text-[13px] font-medium text-foreground">{l.reason}</span>
                      <span className="text-xs capitalize text-muted-foreground">{l.status}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {l.startDate} – {l.endDate} · {l.durationDays} days
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Contact</SectionLabel>
            <div className="text-[13px] leading-relaxed text-muted-foreground">
              {selectedEmployee.phoneNumber}
              <br />
              {selectedEmployee.email}
            </div>
          </div>
        </div>

        {canEditEmployees && (
          <SheetFooter className="border-t">
            <div className="flex w-full gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={onEdit}>
                <Edit data-icon="inline-start" />
                <span>Edit record</span>
              </Button>
              {canAssignShifts && (
                <Button variant="secondary" className="flex-1" onClick={onQuickAssign}>
                  Manage shifts
                </Button>
              )}
            </div>
            <div className="flex w-full gap-2">
              <Button
                variant="ghost"
                onClick={onArchiveToggle}
                className={
                  selectedEmployee.employmentStatus === "archived"
                    ? "text-foreground"
                    : "text-destructive"
                }
              >
                <Archive data-icon="inline-start" />
                <span>{selectedEmployee.employmentStatus === "archived" ? "Restore" : "Archive"}</span>
              </Button>
              {canDeleteEmployees && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  title="Permanently delete this employee and all their history — irreversible"
                  onClick={onDelete}
                >
                  <Trash2 data-icon="inline-start" />
                  <span>Delete permanently</span>
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[13px] font-medium text-foreground">{children}</div>;
}
