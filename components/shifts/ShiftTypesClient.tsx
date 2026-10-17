"use client";

import { useState } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { Plus, X } from "lucide-react";
import {
  createShiftTypeAction,
  updateShiftTypeAction,
  updateDepartmentSettingsAction,
  saveShiftRequirementAction,
} from "@/lib/actions/shifts";
import {
  PageHeader,
  SummaryLine,
} from "@/components/layout/PageHeader";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  RestRulesPanel,
  type RestRuleEditFields,
} from "@/components/shifts/RestRulesPanel";
import { ShiftTypesTables } from "@/components/shifts/ShiftTypesTables";
import {
  ShiftTypeFormDialog,
  type ShiftTypeFormData,
  type ShiftTypePolicyRows,
} from "@/components/shifts/ShiftTypeFormDialog";

interface ShiftTypesClientProps {
  currentUser: AuthenticatedUser;
  shiftTypes: Array<any>;
  departmentSettings: any;
  shiftRequirements: Array<any>;
}

/** True for pseudo shift types that represent "not working" rather than a shift. */
function isNotWorkingType(st: any): boolean {
  return /off.?day|not.?working|rest day/i.test(st.name || "") || (st.startTime === st.endTime);
}

const NOTIFICATION_TTL_MS = 3000;

const EMPTY_POLICY_ROWS: ShiftTypePolicyRows = {
  RN: { min: 0, max: "" },
  MD: { min: 0, max: "" },
  Tech: { min: 0, max: "" },
  any: { min: 0, max: "" },
};

