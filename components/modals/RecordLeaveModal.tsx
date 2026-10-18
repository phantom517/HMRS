"use client";

import { useState } from "react";
import { X, CalendarOff, CheckCircle2, ShieldCheck } from "lucide-react";
import { createLeaveRecordAction, createOffDayAction } from "@/lib/actions/leave";
import { CustomSelect } from "@/components/ui/CustomSelect";

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

  const employeeOptions = employees.map((emp) => ({
    value: emp.id,
    label: emp.fullName,
    description: `${emp.employeeId} · ${emp.designation}`,
  }));

  const leaveTypeOptions = leaveTypes.map((lt) => ({
    value: lt.id,
    label: `[${lt.code}] ${lt.name}`,
    badge: lt.code,
  }));

  const replacementOptions = [
    { value: "", label: "No replacement assigned", description: "Direct shift unassignment without cover" },
    ...employees
      .filter((e) => e.id !== employeeId)
      .map((emp) => ({
        value: emp.id,
        label: emp.fullName,
        description: `${emp.employeeId} · ${emp.designation}`,
      })),
  ];

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
              <CalendarOff style={{ width: 22, height: 22, strokeWidth: 1.6, color: "var(--ink)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2, margin: 0 }}>
                Record Leave &amp; Off-Days
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-secondary)", marginTop: 4, margin: 0 }}>
                DEPT-402 &middot; Staff Leave Management
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

        {/* Mode Toggle with large comfortable tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            padding: 4,
            background: "var(--linen)",
            borderRadius: 14,
            border: "1px solid var(--ink-border)",
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setEntryMode("LEAVE")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: entryMode === "LEAVE" ? 500 : 400,
              background: entryMode === "LEAVE" ? "var(--paper)" : "transparent",
              color: "var(--ink)",
              border: entryMode === "LEAVE" ? "1px solid var(--ink-border)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Accrued Leave Request
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("OFFDAY")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: entryMode === "OFFDAY" ? 500 : 400,
              background: entryMode === "OFFDAY" ? "var(--paper)" : "transparent",
              color: "var(--ink)",
              border: entryMode === "OFFDAY" ? "1px solid var(--ink-border)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Scheduled Off-Day
          </button>
        </div>

        {message && (
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
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Employee Selection */}
          <div>
            <CustomSelect
              label="Hospital Employee"
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
              placeholder="Search or select clinician…"
              searchable={true}
            />
          </div>

          {/* Leave Classification */}
          {entryMode === "LEAVE" && (
            <div>
              <CustomSelect
                label="Leave Classification"
                value={leaveTypeId}
                onChange={setLeaveTypeId}
                options={leaveTypeOptions}
                placeholder="Choose leave type…"
                searchable={false}
              />
            </div>
          )}

          {/* Date Range */}
          <div style={{ display: "grid", gridTemplateColumns: entryMode === "LEAVE" ? "1fr 1fr" : "1fr", gap: 16 }}>
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
                {entryMode === "OFFDAY" ? "Rest Date" : "Start Date"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
            {entryMode === "LEAVE" && (
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
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
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
            )}
          </div>

          {/* Nominated Substitute Peer */}
          {entryMode === "LEAVE" && (
            <div>
              <CustomSelect
                label="Nominated Replacement Clinician"
                value={replacementEmployeeId}
                onChange={setReplacementEmployeeId}
                options={replacementOptions}
                placeholder="Select substitute clinician…"
                searchable={true}
              />
            </div>
          )}

          {/* Reason */}
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
              Reason / Medical Certificate Notes
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={entryMode === "OFFDAY" ? "e.g. Rotational 48h Safe Cycle rest" : "e.g. Form 14-B signed by Clinical Director"}
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

          {/* Safety Check Notice */}
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
            <ShieldCheck style={{ width: 18, height: 18, strokeWidth: 1.6, color: "var(--ink)", flexShrink: 0 }} />
            <span>Pre-checks unit patient-to-bed ratios and verifies clinician qualification overlap.</span>
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
              {isSubmitting ? "Saving…" : entryMode === "OFFDAY" ? "Record rest day" : "Record leave"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
