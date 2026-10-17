"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import {
  createEmployeeAction,
  updateEmployeeAction,
  archiveEmployeeAction,
  restoreEmployeeAction,
  hardDeleteEmployeeAction,
} from "@/lib/actions/employees";
import { adjustLeaveBalanceAction } from "@/lib/actions/leave";
import { ExportModal } from "@/components/modals/ExportModal";
import { QuickAssignModal } from "@/components/modals/QuickAssignModal";
import { PageHeader, SummaryLine } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmployeeToolbar } from "@/components/employees/EmployeeToolbar";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { EmployeeDetailSheet } from "@/components/employees/EmployeeDetailSheet";
import {
  EmployeeFormDialog,
  type EmployeeFormData,
  type EmployeeExceptionFields,
} from "@/components/employees/EmployeeFormDialog";
import { AdjustBalanceDialog } from "@/components/employees/AdjustBalanceDialog";
import { credentialStateOf } from "@/components/employees/employeeUtils";
import { netHoursOf } from "@/lib/schedule-cycle";

interface EmployeeDirectoryClientProps {
  currentUser: AuthenticatedUser;
  initialEmployees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  settings: any;
  units: Array<any>;
  roles: Array<any>;
}

export function EmployeeDirectoryClient({
  currentUser,
  initialEmployees,
  shiftTypes,
  assignments,
  leaveRecords,
  offDays,
  settings,
  units,
  roles,
}: EmployeeDirectoryClientProps) {
  void offDays;
  const [employees, setEmployees] = useState(initialEmployees);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "on_leave" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || "");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);

  // Dropdown options come from the admin-managed dictionaries (Settings → Units / Roles)
  const roleOptions = (roles.length > 0 ? roles : [{ name: "Staff Critical Care RN" }]) as Array<any>;
  const unitOptions = (units.length > 0 ? units : [{ name: "Trauma Bay 1-4 • Red Team" }]) as Array<any>;
  const defaultRole = roleOptions[0]?.name || "";
  const defaultUnit = unitOptions[0]?.name || "";

  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeId: "",
    fullName: "",
    designation: defaultRole,
    unit: defaultUnit,
    phoneNumber: "",
    email: "",
    dateJoined: "2024-01-15",
    credentials: "",
  });

  // Per-employee scheduling exceptions (empty string = inherit department default)
  const [exceptionFields, setExceptionFields] = useState<EmployeeExceptionFields>({
    maxHoursPerWeek: "",
    canWorkNights: true,
  });

  const [adjustAmount, setAdjustAmount] = useState(2.0);
  const [adjustType, setAdjustType] = useState("lt_annual");
  const [adjustReason, setAdjustReason] = useState("Overtime hours converted to leave quota");

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || employees[0];

  const canEditEmployees = currentUser.permissions.canEditEmployees;
  const canAssignShifts = currentUser.permissions.canAssignShifts;
  const canExportReports = currentUser.permissions.canExportReports;
  const canDeleteEmployees = currentUser.permissions.canDeleteEmployees;
  const weeklyHoursCap = settings?.weeklyHoursCap || 48;

  // ── Tabs: real counts from employee records ──
  const tabCounts = {
    all: employees.length,
    active: employees.filter((e) => e.employmentStatus === "active").length,
    on_leave: employees.filter((e) => e.employmentStatus === "on_leave").length,
    archived: employees.filter((e) => e.employmentStatus === "archived").length,
  };

  // ── Quiet summary: only real, visible problems go red ──
  const onLeaveCount = tabCounts.on_leave;
  const unverifiable = employees.filter(
    (e) => e.employmentStatus === "active" && credentialStateOf(e) !== "verified"
  ).length;
  const overCap = employees.filter((emp) => weekHoursOf(emp) > weeklyHoursCap).length;

  function weekHoursOf(emp: any): number {
    return assignments
      .filter((a) => a.employeeId === emp.id && a.status !== "cancelled")
      .reduce((acc, a) => acc + netHoursOf(shiftTypes.find((s) => s.id === a.shiftTypeId)), 0);
  }

  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter !== "all" && emp.employmentStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q) ||
        emp.unit.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedUnit !== "ALL" && !emp.unit.includes(selectedUnit)) return false;
    if (selectedRole !== "ALL") {
      if (selectedRole === "MD" && !emp.designation.includes("MD")) return false;
      if (selectedRole === "RN" && !emp.designation.includes("RN")) return false;
      if (selectedRole === "TECH" && !emp.designation.includes("Tech") && !emp.designation.includes("Paramedic"))
        return false;
    }
    return true;
  });

  // ── Handlers (unchanged behaviour) ──
  async function handleCreateClinician() {
    try {
      const res = await createEmployeeAction({
        employeeId: formData.employeeId,
        fullName: formData.fullName,
        designation: formData.designation,
        unit: formData.unit,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        dateJoined: formData.dateJoined,
        credentials: formData.credentials.split(",").filter((c) => c.trim()).map((c) => ({
          name: c.trim(),
          issuer: "AHA / Board Certification",
          expires: "2026-12-31",
          status: "Active & Valid",
        })),
      });
      setEmployees((prev) => [res.employee, ...prev]);
      setSelectedEmployeeId(res.employee.id);
      setIsAddModalOpen(false);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  }

  async function handleUpdateClinician() {
    if (!selectedEmployee) return;
    try {
      const res = await updateEmployeeAction(selectedEmployee.id, {
        fullName: formData.fullName,
        designation: formData.designation,
        unit: formData.unit,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        // Scheduling exceptions — per-employee overrides of the department rules
        maxHoursPerWeek:
          exceptionFields.maxHoursPerWeek.trim() === ""
            ? null
            : Number(exceptionFields.maxHoursPerWeek) || null,
        canWorkNights: exceptionFields.canWorkNights,
      } as any);
      setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? res.employee : e)));
      setIsEditModalOpen(false);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  }

  async function handleArchiveToggle() {
    if (!selectedEmployee) return;
    try {
      if (selectedEmployee.employmentStatus === "archived") {
        const res = await restoreEmployeeAction(selectedEmployee.id);
        setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? res.employee : e)));
      } else {
        const res = await archiveEmployeeAction(selectedEmployee.id);
        setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? res.employee : e)));
      }
    } catch (error: any) {
      alert("Action failed: " + error.message);
    }
  }

  async function handleDeleteClinician() {
    if (!selectedEmployee) return;
    if (
      !confirm(
        `Permanently delete ${selectedEmployee.fullName} (${selectedEmployee.employeeId})?\n\nThis erases their ENTIRE history: every shift assignment, leave record, off-day and balance adjustment. It cannot be undone.\n\nIf you only want to take them off the roster without destroying records, use Archive instead.`
      )
    )
      return;
    try {
      await hardDeleteEmployeeAction(selectedEmployee.id);
      setIsDetailOpen(false);
      setEmployees((prev) => prev.filter((e) => e.id !== selectedEmployee.id));
    } catch (error: any) {
      alert("Action failed: " + error.message);
    }
  }

  async function handleAdjustBalance() {
    if (!selectedEmployee) return;
    try {
      await adjustLeaveBalanceAction({
        employeeId: selectedEmployee.id,
        leaveTypeId: adjustType,
        amount: adjustAmount,
        reason: adjustReason,
      });
      alert(`Updated leave quota for ${selectedEmployee.fullName} by ${adjustAmount} days.`);
      setIsAdjustBalanceOpen(false);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  }

  function openEditModal() {
    if (!selectedEmployee) return;
    setFormData({
      employeeId: selectedEmployee.employeeId,
      fullName: selectedEmployee.fullName,
      designation: selectedEmployee.designation,
      unit: selectedEmployee.unit,
      phoneNumber: selectedEmployee.phoneNumber,
      email: selectedEmployee.email,
      dateJoined: selectedEmployee.dateJoined,
      credentials: "ACLS, TNCC",
    });
    setExceptionFields({
      maxHoursPerWeek:
        selectedEmployee.maxHoursPerWeek != null ? String(selectedEmployee.maxHoursPerWeek) : "",
      canWorkNights: selectedEmployee.canWorkNights !== false,
    });
    setIsEditModalOpen(true);
  }

  function openAddModal() {
    setFormData({
      employeeId: `NUR-${Math.floor(200 + Math.random() * 800)}`,
      fullName: "",
      designation: defaultRole,
      unit: defaultUnit,
      phoneNumber: "",
      email: "",
      dateJoined: new Date().toISOString().split("T")[0],
      credentials: "",
    });
    setIsAddModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Everyone on the ED roster, with hours and credentials."
        actions={
          <>
            {canExportReports && (
              <Button variant="secondary" onClick={() => setIsExportOpen(true)}>
                <Download data-icon="inline-start" />
                <span>Export</span>
              </Button>
            )}
            {canEditEmployees && (
              <Button onClick={openAddModal}>
                <span>Add employee</span>
              </Button>
            )}
          </>
        }
        summary={
          <SummaryLine
            parts={[
              { label: "staff", value: tabCounts.all },
              { label: "on duty", value: tabCounts.active },
              { label: "on leave", value: onLeaveCount, critical: onLeaveCount > 0 },
              ...(overCap > 0 ? [{ label: `over ${weeklyHoursCap}h week`, value: overCap, critical: true }] : []),
              ...(unverifiable > 0
                ? [{ label: "credentials not verified", value: unverifiable, critical: true }]
                : []),
            ]}
          />
        }
      />

      <EmployeeToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        tabCounts={tabCounts}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        employees={employees}
        onClearFilters={() => {
          setSearchQuery("");
          setSelectedUnit("ALL");
          setSelectedRole("ALL");
        }}
      />

      <EmployeeTable
        filteredEmployees={filteredEmployees}
        assignments={assignments}
        shiftTypes={shiftTypes}
        weeklyHoursCap={weeklyHoursCap}
        onOpenDetail={(emp) => {
          setSelectedEmployeeId(emp.id);
          setIsDetailOpen(true);
        }}
      />

      {/* ── Detail drawer ── */}
      {selectedEmployee && (
      <EmployeeDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        selectedEmployee={selectedEmployee}
        assignments={assignments}
        shiftTypes={shiftTypes}
        leaveRecords={leaveRecords}
        canEditEmployees={canEditEmployees}
        canAssignShifts={canAssignShifts}
        canDeleteEmployees={canDeleteEmployees}
        onEdit={openEditModal}
        onQuickAssign={() => setIsQuickAssignOpen(true)}
        onArchiveToggle={handleArchiveToggle}
        onDelete={handleDeleteClinician}
      />
      )}

      {/* ── Add / Edit Clinician Dialog ── */}
      <EmployeeFormDialog
        open={isAddModalOpen || isEditModalOpen}
        onOpenChange={(next) => {
          if (!next) {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
        isAdd={isAddModalOpen}
        editingName={selectedEmployee?.fullName}
        formData={formData}
        onFormDataChange={setFormData}
        roleOptions={roleOptions}
        unitOptions={unitOptions}
        exceptionFields={exceptionFields}
        onExceptionFieldsChange={setExceptionFields}
        onSave={() => (isAddModalOpen ? handleCreateClinician() : handleUpdateClinician())}
      />

      {/* Adjust Leave Balance Dialog */}
      <AdjustBalanceDialog
        open={isAdjustBalanceOpen && Boolean(selectedEmployee)}
        onOpenChange={setIsAdjustBalanceOpen}
        employeeName={selectedEmployee?.fullName || ""}
        leaveTypeId={adjustType}
        onLeaveTypeIdChange={setAdjustType}
        amount={adjustAmount}
        onAmountChange={setAdjustAmount}
        reason={adjustReason}
        onReasonChange={setAdjustReason}
        onSave={handleAdjustBalance}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        reportTitle="Clinical Staff Directory & Credential Index"
        reportCode="RPT-01"
      />
      <QuickAssignModal
        isOpen={isQuickAssignOpen}
        onClose={() => setIsQuickAssignOpen(false)}
        employees={employees}
        shiftTypes={shiftTypes}
        preselectedEmployeeId={selectedEmployee?.id}
      />
    </div>
  );
}