export function ShiftTypesClient({
  currentUser,
  shiftTypes: initialShiftTypes,
  departmentSettings: initialSettings,
  shiftRequirements: initialRequirements,
}: ShiftTypesClientProps) {
  const [shiftTypes, setShiftTypes] = useState(initialShiftTypes);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [settings, setSettings] = useState(initialSettings);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [editingRestRules, setEditingRestRules] = useState(false);

  // Rest rules — same department settings the roster conflict checker reads.
  const [editFields, setEditFields] = useState<RestRuleEditFields>({
    restHours: 11,
    maxConsecutiveDays: 5,
    maxWeeklyHours: 48,
    maxNights: 7,
    weekStartDay: 1,
    timezone: "America/Chicago",
    pendingLeaveAction: "warn",
    maxWeeklyHoursSeverity: "warn",
    maxNightsSeverity: "warn",
  });

  function openRestRulesEditor() {
    setEditFields({
      restHours: settings.minRestHoursBetweenShifts || 11,
      maxConsecutiveDays: settings.consecutiveShiftsCap || 5,
      maxWeeklyHours: settings.weeklyHoursCap || 48,
      maxNights: settings.maxNightsPerMonth || 7,
      weekStartDay: settings.weekStartDay ?? 1,
      timezone: settings.timezone || "America/Chicago",
      pendingLeaveAction: settings.pendingLeaveAction || "warn",
      maxWeeklyHoursSeverity: settings.maxWeeklyHoursSeverity || "warn",
      maxNightsSeverity: settings.maxNightsSeverity || "warn",
    });
    setEditingRestRules(true);
  }

  const [formData, setFormData] = useState<ShiftTypeFormData>({
    name: "",
    shortCode: "",
    description: "",
    category: "REGULAR",
    startTime: "07:00",
    endTime: "15:30",
    breakDurationMinutes: 30,
    minimumStaffRn: 5,
    minimumStaffMd: 2,
    maximumStaff: 12,
    crossesMidnight: false,
    traumaPremium: false,
  });

  // Per shift-type × designation staffing POLICY (editable per role)
  const [policyRows, setPolicyRows] = useState<ShiftTypePolicyRows>(EMPTY_POLICY_ROWS);

  function loadPolicyRows(shiftTypeId: string) {
    const rows: ShiftTypePolicyRows = {
      RN: { min: 0, max: "" },
      MD: { min: 0, max: "" },
      Tech: { min: 0, max: "" },
      any: { min: 0, max: "" },
    };
    for (const roleId of ["RN", "MD", "Tech"] as const) {
      const existing = requirements.find(
        (r) => r.shiftTypeId === shiftTypeId && r.designation === roleId
      );
      rows[roleId] = {
        min: existing ? existing.minStaff : 0,
        max: existing && existing.maxStaff != null ? String(existing.maxStaff) : "",
      };
    }
    const anyRow = requirements.find(
      (r) => r.shiftTypeId === shiftTypeId && r.designation === "any"
    );
    rows.any = {
      min: anyRow ? anyRow.minStaff : 0,
      max: anyRow && anyRow.maxStaff != null ? String(anyRow.maxStaff) : "",
    };
    setPolicyRows(rows);
  }

  async function savePolicyRows(shiftTypeId: string) {
    for (const designation of Object.keys(policyRows)) {
      const row = policyRows[designation];
      if (!row) continue;
      const existing = requirementOf(shiftTypeId, designation);
      const changed =
        !existing ||
        existing.minStaff !== row.min ||
        String(existing.maxStaff ?? "") !== row.max;
      if (!changed) continue;
      const res = await saveShiftRequirementAction({
        shiftTypeId,
        designation,
        minStaff: row.min,
        maxStaff: row.max ? Number(row.max) : null,
      });
      if (res.success) {
        setRequirements((prev) => {
          const i = prev.findIndex(
            (r) => r.shiftTypeId === shiftTypeId && r.designation === designation
          );
          if (i >= 0) {
            const copy = [...prev];
            copy[i] = res.requirement;
            return copy;
          }
          return [...prev, res.requirement];
        });
      }
    }
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    if (type === "success") setTimeout(() => setNotification(null), NOTIFICATION_TTL_MS);
  }

  const canManageShifts = currentUser.permissions?.canManageShifts;

  // Split real shifts from "not working" pseudo types
  const realShifts = shiftTypes.filter((st) => !isNotWorkingType(st));
  const notWorking = shiftTypes.filter(isNotWorkingType);
  const hasMultipleCategories = new Set(realShifts.map((s) => s.category || "REGULAR")).size > 1;
  const inactiveCount = shiftTypes.filter((s) => !s.active).length;

  async function handleSaveRestRules() {
    setIsSubmitting(true);
    try {
      const res = await updateDepartmentSettingsAction({
        minRestHoursBetweenShifts: editFields.restHours,
        consecutiveShiftsCap: editFields.maxConsecutiveDays,
        weeklyHoursCap: editFields.maxWeeklyHours,
        maxNightsPerMonth: editFields.maxNights,
        weekStartDay: editFields.weekStartDay,
        timezone: editFields.timezone,
        pendingLeaveAction: editFields.pendingLeaveAction,
        maxWeeklyHoursSeverity: editFields.maxWeeklyHoursSeverity,
        maxNightsSeverity: editFields.maxNightsSeverity,
      });
      if (res.success) {
        setSettings(res.settings);
        setEditingRestRules(false);
        notify("success", "Rest rules saved — the roster, dashboard and conflicts now use them.");
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to update rest rules.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSaveShiftType = async () => {
    setIsSubmitting(true);
    const payload = {
      name: formData.name,
      shortCode: formData.shortCode,
      description: formData.description,
      color: "#00685f",
      category: formData.category,
      startTime: formData.startTime,
      endTime: formData.endTime,
      breakDurationMinutes: Number(formData.breakDurationMinutes),
      minimumStaffRn: Number(formData.minimumStaffRn),
      minimumStaffMd: Number(formData.minimumStaffMd),
      maximumStaff: Number(formData.maximumStaff),
      crossesMidnight: Boolean(formData.crossesMidnight),
      traumaPremium: Boolean(formData.traumaPremium),
    };
    try {
      if (editingShift) {
        const res = await updateShiftTypeAction(editingShift.id, payload);
        if (res.success) {
          await savePolicyRows(editingShift.id); // keep per-role policy in sync
          setShiftTypes((prev) => prev.map((s) => (s.id === editingShift.id ? res.shiftType : s)));
          setEditingShift(null);
          setShowCreateModal(false);
          notify("success", "Shift type updated.");
        }
      } else {
        const res = await createShiftTypeAction(payload);
        if (res.success) {
          await savePolicyRows(res.shiftType.id);
          setShiftTypes((prev) => [...prev, res.shiftType]);
          setShowCreateModal(false);
          notify("success", "New shift type created.");
        }
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to save shift type.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requirementOf = (shiftTypeId: string, designation: string) =>
    requirements.find((r) => r.shiftTypeId === shiftTypeId && r.designation === designation);

  const openEditModal = (shift: any) => {
    setEditingShift(shift);
    loadPolicyRows(shift.id);
    setFormData({
      name: shift.name,
      shortCode: shift.shortCode,
      description: shift.description || "",
      category: shift.category || "REGULAR",
      startTime: shift.startTime || "07:00",
      endTime: shift.endTime || "15:30",
      breakDurationMinutes: shift.breakDurationMinutes || 0,
      minimumStaffRn: shift.minimumStaffRn || 0,
      minimumStaffMd: shift.minimumStaffMd || 0,
      maximumStaff: shift.maximumStaff || 12,
      crossesMidnight: Boolean(shift.crossesMidnight),
      traumaPremium: Boolean(shift.traumaPremium),
    });
    setShowCreateModal(true);
  };

  const openCreateModal = () => {
    setEditingShift(null);
    setPolicyRows(EMPTY_POLICY_ROWS);
    setFormData({
      name: "",
      shortCode: "",
      description: "",
      category: "REGULAR",
      startTime: "07:00",
      endTime: "15:30",
      breakDurationMinutes: 30,
      minimumStaffRn: 5,
      minimumStaffMd: 2,
      maximumStaff: 12,
      crossesMidnight: false,
      traumaPremium: false,
    });
    setShowCreateModal(true);
  };

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
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss"
              onClick={() => setNotification(null)}
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <PageHeader
        title="Shift types"
        subtitle="Shift times, minimum staffing, and the rest rules used to flag conflicts."
        actions={
          canManageShifts && (
            <Button onClick={openCreateModal} className="h-10 rounded-xl px-5">
              <Plus data-icon="inline-start" />
              <span>Add shift type</span>
            </Button>
          )
        }
        summary={
          <SummaryLine
            parts={[
              { label: "shift types", value: realShifts.length },
              ...(hasMultipleCategories
                ? [{ label: "categories", value: new Set(realShifts.map((s) => s.category)).size }]
                : []),
              ...(inactiveCount > 0 ? [{ label: "inactive", value: inactiveCount }] : []),
            ]}
          />
        }
      />

      <RestRulesPanel
        settings={settings}
        isEditing={editingRestRules}
        editFields={editFields}
        onEditFieldsChange={setEditFields}
        isSubmitting={isSubmitting}
        canManage={canManageShifts}
        onToggleEdit={() => {
          if (editingRestRules) handleSaveRestRules();
          else openRestRulesEditor();
        }}
      />

      <ShiftTypesTables
        realShifts={realShifts}
        notWorking={notWorking}
        hasMultipleCategories={hasMultipleCategories}
        canManage={canManageShifts}
        onEdit={openEditModal}
        onAdd={openCreateModal}
      />

      <ShiftTypeFormDialog
        open={showCreateModal}
        onOpenChange={(next) => {
          if (next) openCreateModal();
          else setShowCreateModal(false);
        }}
        editingShift={editingShift}
        formData={formData}
        onFormDataChange={setFormData}
        policyRows={policyRows}
        onPolicyRowsChange={setPolicyRows}
        isSubmitting={isSubmitting}
        onSave={handleSaveShiftType}
      />
    </div>
  );
}
