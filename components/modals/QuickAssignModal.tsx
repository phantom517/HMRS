"use client";

import { useState } from "react";
import { X, UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import { createShiftAssignmentAction } from "@/lib/actions/shifts";

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<{ id: string; employeeId: string; fullName: string; designation: string }>;
  shiftTypes: Array<{ id: string; shortCode: string; name: string; color: string; startTime: string; endTime: string }>;
  preselectedEmployeeId?: string;
  preselectedDate?: string;
}

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

  return (
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
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 16,
            borderBottom: "1px solid var(--ink-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UserPlus style={{ width: 18, height: 18, strokeWidth: 1.5, color: "var(--ink)" }} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
                Assign Roster Slot
              </h3>
              <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 2 }}>
                DEPT-402 &middot; Emergency &amp; Critical Care
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: "var(--ink)",
            }}
          >
            <X style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--critical-bg)",
              color: "var(--critical-text)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle style={{ width: 16, height: 16, strokeWidth: 1.5, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--linen)",
              color: "var(--ink)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--ink-border)",
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, strokeWidth: 1.5, flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Employee Selection */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
              Clinical Staff Member
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{
                width: "100%",
                height: 40,
                padding: "0 12px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                fontSize: 14,
                color: "var(--ink)",
                fontFamily: "inherit",
              }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeId} &middot; {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Shift Template Selection */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                Shift Template
              </label>
              <select
                value={shiftTypeId}
                onChange={(e) => setShiftTypeId(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                  fontSize: 14,
                  color: "var(--ink)",
                  fontFamily: "inherit",
                }}
              >
                {shiftTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    [{st.shortCode}] {st.name} ({st.startTime}–{st.endTime})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                Schedule Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                  fontSize: 14,
                  color: "var(--ink)",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Zone / Station */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
              Care Zone &amp; Station
            </label>
            <select
              value={wardZone}
              onChange={(e) => setWardZone(e.target.value)}
              style={{
                width: "100%",
                height: 40,
                padding: "0 12px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                fontSize: 14,
                color: "var(--ink)",
                fontFamily: "inherit",
              }}
            >
              <option value="Red Zone (Trauma Resus 1-4)">Red Zone (Trauma Resus 1-4)</option>
              <option value="Yellow Zone (Urgent Acute Assessment)">Yellow Zone (Urgent Acute Assessment)</option>
              <option value="Green Zone (Fast-Track Ambulatory)">Green Zone (Fast-Track Ambulatory)</option>
              <option value="Zone 4: Pediatric ED Wing">Zone 4: Pediatric ED Wing</option>
              <option value="Emergency Surgical Suite OR-1">Emergency Surgical Suite OR-1</option>
              <option value="ICU Overflow Pod A">ICU Overflow Pod A</option>
            </select>
          </div>

          {/* Handover Note */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
              Handover Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Lead resuscitation bay until 13:00..."
              rows={2}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                fontSize: 14,
                color: "var(--ink)",
                fontFamily: "inherit",
                resize: "none",
              }}
            />
          </div>

          {/* Compliance Check Note */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--linen)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ink-secondary)",
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink)", flexShrink: 0 }} />
            <span>Pre-checks rest intervals and maximum continuous shift rules.</span>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--ink-border)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="zbtn zbtn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="zbtn zbtn-primary"
            >
              {isSubmitting ? "Publishing..." : "Publish assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
