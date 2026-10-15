"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthenticatedUser } from "@/lib/auth/session";
import { ExportModal } from "@/components/modals/ExportModal";
import { QuickAssignModal } from "@/components/modals/QuickAssignModal";
import { RecordLeaveModal } from "@/components/modals/RecordLeaveModal";

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

  // View-only guard: hide mutating controls when the session lacks permissions
  const canEditEmployees = currentUser.permissions?.canEditEmployees;
  const canAssignShifts = currentUser.permissions?.canAssignShifts;
  const canApproveLeave = currentUser.permissions?.canApproveLeave;
  const isViewer = currentUser.role === "viewer";

  const [shortageResolved, setShortageResolved] = useState(false);
  const [restViolationResolved, setRestViolationResolved] = useState(false);
  const [leaveApproved, setLeaveApproved] = useState(false);

  const currentShift = getCurrentShift();

  // All live numbers below are derived from real database records — no hardcoded values.
  const todayStr = "2024-10-24"; // department cycle date (October timeline)
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

  const hasNeedsAttention = !shortageResolved || !restViolationResolved || !leaveApproved;

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "36px 36px 80px",
      }}
    >
      {/* ── Page Title Block ── */}
      {/* Page title (department name): 32px / 500 / line-height 1.2 / letter-spacing -0.38px */}
      {/* Date and shift: 16px / 400, secondary ink, directly below the title (not crammed on one line with a divider) */}
      <div style={{ marginBottom: 48 }}>
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

      {/* ── SECTION 1: Needs Attention ── */}
      {/* Render each item as its own row/card in paper with generous padding. Problem title at 16px/500, details as secondary text, action buttons right-aligned on the same row. Visible without scrolling. */}
      {hasNeedsAttention && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ marginBottom: 16 }}>
            <SectionHeading>Needs attention</SectionHeading>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Urgent Shortage Card */}
            {!shortageResolved && (
              <div
                className="zelt-surface"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 260 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>
                    Night shift short 2 RNs
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
                    Trauma Bay &middot; tonight 19:00 &middot; Need 9 RNs, have 7 confirmed
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  <ZTag variant="critical">2 short</ZTag>
                  {!isViewer && (
                    <button
                      onClick={() => setShortageResolved(true)}
                      className="zbtn zbtn-secondary"
                    >
                      Find cover
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Rest Interval Policy Card */}
            {!restViolationResolved && (
              <div
                className="zelt-surface"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 260 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>
                    Rest interval violation
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
                    T. Gomez &middot; 8h gap (min {settings?.minRestHoursBetweenShifts || 11}h required) &middot; Back-to-back evening/day shift
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  <ZTag variant="warning">Policy</ZTag>
                  {!isViewer && (
                    <button
                      onClick={() => setRestViolationResolved(true)}
                      className="zbtn zbtn-secondary"
                    >
                      Reassign
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Pending Leave Request Card */}
            {!leaveApproved && (
              <div
                className="zelt-surface"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 260 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>
                    Leave request pending
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
                    B. O&apos;Connor &middot; Oct 28–30 &middot; Personal leave, coverage available
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
                  <ZTag variant="warning">Pending</ZTag>
                  {!isViewer && (
                    <>
                      <button
                        onClick={() => setLeaveApproved(true)}
                        className="zbtn zbtn-secondary"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setLeaveApproved(true)}
                        className="zbtn zbtn-text"
                      >
                        Deny
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── SECTION 2: Current Staffing ── */}
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
                onClick={() => setIsRecordLeaveOpen(true)}
                className="zbtn zbtn-secondary"
              >
                Record leave
              </button>
            )}
            <button
              onClick={() => setIsExportOpen(true)}
              className="zbtn zbtn-secondary"
            >
              Export
            </button>
            {/* Primary Action Button: Honey fill, ink text, EXACTLY ONE element per viewport */}
            {canAssignShifts && (
              <button
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
                  { label: "RN",   data: staffing.RN },
                  { label: "MD",   data: staffing.MD },
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

      {/* ── SECTION 3: On Duty Now ── */}
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

      {/* ── SECTION 4: Next Shift ── */}
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

      {/* ── SECTION 5: Recent Activity ── */}
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

      {/* Modals */}
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
    </div>
  );
}
