"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZAvatar } from "@/components/shared/ZAvatar";

function dateRangeLabel(startDate: string, endDate: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

/** Coverage note from real data: a replacement counts as covered; otherwise check
 *  whether the same-date approved leave + off-days leave at least one colleague. */
function coverageNote(
  rec: any,
  employees: Array<any>,
  records: Array<any>,
  offDays: Array<any>,
  empMap: Map<string, any>
): { label: string; critical: boolean } {
  if (rec.replacementEmployeeId) return { label: "Coverage assigned", critical: false };
  const emp = empMap.get(rec.employeeId);
  const sameWindowBlocked = new Set<string>();
  for (const r2 of records) {
    if (r2.status === "approved" && r2.startDate <= rec.endDate && r2.endDate >= rec.startDate)
      sameWindowBlocked.add(r2.employeeId);
  }
  for (const od of offDays) {
    if (od.date >= rec.startDate && od.date <= rec.endDate) sameWindowBlocked.add(od.employeeId);
  }
  const freeColleagues = employees.filter(
    (e) => e.id !== rec.employeeId && !sameWindowBlocked.has(e.id) && e.designation === emp?.designation
  ).length;
  if (freeColleagues > 0) return { label: "Coverage available", critical: false };
  if (emp) return { label: `Short 1 ${emp.designation.includes("MD") ? "MD" : "RN"}`, critical: true };
  return { label: "Coverage unclear", critical: false };
}

/* ─── TAB 1: Requests ───────────────────────────────────────────────────── */

export function LeaveRequestsTab({
  records,
  offDays,
  employees,
  leaveTypes,
  empMap,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  leaveTypeFilter,
  onLeaveTypeFilterChange,
  canApproveLeave,
  isSubmitting,
  onRecordLeave,
  onUpdateStatus,
}: {
  records: Array<any>;
  offDays: Array<any>;
  employees: Array<any>;
  leaveTypes: Array<any>;
  empMap: Map<string, any>;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  leaveTypeFilter: string;
  onLeaveTypeFilterChange: (type: string) => void;
  canApproveLeave: boolean;
  isSubmitting: boolean;
  onRecordLeave: () => void;
  onUpdateStatus: (id: string, status: "approved" | "rejected" | "cancelled") => void;
}) {
  const leaveTypeMap = useMemo(() => {
    const map = new Map<string, any>();
    leaveTypes.forEach((lt) => map.set(lt.id, lt));
    return map;
  }, [leaveTypes]);

  // Pending first, then most recent
  const sortedRecords = useMemo(() => {
    const rank = (r: any) => (r.status === "pending" ? 0 : r.status === "approved" ? 1 : 2);
    return [...records].sort((a, b) => rank(a) - rank(b) || b.startDate.localeCompare(a.startDate));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return sortedRecords.filter((r) => {
      const emp = empMap.get(r.employeeId);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmp =
          emp?.fullName.toLowerCase().includes(q) || emp?.employeeId.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        if (!matchEmp && !matchReason) return false;
      }
      if (statusFilter !== "ALL" && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (leaveTypeFilter !== "ALL" && r.leaveTypeId !== leaveTypeFilter) return false;
      return true;
    });
  }, [sortedRecords, searchQuery, statusFilter, leaveTypeFilter, empMap]);

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {/* Toolbar inside panel: search + filters, one row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <div className="relative w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search staff or reason…"
            className="h-10 rounded-xl pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value ?? "ALL")}>
          <SelectTrigger aria-label="Filter by status" className="ml-auto h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Denied</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={leaveTypeFilter} onValueChange={(value) => onLeaveTypeFilterChange(value ?? "ALL")}>
          <SelectTrigger aria-label="Filter by leave type" className="h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {leaveTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table className="ztable">
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead className="text-left">Staff</TableHead>
            <TableHead className="w-[120px] text-left">Type</TableHead>
            <TableHead className="w-[170px] text-left">Dates</TableHead>
            <TableHead className="num w-[70px] text-center">Days</TableHead>
            <TableHead className="w-[150px] text-left">Coverage</TableHead>
            <TableHead className="w-[110px] text-center">Status</TableHead>
            <TableHead className="w-[150px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRecords.length === 0 ? (
            <TableRow className="hover:bg-background">
              <TableCell colSpan={7} className="border-b-0">
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>No leave requests</EmptyTitle>
                    <EmptyDescription>
                      {searchQuery || statusFilter !== "ALL" || leaveTypeFilter !== "ALL"
                        ? "Nothing matches these filters."
                        : "Requests from staff will show up here."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {canApproveLeave && (
                    <Button variant="secondary" onClick={onRecordLeave}>
                      Record leave
                    </Button>
                  )}
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            filteredRecords.map((rec) => {
              const emp = empMap.get(rec.employeeId);
              const leaveType = leaveTypeMap.get(rec.leaveTypeId);
              const cov = coverageNote(rec, employees, records, offDays, empMap);
              const isPending = rec.status === "pending";
              return (
                <TableRow key={rec.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5 whitespace-nowrap">
                      <ZAvatar name={emp?.fullName || "?"} />
                      <div>
                        <div className="text-[15px] font-medium leading-tight text-foreground">
                          {emp?.fullName || "Unknown staff"}
                        </div>
                        <div className="text-[13px] leading-tight text-muted-foreground">
                          {emp?.employeeId}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">
                    {leaveType?.name || "Leave"}
                  </TableCell>
                  <TableCell>
                    <div className="whitespace-nowrap text-sm tabular-nums text-foreground">
                      {dateRangeLabel(rec.startDate, rec.endDate)}
                    </div>
                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                      {rec.reason}
                    </div>
                  </TableCell>
                  <TableCell className="num text-center text-[15px] font-medium tabular-nums">
                    {Number(rec.durationDays) || 1}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-[13px] font-medium"
                    style={{ color: cov.critical ? "var(--critical-text)" : "var(--ink-secondary)" }}
                  >
                    {cov.label}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={rec.status === "pending" ? "outline" : "secondary"} className="capitalize">
                      {rec.status === "rejected" ? "Denied" : rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isPending && canApproveLeave ? (
                      <div className="flex items-center justify-end gap-2.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => onUpdateStatus(rec.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={isSubmitting}
                          onClick={() => onUpdateStatus(rec.id, "rejected")}
                        >
                          Deny
                        </Button>
                      </div>
                    ) : rec.status === "approved" && canApproveLeave ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        disabled={isSubmitting}
                        onClick={() => onUpdateStatus(rec.id, "cancelled")}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
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
