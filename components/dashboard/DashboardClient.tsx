"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  ChevronDown,
  CalendarPlus,
  CalendarOff,
  UserPlus,
  Download,
} from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { ExportModal } from "@/components/modals/ExportModal";
import { QuickAssignModal } from "@/components/modals/QuickAssignModal";
import { RecordLeaveModal } from "@/components/modals/RecordLeaveModal";
import {
  EmployeeFormDialog,
  type EmployeeFormData,
  type EmployeeExceptionFields,
} from "@/components/employees/EmployeeFormDialog";
import { createEmployeeAction } from "@/lib/actions/employees";

interface DashboardClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  settings: any;
  auditLogs: Array<any>;
  leaveTypes: Array<any>;
}

function ZTag({
  children,
  variant,
  style,
}: {
  children: React.ReactNode;
  variant: "critical" | "warning" | "ok" | "neutral";
  style?: React.CSSProperties;
}) {
  const cls: Record<string, string> = {
    critical: "ztag ztag-critical",
    warning: "ztag ztag-warning",
    ok: "ztag ztag-ok",
    neutral: "ztag ztag-neutral",
  };
  return <span className={cls[variant]} style={style}>{children}</span>;
}

function ZAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return <span className="zavatar">{initials}</span>;
}

function ZRatioBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 52,
          height: 4,
          background: "var(--linen)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--ink)",
            opacity: 0.35,
            borderRadius: 2,
            transition: "width 200ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 13,
          color: "var(--ink-secondary)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03px",
        }}
      >
        {value}/{max}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 24,
        fontWeight: 500,
        color: "var(--ink)",
        letterSpacing: "-0.17px",
        lineHeight: 1.24,
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return { label: "Day shift", time: "07:00 – 15:00" };
  if (hour >= 15 && hour < 23) return { label: "Evening shift", time: "15:00 – 23:00" };
  return { label: "Night shift", time: "23:00 – 07:00" };
}

