"use client";

import { useState } from "react";
import { X, AlertTriangle, Clock, Users, CheckCircle2 } from "lucide-react";
import { createShiftAssignmentAction } from "@/lib/actions/shifts";

interface ConflictCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

export function ConflictCheckerModal({ isOpen, onClose, onResolved }: ConflictCheckerModalProps) {
  const [resolvedOne, setResolvedOne] = useState(false);
  const [resolvedTwo, setResolvedTwo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  async function resolveVanceConflict() {
    setIsProcessing(true);
    try {
      await createShiftAssignmentAction({
        employeeId: "emp_21",
        shiftTypeId: "st_ngt_03",
        date: "2024-10-25",
        wardZone: "Acute Trauma ICU",
        notes: "Coverage reassignment resolving Marcus Vance rest-interval breach.",
        forceOverrideWarnings: true,
      });
      setResolvedOne(true);
      if (onResolved) onResolved();
    } catch (err: any) {
      alert(err.message || "Could not resolve conflict.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function resolveFridayDeficit() {
    setIsProcessing(true);
    try {
      await createShiftAssignmentAction({
        employeeId: "emp_22",
        shiftTypeId: "st_day_01",
        date: "2024-10-25",
        wardZone: "Zone Red (Resus)",
        notes: "Float pool dispatch resolving Friday Day Shift RN deficit.",
        forceOverrideWarnings: true,
      });
      setResolvedTwo(true);
      if (onResolved) onResolved();
    } catch (err: any) {
      alert(err.message || "Could not resolve deficit.");
    } finally {
      setIsProcessing(false);
    }
  }

  const remainingCount = (resolvedOne ? 0 : 1) + (resolvedTwo ? 0 : 1);

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
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          boxShadow: "none",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--ink-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle style={{ width: 18, height: 18, strokeWidth: 1.5, color: "var(--critical-text)" }} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
                Roster Compliance: {remainingCount} Active Violation{remainingCount === 1 ? "" : "s"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 2 }}>
                Review rest intervals and minimum ER coverage before committing.
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

        {/* Conflict List */}
        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Conflict 1 */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: resolvedOne ? "var(--linen)" : "var(--paper)",
              border: "1px solid var(--ink-border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink)" }} />
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                  Nurse Marcus Vance (NUR-204)
                </span>
              </div>
              {resolvedOne ? (
                <span className="ztag ztag-ok">Resolved</span>
              ) : (
                <span className="ztag ztag-warning">Rest Interval</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
              Back-to-back shift turnaround on Friday Oct 25 (&lt;11h rest).
            </p>
            {!resolvedOne ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <button
                  onClick={resolveVanceConflict}
                  disabled={isProcessing}
                  className="zbtn zbtn-secondary"
                  style={{ background: "var(--paper)" }}
                >
                  Swap with standby float
                </button>
                <button
                  onClick={() => setResolvedOne(true)}
                  className="zbtn zbtn-text"
                >
                  Apply override
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                ✓ Reassigned to Standby Float Nurse David Chen.
              </div>
            )}
          </div>

          {/* Conflict 2 */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: resolvedTwo ? "var(--linen)" : "var(--paper)",
              border: "1px solid var(--ink-border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink)" }} />
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                  Friday Oct 25 &middot; Day Shift Deficit
                </span>
              </div>
              {resolvedTwo ? (
                <span className="ztag ztag-ok">Resolved</span>
              ) : (
                <span className="ztag ztag-critical">1 RN Short</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
              Trauma Red Zone requires minimum 15 RNs. Only 14 RNs are scheduled.
            </p>
            {!resolvedTwo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <button
                  onClick={resolveFridayDeficit}
                  disabled={isProcessing}
                  className="zbtn zbtn-secondary"
                  style={{ background: "var(--paper)" }}
                >
                  Dispatch float pool
                </button>
                <button
                  onClick={() => setResolvedTwo(true)}
                  className="zbtn zbtn-text"
                >
                  Approve solo cover
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                ✓ Nurse Naomi Ortiz dispatched to Trauma Red Zone.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            background: "var(--linen)",
            borderTop: "1px solid var(--ink-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>
            HRMS Audit: #STJ-OCT24
          </span>
          <button onClick={onClose} className="zbtn zbtn-secondary">
            Close inspector
          </button>
        </div>
      </div>
    </div>
  );
}
