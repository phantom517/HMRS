"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  ShieldAlert,
  ChevronRight,
  X,
  Sparkles,
  Zap,
  ArrowRight,
  Filter,
} from "lucide-react";

export interface FatigueAlert {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  date: string;
  shiftTypeId: string;
  shiftName: string;
  type: "rest_interval" | "consecutive_days" | "weekly_hours" | "overlap" | "night_cap";
  severity: "critical" | "warning";
  title: string;
  description: string;
  assignmentId?: string;
}

export interface UnfilledAlert {
  id: string;
  date: string;
  weekday: string;
  shiftTypeId: string;
  shiftName: string;
  shiftColor?: string;
  shortageCount: number;
  requiredCount: number;
  assignedCount: number;
  designation: string;
  severity: "critical" | "warning";
  title: string;
  description: string;
}

interface RosterGuardrailBadgeProps {
  fatigueAlerts: FatigueAlert[];
  unfilledAlerts: UnfilledAlert[];
  onOpenDrawer?: (employee: any, date: string, shiftTypeId?: string) => void;
  onSmartFill?: () => void;
  isSmartFilling?: boolean;
}

export function RosterGuardrailBadge({
  fatigueAlerts,
  unfilledAlerts,
  onOpenDrawer,
  onSmartFill,
  isSmartFilling,
}: RosterGuardrailBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "fatigue" | "unfilled">("all");

  const totalAlerts = fatigueAlerts.length + unfilledAlerts.length;
  const criticalCount =
    fatigueAlerts.filter((a) => a.severity === "critical").length +
    unfilledAlerts.filter((a) => a.severity === "critical").length;

  const filteredFatigue =
    filterTab === "unfilled" ? [] : fatigueAlerts;
  const filteredUnfilled =
    filterTab === "fatigue" ? [] : unfilledAlerts;

  return (
    <>
      {/* ── Main Notification Badge Button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="roster-guardrail-badge-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 12px",
          borderRadius: 10,
          background: totalAlerts > 0 ? "var(--linen)" : "rgba(16, 185, 129, 0.08)",
          border: totalAlerts > 0
            ? criticalCount > 0
              ? "1px solid rgba(155, 44, 31, 0.35)"
              : "1px solid var(--ink-border-strong)"
            : "1px solid rgba(16, 185, 129, 0.3)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          color: "var(--ink)",
          fontWeight: 500,
          transition: "all 150ms ease",
          position: "relative",
        }}
        title="Automated Roster Guardrails & Coverage Audit"
      >
        {totalAlerts > 0 ? (
          <>
            {/* Pulsing indicator dot */}
            <span style={{ position: "relative", display: "flex", width: 8, height: 8 }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: criticalCount > 0 ? "var(--critical-text)" : "#d97706",
                  animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                  opacity: 0.75,
                }}
              />
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  borderRadius: "50%",
                  width: 8,
                  height: 8,
                  background: criticalCount > 0 ? "var(--critical-text)" : "#d97706",
                }}
              />
            </span>

            <span style={{ fontWeight: 600, color: criticalCount > 0 ? "var(--critical-text)" : "var(--ink)" }}>
              {totalAlerts} Alert{totalAlerts === 1 ? "" : "s"}
            </span>

            <span style={{ fontSize: 12, color: "var(--ink-secondary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {fatigueAlerts.length > 0 && (
                <span
                  style={{
                    background: "rgba(155, 44, 31, 0.1)",
                    color: "var(--critical-text)",
                    padding: "1px 6px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {fatigueAlerts.length} Fatigue
                </span>
              )}
              {unfilledAlerts.length > 0 && (
                <span
                  style={{
                    background: "var(--apricot)",
                    color: "var(--ink)",
                    padding: "1px 6px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {unfilledAlerts.length} Unfilled
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 style={{ width: 15, height: 15, color: "var(--ink)", strokeWidth: 2 }} />
            <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: 12.5 }}>
              Roster Compliant · 0 Alerts
            </span>
          </>
        )}
      </button>

      {/* ── Modal / Slide-Out Inspection Panel ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guardrail-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18, 23, 24, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="zelt-surface"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--paper)",
              border: "1px solid var(--ink-border)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--ink-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: totalAlerts > 0 ? "var(--critical-bg)" : "var(--linen)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {totalAlerts > 0 ? (
                    <AlertTriangle style={{ width: 18, height: 18, color: "var(--critical-text)", strokeWidth: 1.75 }} />
                  ) : (
                    <CheckCircle2 style={{ width: 18, height: 18, color: "var(--ink)", strokeWidth: 1.75 }} />
                  )}
                </span>
                <div>
                  <h2
                    id="guardrail-dialog-title"
                    style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}
                  >
                    Automated Guardrail &amp; Staffing Alerts
                  </h2>
                  <p style={{ fontSize: 12.5, color: "var(--ink-secondary)", margin: "2px 0 0" }}>
                    Live reactive compliance monitor · DEPT-402 Emergency Care
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  background: "var(--linen)",
                  color: "var(--ink-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close dialog"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Sub-toolbar with filter tabs & Smart fill trigger */}
            <div
              style={{
                padding: "10px 20px",
                background: "var(--linen)",
                borderBottom: "1px solid var(--ink-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "inline-flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: filterTab === "all" ? 600 : 400,
                    background: filterTab === "all" ? "var(--paper)" : "transparent",
                    color: filterTab === "all" ? "var(--ink)" : "var(--ink-secondary)",
                    border: filterTab === "all" ? "1px solid var(--ink-border)" : "none",
                    cursor: "pointer",
                  }}
                >
                  All ({totalAlerts})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("fatigue")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: filterTab === "fatigue" ? 600 : 400,
                    background: filterTab === "fatigue" ? "var(--paper)" : "transparent",
                    color: filterTab === "fatigue" ? "var(--critical-text)" : "var(--ink-secondary)",
                    border: filterTab === "fatigue" ? "1px solid var(--ink-border)" : "none",
                    cursor: "pointer",
                  }}
                >
                  Fatigue ({fatigueAlerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("unfilled")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: filterTab === "unfilled" ? 600 : 400,
                    background: filterTab === "unfilled" ? "var(--paper)" : "transparent",
                    color: filterTab === "unfilled" ? "#b45309" : "var(--ink-secondary)",
                    border: filterTab === "unfilled" ? "1px solid var(--ink-border)" : "none",
                    cursor: "pointer",
                  }}
                >
                  Unfilled Shifts ({unfilledAlerts.length})
                </button>
              </div>

              {onSmartFill && unfilledAlerts.length > 0 && (
                <button
                  type="button"
                  disabled={isSmartFilling}
                  onClick={() => {
                    onSmartFill();
                    setIsOpen(false);
                  }}
                  className="zbtn zbtn-primary"
                  style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                >
                  <Zap style={{ width: 13, height: 13 }} />
                  <span>{isSmartFilling ? "Filling..." : "Auto-Fill Gaps"}</span>
                </button>
              )}
            </div>

            {/* Alerts List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {totalAlerts === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "var(--linen)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircle2 style={{ width: 24, height: 24, color: "var(--ink)", strokeWidth: 1.75 }} />
                  </span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                      No Fatigue Violations or Shortages
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--ink-secondary)", margin: "4px 0 0", maxWidth: 360 }}>
                      All active duty roster assignments conform to the 11-hour minimum rest rule, 48h weekly caps, and shift staffing minimums.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Fatigue Alerts Section */}
                  {filteredFatigue.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: "var(--linen)",
                        border: alert.severity === "critical" ? "1px solid rgba(155, 44, 31, 0.3)" : "1px solid var(--ink-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: alert.severity === "critical" ? "var(--critical-bg)" : "var(--apricot)",
                              color: alert.severity === "critical" ? "var(--critical-text)" : "var(--ink)",
                            }}
                          >
                            {alert.type === "rest_interval"
                              ? "Rest Rule Violation (<11h)"
                              : alert.type === "weekly_hours"
                              ? "Weekly Hours Cap"
                              : alert.type === "consecutive_days"
                              ? "Consecutive Shifts"
                              : "Schedule Conflict"}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                            {alert.employeeName}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                            ({alert.employeeRole})
                          </span>
                        </div>

                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                          {alert.date}
                        </span>
                      </div>

                      <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.45, margin: 0 }}>
                        {alert.description}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                        {onOpenDrawer && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenDrawer(
                                { id: alert.employeeId, fullName: alert.employeeName, designation: alert.employeeRole },
                                alert.date,
                                alert.shiftTypeId
                              );
                              setIsOpen(false);
                            }}
                            style={{
                              border: "none",
                              background: "none",
                              color: "var(--ink)",
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              borderRadius: 6,
                            }}
                          >
                            <span>Inspect &amp; Adjust Shift</span>
                            <ArrowRight style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Unfilled Alerts Section */}
                  {filteredUnfilled.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: "var(--linen)",
                        border: "1px solid var(--ink-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "var(--apricot)",
                              color: "var(--ink)",
                            }}
                          >
                            Unfilled Shift
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                            {alert.shiftName}
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "var(--critical-text)",
                              background: "var(--critical-bg)",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            Short {alert.shortageCount} {alert.designation}
                          </span>
                        </div>

                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                          {alert.weekday} · {alert.date}
                        </span>
                      </div>

                      <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.45, margin: 0 }}>
                        {alert.description}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                        {onOpenDrawer && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenDrawer(undefined, alert.date, alert.shiftTypeId);
                              setIsOpen(false);
                            }}
                            style={{
                              border: "none",
                              background: "none",
                              color: "var(--ink)",
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              borderRadius: 6,
                            }}
                          >
                            <span>Assign Eligible Clinician</span>
                            <ArrowRight style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--ink-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--paper)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                Guardrails auto-evaluated against 68 clinicians &amp; hospital fatigue policies
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="zbtn zbtn-default"
                style={{ height: 36, padding: "0 16px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