export function DashboardClient({
  currentUser,
  employees,
  shiftTypes,
  assignments,
  leaveRecords,
  offDays,
  settings,
  auditLogs,
  leaveTypes,
}: DashboardClientProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  const [isRecordLeaveOpen, setIsRecordLeaveOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);

  // Close Quick Actions menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        quickActionsRef.current &&
        !quickActionsRef.current.contains(event.target as Node)
      ) {
        setIsQuickActionsOpen(false);
      }
    }
    if (isQuickActionsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isQuickActionsOpen]);

  // Employee creation state for quick employee action
  const [employeeFormData, setEmployeeFormData] = useState<EmployeeFormData>({
    employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    fullName: "",
    designation: "Staff Critical Care RN",
    unit: "Trauma Bay 1-4 • Red Team",
    phoneNumber: "+977-9801234567",
    email: "",
    dateJoined: new Date().toISOString().slice(0, 10),
    credentials: "ACLS, BLS",
  });
  const [exceptionFields, setExceptionFields] = useState<EmployeeExceptionFields>({
    maxHoursPerWeek: "",
    canWorkNights: true,
  });

  const roleOptions = [
    { name: "Staff Critical Care RN", description: "Registered Nurse - Trauma & Resus" },
    { name: "Attending Trauma Physician (MD)", description: "Board Certified Emergency MD" },
    { name: "Emergency Paramedic Tech", description: "Advanced Paramedic / Tech" },
    { name: "Triage Charge Nurse", description: "ED Charge & Initial Assessment" },
  ];

  const unitOptions = [
    { name: "Trauma Bay 1-4 • Red Team" },
    { name: "Acute Resuscitation Pod A" },
    { name: "FastTrack Ambulatory" },
    { name: "ICU Overflow Pod B" },
  ];

  async function handleSaveNewEmployee() {
    try {
      if (!employeeFormData.fullName.trim() || !employeeFormData.email.trim()) {
        alert("Please provide the employee's full name and email.");
        return;
      }
      await createEmployeeAction({
        employeeId: employeeFormData.employeeId,
        fullName: employeeFormData.fullName,
        designation: employeeFormData.designation,
        unit: employeeFormData.unit,
        phoneNumber: employeeFormData.phoneNumber,
        email: employeeFormData.email,
        dateJoined: employeeFormData.dateJoined,
      });
      setIsAddEmployeeOpen(false);
      setEmployeeFormData({
        employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        fullName: "",
        designation: "Staff Critical Care RN",
        unit: "Trauma Bay 1-4 • Red Team",
        phoneNumber: "+977-9801234567",
        email: "",
        dateJoined: new Date().toISOString().slice(0, 10),
        credentials: "ACLS, BLS",
      });
    } catch (err: any) {
      alert(err.message || "Failed to create employee.");
    }
  }

  // View-only guard: hide mutating controls when the session lacks permissions
  const canEditEmployees = currentUser.permissions?.canEditEmployees;
  const canAssignShifts = currentUser.permissions?.canAssignShifts;
  const isViewer = currentUser.role === "viewer";

  const currentShift = getCurrentShift();

  // Live department cycle date
  const todayStr = "2024-10-24";
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const shiftTypeMap = new Map(shiftTypes.map((s) => [s.id, s]));

  function roleOf(emp: any): "RN" | "MD" | "Tech" {
    const d = emp?.designation || "";
    if (/MD|Physician|Surgeon|Intensivist|Anesthesiolog/i.test(d)) return "MD";
    if (/Tech|Paramedic|EMT/i.test(d)) return "Tech";
    return "RN";
  }

  const todayAssignments = assignments.filter(
    (a) => a.date === todayStr && a.status !== "cancelled"
  );

  const staffing = (() => {
    const counts = {
      RN: { onDuty: 0, required: 0 },
      MD: { onDuty: 0, required: 0 },
      Tech: { onDuty: 0, required: 0 },
    };
    for (const s of shiftTypes) {
      if (!s.active || /STANDBY|ON-?CALL/i.test(s.category || "")) continue;
      counts.RN.required += s.minimumStaffRn || 0;
      counts.MD.required += s.minimumStaffMd || 0;
      counts.Tech.required += Math.min(
        2,
        Math.max(0, (s.targetStaff || 0) - (s.minimumStaffRn || 0) - (s.minimumStaffMd || 0))
      );
    }
    for (const a of todayAssignments) {
      const emp = empMap.get(a.employeeId);
      if (emp) counts[roleOf(emp)].onDuty += 1;
    }
    return counts;
  })();

  const onDutyNow = todayAssignments.map((a) => {
    const emp = empMap.get(a.employeeId);
    const st = shiftTypeMap.get(a.shiftTypeId);
    return {
      name: emp?.fullName || "Unknown staff",
      role: emp ? roleOf(emp) : "—",
      area: a.wardZone || emp?.unit || "—",
      hours: st ? `${st.startTime}–${st.endTime}` : "—",
    };
  });

  const nextShift = todayAssignments
    .map((a) => ({ a, st: shiftTypeMap.get(a.shiftTypeId) }))
    .filter(({ st }) => st && (st.crossesMidnight || st.startTime >= "15:00"))
    .map(({ a, st }) => {
      const emp = empMap.get(a.employeeId);
      return {
        name: emp?.fullName || "Unknown staff",
        role: emp ? roleOf(emp) : "—",
        area: a.wardZone || "—",
        hours: st ? `${st.startTime}–${st.endTime}` : "—",
        confirmed: a.status === "completed",
      };
    });

  const totalOn = staffing.RN.onDuty + staffing.MD.onDuty + staffing.Tech.onDuty;
  const totalReq = staffing.RN.required + staffing.MD.required + staffing.Tech.required;
  const isShort = totalOn < totalReq;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      {/* ── Page Title Block with Quick Actions ── */}
      <div
        style={{
          marginBottom: 40,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "var(--ink)",
              letterSpacing: "-0.38px",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Emergency Department
          </h1>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                color: "var(--ink-secondary)",
                lineHeight: 1.4,
              }}
            >
              {today}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                color: "var(--ink-secondary)",
                lineHeight: 1.4,
              }}
            >
              {currentShift.label} &middot; {currentShift.time}
            </span>
          </div>
        </div>

        {/* ── QUICK ACTIONS MENU ── */}
        {!isViewer && (
          <div ref={quickActionsRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
              className="zbtn zbtn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 44,
                padding: "0 18px",
                borderRadius: 12,
                background: isQuickActionsOpen ? "var(--parchment)" : "var(--paper)",
                border: "1px solid var(--ink-border-strong)",
                fontWeight: 500,
              }}
              aria-label="Quick Actions"
            >
              <Zap style={{ width: 16, height: 16, color: "var(--ink)" }} />
              <span>Quick Actions</span>
              <ChevronDown
                style={{
                  width: 15,
                  height: 15,
                  transform: isQuickActionsOpen ? "rotate(180deg)" : "none",
                  transition: "transform 180ms ease",
                }}
              />
            </button>

            {isQuickActionsOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: 270,
                  background: "var(--paper)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid var(--ink-border-strong)",
                  borderRadius: 14,
                  padding: 8,
                  zIndex: 60,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--ink-tertiary)",
                  }}
                >
                  Administrator Actions
                </div>

                {canAssignShifts && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickActionsOpen(false);
                      setIsQuickAssignOpen(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "transparent",
                      border: "none",
                      fontSize: 14,
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--linen)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <CalendarPlus style={{ width: 16, height: 16, color: "var(--ink)" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>Create Shift Assignment</span>
                      <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                        Assign clinician to duty slot
                      </span>
                    </div>
                  </button>
                )}

                {canEditEmployees && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickActionsOpen(false);
                      setIsRecordLeaveOpen(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "transparent",
                      border: "none",
                      fontSize: 14,
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--linen)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <CalendarOff style={{ width: 16, height: 16, color: "var(--ink)" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>Log Leave or Off-Day</span>
                      <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                        Statutory leave &amp; rest cycles
                      </span>
                    </div>
                  </button>
                )}

                {canEditEmployees && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickActionsOpen(false);
                      setIsAddEmployeeOpen(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "transparent",
                      border: "none",
                      fontSize: 14,
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--linen)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <UserPlus style={{ width: 16, height: 16, color: "var(--ink)" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>Add New Employee</span>
                      <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                        Register clinical staff profile
                      </span>
                    </div>
                  </button>
                )}

                <div
                  style={{
                    height: 1,
                    background: "var(--ink-border)",
                    margin: "4px 0",
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    setIsExportOpen(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "transparent",
                    border: "none",
                    fontSize: 14,
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background-color 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--linen)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Download style={{ width: 16, height: 16, color: "var(--ink-secondary)" }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 500 }}>Export Audit Report</span>
                    <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                      PDF, Excel or CSV format
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 1: Current Staffing ── */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <SectionHeading>Current staffing</SectionHeading>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {canEditEmployees && (
              <button
                type="button"
                onClick={() => setIsRecordLeaveOpen(true)}
                className="zbtn zbtn-secondary"
              >
                Record leave
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="zbtn zbtn-secondary"
            >
              Export
            </button>
            {/* Primary Action Button: Honey fill, ink text, EXACTLY ONE element per viewport */}
            {canAssignShifts && (
              <button
                type="button"
                onClick={() => setIsQuickAssignOpen(true)}
                className="zbtn zbtn-primary"
              >
                Assign shift
              </button>
            )}
            {isViewer && (
              <span className="ztag ztag-neutral">View only — read-only session</span>
            )}
          </div>
        </div>

        <div className="zelt-surface" style={{ overflow: "hidden" }}>
          <table className="ztable">
            <thead>
              <tr>
                <th>Role</th>
                <th className="num">On duty</th>
                <th className="num">Required</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { label: "RN", data: staffing.RN },
                  { label: "MD", data: staffing.MD },
                  { label: "Tech", data: staffing.Tech },
                ]
              ).map(({ label, data }: { label: string; data: { onDuty: number; required: number } }) => {
                const under = data.onDuty < data.required;
                return (
                  <tr key={label}>
                    <td style={{ fontWeight: 500 }}>{label}</td>
                    <td className="num" style={{ fontWeight: 500 }}>{data.onDuty}</td>
                    <td className="num" style={{ color: "var(--ink-secondary)" }}>
                      {data.required}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <ZRatioBar value={data.onDuty} max={data.required} />
                        {under ? (
                          <ZTag variant="critical">
                            {data.required - data.onDuty} short
                          </ZTag>
                        ) : (
                          <ZTag variant="ok">OK</ZTag>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 500 }}>Total</td>
                <td
                  className="num"
                  style={{
                    fontWeight: 500,
                    color: isShort ? "var(--critical-text)" : "var(--ink)",
                  }}
                >
                  {totalOn}
                </td>
                <td className="num" style={{ color: "var(--ink-secondary)", fontWeight: 500 }}>
                  {totalReq}
                </td>
                <td>
                  {isShort ? (
                    <ZTag variant="critical">Below minimum</ZTag>
                  ) : (
                    <ZTag variant="ok">Minimum met</ZTag>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── SECTION 2: On Duty Now ── */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <SectionHeading>On duty now</SectionHeading>
          <Link href="/duty-roster" className="zbtn zbtn-text">
            Full roster
          </Link>
        </div>

        <div className="zelt-surface" style={{ overflow: "hidden" }}>
          <table className="ztable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Area</th>
                <th className="num">Hours</th>
              </tr>
            </thead>
            <tbody>
              {onDutyNow.map((p) => (
                <tr key={p.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ZAvatar name={p.name} />
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--ink-secondary)" }}>{p.role}</td>
                  <td style={{ color: "var(--ink-secondary)" }}>{p.area}</td>
                  <td
                    className="num"
                    style={{ color: "var(--ink-tertiary)", fontSize: 14 }}
                  >
                    {p.hours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SECTION 3: Next Shift ── */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <SectionHeading>Next shift</SectionHeading>
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                color: "var(--ink-secondary)",
              }}
            >
              19:00 tonight
            </span>
          </div>
        </div>

        <div className="zelt-surface" style={{ overflow: "hidden" }}>
          <table className="ztable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Area</th>
                <th className="num">Hours</th>
                <th>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {nextShift.map((p) => (
                <tr key={p.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ZAvatar name={p.name} />
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--ink-secondary)" }}>{p.role}</td>
                  <td style={{ color: "var(--ink-secondary)" }}>{p.area}</td>
                  <td
                    className="num"
                    style={{ color: "var(--ink-tertiary)", fontSize: 14 }}
                  >
                    {p.hours}
                  </td>
                  <td>
                    {p.confirmed ? (
                      <ZTag variant="ok">Yes</ZTag>
                    ) : (
                      <ZTag variant="warning">Pending</ZTag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SECTION 4: Recent Activity ── */}
      {auditLogs.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <SectionHeading>Recent activity</SectionHeading>
            <Link href="/settings" className="zbtn zbtn-text">
              Full log
            </Link>
          </div>
          <div className="zelt-surface" style={{ overflow: "hidden" }}>
            <table className="ztable">
              <tbody>
                {auditLogs.slice(0, 5).map((log) => (
                  <tr key={log.id}>
                    <td
                      style={{
                        width: 90,
                        color: "var(--ink-tertiary)",
                        fontSize: 13,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {new Date(log.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td style={{ color: "var(--ink)" }}>{log.details}</td>
                    <td
                      style={{
                        textAlign: "right",
                        color: "var(--ink-secondary)",
                        fontSize: 13,
                      }}
                    >
                      {log.actorName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modals with custom larger layout and backdrop blur */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        employees={employees}
        assignments={assignments}
        shiftTypes={shiftTypes}
      />
      <QuickAssignModal
        isOpen={isQuickAssignOpen}
        onClose={() => setIsQuickAssignOpen(false)}
        employees={employees}
        shiftTypes={shiftTypes}
      />
      <RecordLeaveModal
        isOpen={isRecordLeaveOpen}
        onClose={() => setIsRecordLeaveOpen(false)}
        employees={employees}
        leaveTypes={leaveTypes}
      />
      <EmployeeFormDialog
        open={isAddEmployeeOpen}
        onOpenChange={setIsAddEmployeeOpen}
        isAdd={true}
        formData={employeeFormData}
        onFormDataChange={setEmployeeFormData}
        roleOptions={roleOptions}
        unitOptions={unitOptions}
        exceptionFields={exceptionFields}
        onExceptionFieldsChange={setExceptionFields}
        onSave={handleSaveNewEmployee}
      />
    </div>
  );
}
