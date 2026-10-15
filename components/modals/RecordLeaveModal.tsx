"use client";

import { useState } from "react";
import { X, CalendarOff, CheckCircle2, ShieldCheck } from "lucide-react";
import { createLeaveRecordAction, createOffDayAction } from "@/lib/actions/leave";

interface RecordLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<{ id: string; employeeId: string; fullName: string; designation: string }>;
  leaveTypes: Array<{ id: string; code: string; name: string }>;
  onSuccess?: (result?: any) => void;
}

export function RecordLeaveModal({
  isOpen,
  onClose,
  employees,
  leaveTypes,
  onSuccess,
}: RecordLeaveModalProps) {
  const [entryMode, setEntryMode] = useState<"LEAVE" | "OFFDAY">("LEAVE");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [startDate, setStartDate] = useState("2024-10-29");
  const [endDate, setEndDate] = useState("2024-10-31");
  const [reason, setReason] = useState("");
  const [replacementEmployeeId, setReplacementEmployeeId] = useState(employees[1]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (entryMode === "OFFDAY") {
        await createOffDayAction({
          employeeId,
          date: startDate,
          reason: reason || "Rotational Rest Period (Mandatory 48h Safe Cycle)",
          notes: "Scheduled rotational rest. Non-deductible from statutory leave balance.",
        });
        setMessage("Scheduled rest day committed to roster successfully.");
      } else {
        await createLeaveRecordAction({
          employeeId,
          leaveTypeId,
          startDate,
          endDate,
          reason: reason || "Standard statutory leave record",
          replacementEmployeeId: replacementEmployeeId || undefined,
        });
        setMessage("Accrued leave record logged and quota updated.");
      }

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || "Operation failed.");
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
            <CalendarOff style={{ width: 18, height: 18, strokeWidth: 1.5, color: "var(--ink)" }} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
                Record Leave &amp; Off-Days
              </h3>
              <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 2 }}>
                DEPT-402 &middot; Schedule Entry
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

        {/* Mode Toggle */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            padding: 3,
            background: "var(--linen)",
            borderRadius: 12,
            border: "1px solid var(--ink-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setEntryMode("LEAVE")}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: entryMode === "LEAVE" ? 500 : 400,
              background: entryMode === "LEAVE" ? "var(--paper)" : "transparent",
              color: "var(--ink)",
              border: entryMode === "LEAVE" ? "1px solid var(--ink-border)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Accrued Leave
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("OFFDAY")}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: entryMode === "OFFDAY" ? 500 : 400,
              background: entryMode === "OFFDAY" ? "var(--paper)" : "transparent",
              color: "var(--ink)",
              border: entryMode === "OFFDAY" ? "1px solid var(--ink-border)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Regular Off-Day
          </button>
        </div>

        {message && (
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
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Employee Selection */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
              Hospital Employee
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

          {/* Leave Classification */}
          {entryMode === "LEAVE" && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                Leave Classification
              </label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
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
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    [{lt.code}] {lt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range */}
          <div style={{ display: "grid", gridTemplateColumns: entryMode === "LEAVE" ? "1fr 1fr" : "1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                {entryMode === "OFFDAY" ? "Rest Date" : "Start Date"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
            {entryMode === "LEAVE" && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
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
            )}
          </div>

          {/* Nominated Substitute Peer */}
          {entryMode === "LEAVE" && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                Nominated Replacement Clinician
              </label>
              <select
                value={replacementEmployeeId}
                onChange={(e) => setReplacementEmployeeId(e.target.value)}
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
                <option value="">No replacement assigned</option>
                {employees
                  .filter((e) => e.id !== employeeId)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.designation})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
              Reason / Medical Certificate Notes
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={entryMode === "OFFDAY" ? "e.g. Rotational 48h Safe Cycle rest" : "e.g. Form 14-B signed..."}
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

          {/* Safety Check Notice */}
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
            <ShieldCheck style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink)", flexShrink: 0 }} />
            <span>Pre-checks patient-to-bed ratios and substitute qualifications.</span>
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
              className="zbtn zbtn-secondary"
              style={{ background: "var(--paper)" }}
            >
              {isSubmitting ? "Saving..." : entryMode === "OFFDAY" ? "Record rest day" : "Record leave"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
