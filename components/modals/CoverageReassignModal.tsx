"use client";

import { useState } from "react";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { resolveCoverageDeficitAction } from "@/lib/actions/shifts";

interface CoverageReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStaffName: string;
  targetEmployeeId: string;
  targetDate: string;
  shiftName: string;
  shiftTypeId: string;
  leaveRecordId?: string;
  onSuccess?: () => void;
}

export function CoverageReassignModal({
  isOpen,
  onClose,
  targetStaffName,
  targetEmployeeId,
  targetDate,
  shiftName,
  shiftTypeId,
  leaveRecordId,
  onSuccess,
}: CoverageReassignModalProps) {
  const [selectedPhysicianId, setSelectedPhysicianId] = useState("emp_20");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleAssign() {
    setIsSubmitting(true);
    try {
      await resolveCoverageDeficitAction({
        targetEmployeeId,
        replacementEmployeeId: selectedPhysicianId,
        date: targetDate,
        shiftTypeId,
        leaveRecordId,
        notes: `Emergency coverage dispatch: Substitute for ${targetStaffName}`,
      });

      setSuccessMsg(`Coverage confirmed. Clinician dispatched for ${targetDate}.`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || "Failed to dispatch coverage.");
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
            <AlertTriangle style={{ width: 18, height: 18, strokeWidth: 1.5, color: "var(--critical-text)" }} />
            <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
              Reassign Clinical Coverage
            </h3>
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

        {/* Deficit Alert Banner */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "var(--linen)",
            border: "1px solid var(--ink-border)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{targetStaffName}</span>
          <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 2 }}>
            Requires shift coverage for {targetDate} ({shiftName}) in Trauma Bay 2.
          </p>
        </div>

        {successMsg ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--linen)",
              border: "1px solid var(--ink-border)",
              color: "var(--ink)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            <span>{successMsg}</span>
          </div>
        ) : (
          <>
            {/* Candidate List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                Available On-Call Clinicians
              </label>

              {[
                { id: "emp_20", name: "Dr. Kevin Patel (DOC-130)", desc: "On-Call Tier 1 &middot; 0h overtime this week", tag: "Optimal" },
                { id: "emp_24", name: "Dr. Amanda Hayes (DOC-135)", desc: "On-Call Tier 2 &middot; 36h logged", tag: "Eligible" },
                { id: "emp_09", name: "Dr. Julian Hayes (DOC-108B)", desc: "Emergency Trauma Surgeon &middot; Standby", tag: "Standby" },
              ].map((c) => (
                <label
                  key={c.id}
                  onClick={() => setSelectedPhysicianId(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: selectedPhysicianId === c.id ? "var(--paper)" : "var(--linen)",
                    border: selectedPhysicianId === c.id ? "1px solid var(--ink)" : "1px solid var(--ink-border)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="radio"
                      name="candidate"
                      checked={selectedPhysicianId === c.id}
                      onChange={() => setSelectedPhysicianId(c.id)}
                      style={{ accentColor: "var(--ink)" }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{c.name}</div>
                      <div
                        style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 2 }}
                        dangerouslySetInnerHTML={{ __html: c.desc }}
                      />
                    </div>
                  </div>
                  <span className="ztag ztag-neutral">{c.tag}</span>
                </label>
              ))}
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
              <button type="button" onClick={onClose} className="zbtn zbtn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={isSubmitting}
                className="zbtn zbtn-secondary"
                style={{ background: "var(--paper)" }}
              >
                {isSubmitting ? "Dispatching..." : "Assign coverage"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
