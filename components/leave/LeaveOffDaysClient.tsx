"use client";

import { useState, useMemo } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { X } from "lucide-react";
import {
  updateLeaveStatusAction,
  createOffDayAction,
  deleteOffDayAction,
  adjustLeaveBalanceAction,
  updateLeavePolicyAction,
} from "@/lib/actions/leave";
import { RecordLeaveModal } from "@/components/modals/RecordLeaveModal";
import { PageHeader, SummaryLine, SegmentedTabs } from "@/components/layout/PageHeader";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LeaveRequestsTab } from "@/components/leave/LeaveRequestsTab";
import { OffDaysTab } from "@/components/leave/OffDaysTab";
import { LeaveBalancesTab } from "@/components/leave/LeaveBalancesTab";
import { LeavePoliciesTab } from "@/components/leave/LeavePoliciesTab";
import { OffDayModal } from "@/components/leave/OffDayModal";
import { AdjustBalanceModal } from "@/components/leave/AdjustBalanceModal";

interface LeaveOffDaysClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  leaveTypes: Array<any>;
  leavePolicies: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  leaveAdjustments: Array<any>;
}

const NOTIFICATION_TTL_MS = 3000;

export function LeaveOffDaysClient({
  currentUser,
  employees,
  leaveTypes,
  leavePolicies: initialPolicies,
  leaveRecords: initialRecords,
  offDays: initialOffDays,
  leaveAdjustments: initialAdjustments,
}: LeaveOffDaysClientProps) {
  const [activeTab, setActiveTab] = useState<"requests" | "offdays" | "balances" | "policies">("requests");
  const [records, setRecords] = useState(initialRecords);
  const [offDays, setOffDays] = useState(initialOffDays);
  const [policies, setPolicies] = useState(initialPolicies);
  const [adjustments] = useState(initialAdjustments);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("ALL");

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showOffDayModal, setShowOffDayModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  const [offDayEmpId, setOffDayEmpId] = useState("");
  const [offDayDate, setOffDayDate] = useState("2024-10-28");
  const [offDayReason, setOffDayReason] = useState("Scheduled day off");

  const [adjEmpId, setAdjEmpId] = useState("");
  const [adjLeaveTypeId, setAdjLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [adjAmount, setAdjAmount] = useState(1);
  const [adjReason, setAdjReason] = useState("Overtime conversion approved by director");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    if (type === "success") setTimeout(() => setNotification(null), NOTIFICATION_TTL_MS);
  }

  const canApproveLeave = currentUser.permissions?.canApproveLeave;
  const canAssignShifts = currentUser.permissions?.canAssignShifts;
  const isSuperuser = currentUser.role === "superuser";

  const empMap = useMemo(() => {
    const map = new Map<string, any>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const leaveTypeMap = useMemo(() => {
    const map = new Map<string, any>();
    leaveTypes.forEach((lt) => map.set(lt.id, lt));
    return map;
  }, [leaveTypes]);

  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);
  const offDaysThisMonth = useMemo(
    () => offDays.filter((od) => od.date.startsWith("2024-10")).length,
    [offDays]
  );

  async function handleUpdateStatus(id: string, newStatus: "approved" | "rejected" | "cancelled") {
    setIsSubmitting(true);
    try {
      const res = await updateLeaveStatusAction(id, newStatus);
      if (res.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus, reviewedBy: currentUser.name } : r))
        );
        notify("success", `Leave request marked as ${newStatus}.`);
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateOffDay() {
    if (!offDayEmpId || !offDayDate) return;
    setIsSubmitting(true);
    try {
      const res = await createOffDayAction({ employeeId: offDayEmpId, date: offDayDate, reason: offDayReason });
      if (res.success) {
        setOffDays((prev) => [res.offDay, ...prev]);
        setShowOffDayModal(false);
        notify("success", "Day off scheduled.");
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to schedule day off.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteOffDay(id: string) {
    setIsSubmitting(true);
    try {
      const res = await deleteOffDayAction(id);
      if (res.success) {
        setOffDays((prev) => prev.filter((od) => od.id !== id));
        notify("success", "Day off removed from calendar.");
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to remove day off.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAdjustBalance() {
    if (!adjEmpId || !adjLeaveTypeId) return;
    setIsSubmitting(true);
    try {
      const res = await adjustLeaveBalanceAction({
        employeeId: adjEmpId,
        leaveTypeId: adjLeaveTypeId,
        amount: Number(adjAmount),
        reason: adjReason,
      });
      if (res.success) {
        setShowAdjustmentModal(false);
        notify("success", "Leave balance adjusted and logged.");
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to adjust balance.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePolicy(policyId: string, allowanceDays: string) {
    setIsSubmitting(true);
    try {
      const res = await updateLeavePolicyAction(policyId, { allowanceDays });
      if (res.success) {
        setPolicies((prev) => prev.map((p) => (p.id === policyId ? { ...p, allowanceDays } : p)));
        notify("success", "Leave policy quota updated.");
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to update policy.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {notification && (
        <Alert
          variant={notification.type === "error" ? "destructive" : "default"}
          className={notification.type === "success" ? "text-foreground" : undefined}
          style={{ marginBottom: 16 }}
        >
          <AlertDescription>{notification.message}</AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setNotification(null)}>
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <PageHeader
        title="Leave"
        subtitle="Requests, days off, and balances."
        actions={
          <>
            {canAssignShifts && (
              <Button variant="secondary" onClick={() => setShowOffDayModal(true)}>
                <span>Schedule day off</span>
              </Button>
            )}
            {canApproveLeave && (
              <Button onClick={() => setShowRecordModal(true)}>
                <span>Record leave</span>
              </Button>
            )}
          </>
        }
        summary={
          <SummaryLine
            parts={[
              { label: "pending", value: pendingCount, critical: pendingCount > 0 },
              { label: "days off this month", value: offDaysThisMonth },
            ]}
          />
        }
      />

      {/* Tabs row */}
      <div className="mb-4">
        <SegmentedTabs
          active={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={[
            { id: "requests", label: "Requests", count: pendingCount },
            { id: "offdays", label: "Days off", count: offDays.length },
            { id: "balances", label: "Balances" },
            { id: "policies", label: "Policies" },
          ]}
        />
      </div>

      {/* ── TAB 1: Requests ── */}
      {activeTab === "requests" && (
        <LeaveRequestsTab
          records={records}
          offDays={offDays}
          employees={employees}
          leaveTypes={leaveTypes}
          empMap={empMap}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          leaveTypeFilter={leaveTypeFilter}
          onLeaveTypeFilterChange={setLeaveTypeFilter}
          canApproveLeave={canApproveLeave}
          isSubmitting={isSubmitting}
          onRecordLeave={() => setShowRecordModal(true)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* ── TAB 2: Days off ── */}
      {activeTab === "offdays" && (
        <OffDaysTab
          offDays={offDays}
          empMap={empMap}
          canAssignShifts={canAssignShifts}
          isSubmitting={isSubmitting}
          onScheduleDayOff={() => setShowOffDayModal(true)}
          onDeleteOffDay={handleDeleteOffDay}
        />
      )}

      {/* ── TAB 3: Balances ── */}
      {activeTab === "balances" && <LeaveBalancesTab employees={employees} records={records} />}

      {/* ── TAB 4: Policies ── */}
      {activeTab === "policies" && (
        <LeavePoliciesTab
          policies={policies}
          leaveTypeMap={leaveTypeMap}
          isSuperuser={isSuperuser}
          isSubmitting={isSubmitting}
          onUpdatePolicy={handleUpdatePolicy}
        />
      )}

      {/* Record Leave Modal */}
      <RecordLeaveModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        employees={employees}
        leaveTypes={leaveTypes}
        onSuccess={() => notify("success", "Leave record logged successfully.")}
      />

      {/* Schedule Day Off Dialog */}
      <OffDayModal
        open={showOffDayModal}
        onOpenChange={setShowOffDayModal}
        employees={employees}
        employeeId={offDayEmpId}
        onEmployeeIdChange={setOffDayEmpId}
        date={offDayDate}
        onDateChange={setOffDayDate}
        reason={offDayReason}
        onReasonChange={setOffDayReason}
        isSubmitting={isSubmitting}
        onSave={handleCreateOffDay}
      />

      {/* Adjust Balance Dialog (Superuser) */}
      <AdjustBalanceModal
        open={showAdjustmentModal}
        onOpenChange={setShowAdjustmentModal}
        employees={employees}
        leaveTypes={leaveTypes}
        employeeId={adjEmpId}
        onEmployeeIdChange={setAdjEmpId}
        leaveTypeId={adjLeaveTypeId}
        onLeaveTypeIdChange={setAdjLeaveTypeId}
        amount={adjAmount}
        onAmountChange={setAdjAmount}
        reason={adjReason}
        onReasonChange={setAdjReason}
        isSubmitting={isSubmitting}
        onSave={handleAdjustBalance}
      />
    </div>
  );
}
