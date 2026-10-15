"use client";

import { useState } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { Edit2, Check, X, Plus } from "lucide-react";
import {
  createShiftTypeAction,
  updateShiftTypeAction,
  toggleShiftTypeActiveAction,
  updateDepartmentSettingsAction,
  saveShiftRequirementAction,
} from "@/lib/actions/shifts";
import {
  PageHeader,
  SummaryLine,
  EmptyState,
  zSelectStyle,
  zFieldStyle,
} from "@/components/layout/PageHeader";
import { computedNetHours, shiftTintOf } from "@/lib/schedule-cycle";

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
  // EVERY engine parameter is customizable here (one stored value, read everywhere).
  const [editFields, setEditFields] = useState({
    restHours: 11,
    maxConsecutiveDays: 5,
    maxWeeklyHours: 48,
    maxNights: 7,
    weekStartDay: 1,
    timezone: "America/Chicago",
    pendingLeaveAction: "warn" as "warn" | "ignore" | "block",
    maxWeeklyHoursSeverity: "warn" as "warn" | "block",
    maxNightsSeverity: "warn" as "warn" | "block",
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
        setNotification({ type: "success", message: "Rest rules saved — the roster, dashboard and conflicts now use them." });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update rest rules." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const [formData, setFormData] = useState({
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
  const [policyRows, setPolicyRows] = useState<Record<string, { min: number; max: string }>>({});

  function loadPolicyRows(shiftTypeId: string) {
    const rows: Record<string, { min: number; max: string }> = {};
    for (const d of ["RN", "MD", "Tech"] as const) {
      const existing = requirements.find((r) => r.shiftTypeId === shiftTypeId && r.designation === d);
      rows[d] = {
        min: existing ? existing.minStaff : 0,
        max: existing && existing.maxStaff != null ? String(existing.maxStaff) : "",
      };
    }
    const anyRow = requirements.find((r) => r.shiftTypeId === shiftTypeId && r.designation === "any");
    rows["any"] = {
      min: anyRow ? anyRow.minStaff : 0,
      max: anyRow && anyRow.maxStaff != null ? String(anyRow.maxStaff) : "",
    };
    setPolicyRows(rows);
  }

  async function savePolicyRows(shiftTypeId: string) {
    for (const designation of ["RN", "MD", "Tech", "any"]) {
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
          const i = prev.findIndex((r) => r.shiftTypeId === shiftTypeId && r.designation === designation);
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

  const canManageShifts = currentUser.permissions?.canManageShifts;

  // Split real shifts from "not working" pseudo types
  const realShifts = shiftTypes.filter((st) => !isNotWorkingType(st));
  const notWorking = shiftTypes.filter(isNotWorkingType);
  const hasMultipleCategories = new Set(realShifts.map((s) => s.category || "REGULAR")).size > 1;
  const inactiveCount = shiftTypes.filter((s) => !s.active).length;

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setIsSubmitting(true);
    try {
      const res = await toggleShiftTypeActiveAction(id, !currentActive);
      if (res.success) {
        setShiftTypes((prev) => prev.map((s) => (s.id === id ? { ...s, active: !currentActive } : s)));
        setNotification({
          type: "success",
          message: `Shift type ${!currentActive ? "activated" : "deactivated"}. Existing assignments preserved.`,
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to toggle status." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveShiftType = async (e: React.FormEvent) => {
    e.preventDefault();
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
          setNotification({ type: "success", message: "Shift type updated." });
          setTimeout(() => setNotification(null), 3000);
        }
      } else {
        const res = await createShiftTypeAction(payload);
        if (res.success) {
          await savePolicyRows(res.shiftType.id);
          setShiftTypes((prev) => [...prev, res.shiftType]);
          setShowCreateModal(false);
          setNotification({ type: "success", message: "New shift type created." });
          setTimeout(() => setNotification(null), 3000);
        }
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save shift type." });
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
        <div
          style={{
            background: notification.type === "success" ? "var(--linen)" : "var(--critical-bg)",
            color: notification.type === "success" ? "var(--ink)" : "var(--critical-text)",
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      <PageHeader
        title="Shift types"
        subtitle="Shift times, minimum staffing, and the rest rules used to flag conflicts."
        actions={
          canManageShifts && (
            <button onClick={openCreateModal} className="zbtn zbtn-primary">
              <Plus style={{ width: 15, height: 15 }} />
              <span>Add shift type</span>
            </button>
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

      {/* ── SECTION 1: Rest rules (one quiet panel, real shared values) ── */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", margin: 0 }}>Rest rules</h2>
            <p style={{ fontSize: 14, color: "var(--ink-secondary)", margin: "4px 0 0" }}>
              Used to flag conflicts on the roster.
            </p>
          </div>
          {canManageShifts && (
            <button
              onClick={() => {
                if (editingRestRules) handleSaveRestRules();
                else openRestRulesEditor();
              }}
              disabled={isSubmitting}
              className="zbtn zbtn-text"
              style={{ fontSize: 13 }}
            >
              {editingRestRules ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Check style={{ width: 14, height: 14 }} /> Save
                </span>
              ) : (
                "Edit"
              )}
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 20,
          }}
        >
          {editingRestRules ? (
            <>
              <RestRuleEditor label="Minimum rest between shifts" value={editFields.restHours} onChange={(v) => setEditFields({ ...editFields, restHours: v })} unit="h" />
              <RestRuleEditor label="Maximum days in a row" value={editFields.maxConsecutiveDays} onChange={(v) => setEditFields({ ...editFields, maxConsecutiveDays: v })} unit="days" />
              <RestRuleEditor label="Maximum nights per month" value={editFields.maxNights} onChange={(v) => setEditFields({ ...editFields, maxNights: v })} unit="nights" />
              <RestRuleEditor label="Maximum hours per week" value={editFields.maxWeeklyHours} onChange={(v) => setEditFields({ ...editFields, maxWeeklyHours: v })} unit="h" />
              <RestRuleEditor label="Week starts on" value={editFields.weekStartDay} onChange={(v) => setEditFields({ ...editFields, weekStartDay: v })} unit="(0=Sun, 1=Mon)" />
              <RestRuleEditor label="Max-hours severity" value={editFields.maxWeeklyHoursSeverity === "block" ? 1 : 0} onChange={(v) => setEditFields({ ...editFields, maxWeeklyHoursSeverity: v === 1 ? "block" : "warn" })} unit="(0=warn, 1=block)" />
              <RestRuleEditor label="Max-nights severity" value={editFields.maxNightsSeverity === "block" ? 1 : 0} onChange={(v) => setEditFields({ ...editFields, maxNightsSeverity: v === 1 ? "block" : "warn" })} unit="(0=warn, 1=block)" />
              <RestRuleEditor label="Pending leave blocks" value={editFields.pendingLeaveAction === "block" ? 1 : editFields.pendingLeaveAction === "ignore" ? 0 : 2} onChange={(v) => setEditFields({ ...editFields, pendingLeaveAction: v === 1 ? "block" : v === 0 ? "ignore" : "warn" })} unit="(0=ignore, 1=block, 2=warn)" />
              <div>
                <div style={{ fontSize: 13, color: "var(--ink-tertiary)", marginBottom: 4 }}>Timezone</div>
                <select
                  value={editFields.timezone}
                  onChange={(e) => setEditFields({ ...editFields, timezone: e.target.value })}
                  style={{ ...zSelectStyle, width: "100%", height: 36 }}
                >
                  {["America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "UTC"].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <RestRule label="Minimum rest between shifts" value={settings.minRestHoursBetweenShifts || 11} unit="h" />
              <RestRule label="Maximum days in a row" value={settings.consecutiveShiftsCap || 5} unit="days" />
              <RestRule label="Maximum nights per month" value={settings.maxNightsPerMonth || 7} unit="nights" />
              <RestRule label="Maximum hours per week" value={settings.weeklyHoursCap || 48} unit="h" />
              <RestRule label="Week starts on" value={settings.weekStartDay ?? 1} unit="(0=Sun, 1=Mon)" />
              <RestRule label="Hours cap severity" value={settings.maxWeeklyHoursSeverity === "block" ? "block" : "warn"} unit={""} />
              <RestRule label="Nights cap severity" value={settings.maxNightsSeverity === "block" ? "block" : "warn"} unit={""} />
              <RestRule label="Pending leave" value={settings.pendingLeaveAction || "warn"} unit={""} />
              <RestRule label="Timezone" value={settings.timezone || "UTC"} unit={""} />
            </>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Shift type table ── */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div className="overflow-x-auto">
          <table className="ztable">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Shift</th>
                {hasMultipleCategories && <th style={{ textAlign: "left", width: 130 }}>Type</th>}
                <th style={{ textAlign: "center", width: 120 }}>Hours</th>
                <th className="num" style={{ width: 100 }}>Paid hours</th>
                <th className="num" style={{ width: 90 }}>Break</th>
                <th style={{ textAlign: "left", width: 140 }}>Min staffing</th>
                {canManageShifts && <th style={{ width: 90 }} />}
              </tr>
            </thead>
            <tbody>
              {realShifts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No shift types"
                      hint="Add one to start building rosters."
                      action={
                        canManageShifts && (
                          <button onClick={openCreateModal} className="zbtn zbtn-secondary" style={{ fontSize: 13, padding: "8px 14px" }}>
                            Add shift type
                          </button>
                        )
                      }
                    />
                  </td>
                </tr>
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
                    <tr key={st.id} style={{ position: "relative" }}>
                      <td>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}
                          title={st.description && st.description !== "Emergency department clinical shift." ? st.description : undefined}
                        >
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              background: tintBg,
                              border: "1px solid var(--ink-border-row)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 500,
                              color: "var(--ink)",
                              flexShrink: 0,
                            }}
                          >
                            {st.shortCode}
                          </span>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>
                              {st.name}
                            </div>
                            {!st.active && (
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)", background: "var(--linen)", border: "1px solid var(--ink-border-row)", borderRadius: 12, padding: "2px 8px", display: "inline-block", marginTop: 2 }}>
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {hasMultipleCategories && (
                        <td style={{ fontSize: 13, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                          {st.category || "REGULAR"}
                        </td>
                      )}
                      <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--ink-secondary)" }}>
                        {st.startTime}–{st.endTime}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {paidHours.toFixed(1)} h
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                        {st.breakDurationMinutes ? `${st.breakDurationMinutes} min` : "—"}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--ink)" }}>
                        {st.minimumStaffRn || 0} RN · {st.minimumStaffMd || 0} MD
                      </td>
                      {canManageShifts && (
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => openEditModal(st)} className="zbtn zbtn-text" style={{ fontSize: 13 }}>
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Not working pseudo-types (e.g. Off Day) — not shifts, shown separately */}
      {notWorking.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-tertiary)", marginBottom: 8 }}>
            Not working
          </div>
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--ink-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div className="overflow-x-auto">
              <table className="ztable">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Type</th>
                    <th style={{ textAlign: "left" }}>Purpose</th>
                    {canManageShifts && <th style={{ width: 90 }} />}
                  </tr>
                </thead>
                <tbody>
                  {notWorking.map((st) => (
                    <tr key={st.id}>
                      <td style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap" }}>
                        {st.name}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                        Marks a day a person is deliberately not rostered. No hours, break, or staffing minimums.
                      </td>
                      {canManageShifts && (
                        <td style={{ textAlign: "right" }}>
                          <button onClick={() => openEditModal(st)} className="zbtn zbtn-text" style={{ fontSize: 13 }}>
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Shift Type Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(18, 23, 24, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="zelt-surface"
            style={{ maxWidth: 500, width: "100%", padding: 24, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--ink-border)" }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", margin: 0 }}>
                {editingShift ? "Edit shift type" : "Add shift type"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-secondary)", marginLeft: "auto", display: "flex" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveShiftType} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Shift name">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
                <Field label="Short code (1–3 chars)">
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.shortCode}
                    onChange={(e) => setFormData({ ...formData, shortCode: e.target.value.toUpperCase() })}
                    required
                    style={{ ...zFieldStyle, width: "100%", textTransform: "uppercase" }}
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Start time">
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
                <Field label="End time">
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
                <Field label="Break (min)">
                  <input
                    type="number"
                    value={formData.breakDurationMinutes}
                    onChange={(e) => setFormData({ ...formData, breakDurationMinutes: Number(e.target.value) })}
                    required
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Min RNs">
                  <input
                    type="number"
                    min={0}
                    value={formData.minimumStaffRn}
                    onChange={(e) => setFormData({ ...formData, minimumStaffRn: Number(e.target.value) })}
                    required
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
                <Field label="Min MDs">
                  <input
                    type="number"
                    min={0}
                    value={formData.minimumStaffMd}
                    onChange={(e) => setFormData({ ...formData, minimumStaffMd: Number(e.target.value) })}
                    required
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
                <Field label="Max per shift">
                  <input
                    type="number"
                    value={formData.maximumStaff}
                    onChange={(e) => setFormData({ ...formData, maximumStaff: Number(e.target.value) })}
                    style={{ ...zFieldStyle, width: "100%" }}
                  />
                </Field>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                  <input
                    type="checkbox"
                    checked={formData.crossesMidnight}
                    onChange={(e) => setFormData({ ...formData, crossesMidnight: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "var(--ink)" }}
                  />
                  <span>Overnight shift (crosses midnight)</span>
                </label>
              </div>

              {/* Per-designation staffing policy — deviations from the type default */}
              <div style={{ paddingTop: 8, borderTop: "1px solid var(--ink-border)" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                  Staffing policy (per role)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: 8, fontSize: 12, color: "var(--ink-tertiary)", marginBottom: 4 }}>
                  <span>Role</span>
                  <span>Minimum</span>
                  <span>Max per shift</span>
                </div>
                {(["RN", "MD", "Tech", "any"] as const).map((role) => (
                  <div key={role} style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                      {role === "any" ? "Any" : role}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={policyRows[role]?.min ?? 0}
                      onChange={(e) =>
                        setPolicyRows({
                          ...policyRows,
                          [role]: { ...policyRows[role], min: Number(e.target.value) || 0 },
                        })
                      }
                      style={{ ...zFieldStyle, height: 34 }}
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={policyRows[role]?.max ?? ""}
                      onChange={(e) =>
                        setPolicyRows({
                          ...policyRows,
                          [role]: { ...policyRows[role], max: e.target.value },
                        })
                      }
                      style={{ ...zFieldStyle, height: 34 }}
                    />
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "var(--ink-tertiary)", marginTop: 4 }}>
                  Empty “Max” = no limit. “Any” fills leftover slots with any designation.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 14, borderTop: "1px solid var(--ink-border)" }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="zbtn zbtn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="zbtn zbtn-primary" style={{ padding: "10px 20px", fontSize: 15 }}>
                  {editingShift ? "Save changes" : "Add shift type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RestRule({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--ink-tertiary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
        {value} {unit}
      </div>
    </div>
  );
}

function RestRuleEditor({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--ink-tertiary)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ...zFieldStyle, width: 80, height: 36 }}
        />
        <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>{unit}</span>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--ink)",
  display: "block",
  marginBottom: 4,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
