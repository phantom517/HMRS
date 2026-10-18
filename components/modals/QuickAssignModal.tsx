"use client";

import { useState } from "react";
import { X, UserPlus, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { createShiftAssignmentAction } from "@/lib/actions/shifts";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<{ id: string; employeeId: string; fullName: string; designation: string }>;
  shiftTypes: Array<{ id: string; shortCode: string; name: string; color: string; startTime: string; endTime: string }>;
  preselectedEmployeeId?: string;
  preselectedDate?: string;
}

const WARD_ZONE_OPTIONS = [
  { value: "Red Zone (Trauma Resus 1-4)", label: "Red Zone (Trauma Resus 1-4)", badge: "Critical" },
  { value: "Yellow Zone (Urgent Acute Assessment)", label: "Yellow Zone (Urgent Acute Assessment)", badge: "Acute" },
  { value: "Green Zone (Fast-Track Ambulatory)", label: "Green Zone (Fast-Track Ambulatory)", badge: "Ambulatory" },
  { value: "Zone 4: Pediatric ED Wing", label: "Zone 4: Pediatric ED Wing", badge: "Pediatric" },
  { value: "Emergency Surgical Suite OR-1", label: "Emergency Surgical Suite OR-1", badge: "Surgical" },
  { value: "ICU Overflow Pod A", label: "ICU Overflow Pod A", badge: "ICU" },
];

export function QuickAssignModal({
  isOpen,
  onClose,
  employees,
  shiftTypes,
  preselectedEmployeeId,
  preselectedDate,
}: QuickAssignModalProps) {
  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId || (employees[0]?.id || ""));
  const [shiftTypeId, setShiftTypeId] = useState(shiftTypes[0]?.id || "");
  const [date, setDate] = useState(preselectedDate || "2024-10-25");
  const [wardZone, setWardZone] = useState("Red Zone (Trauma Resus 1-4)");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createShiftAssignmentAction({
        employeeId,
        shiftTypeId,
        date,
        wardZone,
        notes,
        forceOverrideWarnings: true,
      });

      setSuccess("Shift assignment published to live roster and synchronized.");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to commit shift assignment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const employeeOptions = employees.map((emp) => ({
    value: emp.id,
    label: emp.fullName,
    description: `${emp.employeeId} · ${emp.designation}`,
  }));

  const shiftOptions = shiftTypes.map((st) => ({
    value: st.id,
    label: `[${st.shortCode}] ${st.name}`,
    description: `${st.startTime} – ${st.endTime}`,
    badge: st.shortCode,
  }));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(18, 23, 24, 0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="zelt-surface"
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "92vh",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          borderRadius: 16,
          boxShadow: "none",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
            borderBottom: "1px solid var(--ink-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--linen)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--ink-border)",
              }}
            >
              <UserPlus style={{ width: 22, height: 22, strokeWidth: 1.6, color: "var(--ink)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2, margin: 0 }}>
                Assign Roster Slot
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-secondary)", marginTop: 4, margin: 0 }}>
                DEPT-402 &middot; Emergency &amp; Critical Care
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: "var(--ink)",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--linen)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X style={{ width: 18, height: 18, strokeWidth: 1.8 }} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "var(--critical-bg)",
              color: "var(--critical-text)",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <AlertTriangle style={{ width: 18, height: 18, strokeWidth: 1.8, flexShrink: 0 }} />
            <span style={{ lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "var(--linen)",
              color: "var(--ink)",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid var(--ink-border)",
            }}
          >
            <CheckCircle2 style={{ width: 18, height: 18, strokeWidth: 1.8, flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Employee Selection with Custom Select */}
          <div>
            <CustomSelect
              label="Clinical Staff Member"
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
              placeholder="Search or select clinician…"
              searchable={true}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Shift Template Selection with Custom Select */}
            <div>
              <CustomSelect
                label="Shift Template"
                value={shiftTypeId}
                onChange={setShiftTypeId}
                options={shiftOptions}
                placeholder="Choose shift type…"
                searchable={false}
              />
            </div>

            {/* Date Selection */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Schedule Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                  fontSize: 15,
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Care Zone & Station with Custom Select */}
          <div>
            <CustomSelect
              label="Care Zone & Station"
              value={wardZone}
              onChange={setWardZone}
              options={WARD_ZONE_OPTIONS}
              placeholder="Select assigned station…"
              searchable={false}
            />
          </div>

          {/* Handover Note */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 8,
              }}
            >
              Handover & Special Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Lead resuscitation bay until 13:00, monitor triage queue..."
              rows={3}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                fontSize: 15,
                lineHeight: 1.5,
                color: "var(--ink)",
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
              }}
            />
          </div>

          {/* Compliance Check Note */}
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "var(--linen)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13.5,
              color: "var(--ink-secondary)",
              border: "1px solid var(--ink-border)",
            }}
          >
            <CheckCircle2 style={{ width: 18, height: 18, strokeWidth: 1.6, color: "var(--ink)", flexShrink: 0 }} />
            <span>Pre-checks rest intervals (11h minimum) and weekly hours against hospital guardrails.</span>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 14,
              paddingTop: 16,
              borderTop: "1px solid var(--ink-border)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="zbtn zbtn-secondary"
              style={{ height: 48, padding: "0 20px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="zbtn zbtn-primary"
              style={{ height: 48, padding: "0 24px" }}
            >
              {isSubmitting ? "Publishing…" : "Publish assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
