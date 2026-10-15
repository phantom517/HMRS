"use client";

import { useState, useMemo } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { Search, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { ExportModal } from "@/components/modals/ExportModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  PageHeader,
  SummaryLine,
  zSelectStyle,
  zFieldStyle,
  initialsOf,
} from "@/components/layout/PageHeader";
import { getRosterWeek, netHoursOf, isNightShiftType, formatHours } from "@/lib/schedule-cycle";

interface ReportsStatisticsClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  departmentSettings: any;
}

// Warm-neutral chart palette (per design system — no honey in charts)
const CHART_DAY = "#d9d3ca";
const CHART_EVENING = "#a79f94";
const CHART_NIGHT = "#121718";
const CHART_SHORTFALL = "#9b2c1f";

function shiftFamilyOf(a: any, shiftTypes: Array<any>): "Day" | "Evening" | "Night" {
  const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
  if (!st) return "Day";
  if (isNightShiftType(st)) return "Night";
  const startHour = parseInt(String(st.startTime).split(":")[0], 10);
  return startHour >= 14 ? "Evening" : "Day";
}

export function ReportsStatisticsClient({
  currentUser,
  employees,
  shiftTypes,
  assignments,
  leaveRecords,
  departmentSettings,
}: ReportsStatisticsClientProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchStaff, setSearchStaff] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const canExportReports = currentUser.permissions?.canExportReports;

  const week = getRosterWeek(weekOffset);
  const weeklySettings = departmentSettings;

  // ── Week-scoped data, identical to the Roster page's slice ──
  const weekAssignments = useMemo(
    () => assignments.filter((a) => a.date >= week.startDate && a.date <= week.endDate),
    [assignments, week.startDate, week.endDate]
  );

  const totalShifts = weekAssignments.filter((a) => a.status !== "cancelled").length;
  const totalHours = weekAssignments
    .filter((a) => a.status !== "cancelled")
    .reduce((acc, a) => acc + netHoursOf(shiftTypes.find((s) => s.id === a.shiftTypeId)), 0);
  const nightShifts = weekAssignments.filter((a) => {
    const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
    return a.status !== "cancelled" && isNightShiftType(st);
  }).length;
  const conflicts = weekAssignments.filter((a) => a.conflictFlag && a.status !== "cancelled").length;

  // Required per day: same rule as the Roster coverage footer.
  const requiredPerDay = useMemo(() => {
    const active = shiftTypes.filter(
      (s) => s.active && !/STANDBY|ON-?CALL/i.test(s.category || "")
    );
    const ruleSum = active.reduce((sum, s) => sum + (s.minimumStaffRn || 0) + (s.minimumStaffMd || 0), 0);
    return Math.min(Math.ceil(ruleSum / 2), employees.length);
  }, [shiftTypes, employees.length]);

  // Chart data: stacked shift-type composition per day + shortfall vs required.
  const dailyTimelineData = useMemo(() => {
    return week.dates.map((d) => {
      const dayAsgs = weekAssignments.filter((a) => a.date === d.date && a.status !== "cancelled");
      const counts = { Day: 0, Evening: 0, Night: 0 };
      for (const a of dayAsgs) counts[shiftFamilyOf(a, shiftTypes)] += 1;
      const scheduled = dayAsgs.length;
      const dayLabel = d.isToday ? `${d.weekday} (today)` : d.weekday;
      return {
        day: dayLabel,
        ...counts,
        Short: scheduled < requiredPerDay ? requiredPerDay - scheduled : 0,
        Scheduled: scheduled,
        isFuture: !d.isToday && d.date > getTodayISO(),
      };
    });
  }, [week, weekAssignments, requiredPerDay, shiftTypes]);

  function getTodayISO() {
    // The cycle's "today" (see lib/schedule-cycle.ts — one date source)
    return getRosterWeek(0).dates.find((d) => d.isToday)!.date;
  }

  const hasAnyWeekData = dailyTimelineData.some((d) => d.Scheduled > 0);

  // Leave panel: real counts by family (Days, not jargon)
  const leaveBarData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leaveRecords) {
      if (l.status === "cancelled") continue;
      const typeId = (l.leaveTypeId || "").toLowerCase();
      const label = typeId.includes("sick")
        ? "Sick"
        : typeId.includes("annual")
        ? "Annual"
        : typeId.includes("casual")
        ? "Casual"
        : typeId.includes("cme")
        ? "CME"
        : "Other";
      counts.set(label, (counts.get(label) || 0) + (Number(l.durationDays) || 1));
    }
    const entries = Array.from(counts.entries()).map(([label, days]) => ({ label, days }));
    return entries.length > 0 ? entries : null;
  }, [leaveRecords]);
  const leaveMax = leaveBarData ? Math.max(...leaveBarData.map((e) => e.days), 1) : 1;

  // Clinician table
  const employeeStats = useMemo(() => {
    return employees
      .filter((e) => {
        if (selectedRole === "MD" && !e.designation.includes("MD")) return false;
        if (selectedRole === "Nurse" && !e.designation.includes("Nurse") && !e.designation.includes("RN")) return false;
        if (selectedRole === "Tech" && !e.designation.includes("Tech") && !e.designation.includes("Paramedic")) return false;
        if (searchStaff.trim()) {
          const q = searchStaff.toLowerCase();
          return (
            e.fullName.toLowerCase().includes(q) ||
            e.employeeId.toLowerCase().includes(q) ||
            e.unit.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((emp) => {
        const empAsgs = weekAssignments.filter((a) => a.employeeId === emp.id && a.status !== "cancelled");
        const nights = empAsgs.filter((a) => isNightShiftType(shiftTypes.find((s) => s.id === a.shiftTypeId))).length;
        const totalHours = empAsgs.reduce(
          (sum, a) => sum + netHoursOf(shiftTypes.find((s) => s.id === a.shiftTypeId)),
          0
        );
        const weeklyCap = weeklySettings?.weeklyHoursCap || 48;
        return {
          ...emp,
          totalAssigned: empAsgs.length,
          nights,
          totalHours,
          overtimeHours: Math.max(0, totalHours - weeklyCap),
        };
      })
      .filter((s) => s.totalAssigned > 0);
  }, [employees, weekAssignments, shiftTypes, selectedRole, searchStaff, weeklySettings]);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Shifts, hours, and leave for the current week."
        actions={
          <>
            {canExportReports && (
              <button onClick={() => setShowExportModal(true)} className="zbtn zbtn-secondary">
                <span>Export</span>
              </button>
            )}
            <button onClick={() => window.print()} className="zbtn zbtn-secondary">
              <Printer style={{ width: 14, height: 14 }} />
              <span>Print</span>
            </button>
          </>
        }
        summary={
          <SummaryLine
            parts={[
              { label: "shifts", value: totalShifts },
              { label: "scheduled", value: formatHours(totalHours) },
              { label: "night shifts", value: nightShifts },
              ...(conflicts > 0 ? [{ label: "conflicts", value: conflicts, critical: true }] : []),
            ]}
          />
        }
      />

      {/* Toolbar: week selector left, table filters right */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 3,
            background: "var(--linen)",
            borderRadius: 12,
            border: "1px solid var(--ink-border)",
          }}
        >
          <button
            aria-label="Previous week"
            onClick={() => setWeekOffset((w) => w - 1)}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-secondary)",
            }}
          >
            <ChevronLeft style={{ width: 15, height: 15 }} />
          </button>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              padding: "0 6px",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {week.weekLabel}
          </span>
          <button
            aria-label="Next week"
            onClick={() => setWeekOffset((w) => w + 1)}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-secondary)",
            }}
          >
            <ChevronRight style={{ width: 15, height: 15 }} />
          </button>
        </div>

        <div style={{ position: "relative", width: 210, marginLeft: "auto" }}>
          <Search
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: "var(--ink-tertiary)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={searchStaff}
            onChange={(e) => setSearchStaff(e.target.value)}
            placeholder="Search staff…"
            style={{ ...zFieldStyle, width: "100%", padding: "0 12px 0 34px" }}
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          aria-label="Filter by role"
          style={{ ...zSelectStyle, minWidth: 110 }}
        >
          <option value="All">All roles</option>
          <option value="MD">Physicians</option>
          <option value="Nurse">Nurses</option>
          <option value="Tech">Techs</option>
        </select>
      </div>

      {/* ── Panels: 2/3 chart + 1/3 leave list (stacks under 760px) ── */}
      <div
        className="reports-panels"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <Panel
          title="Shifts by day"
          desc="Bars show shift-type mix. Red = short of the required minimum."
        >
          {hasAnyWeekData ? (
            <div style={{ height: 280, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTimelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="rgba(18, 23, 24, 0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 13, fill: "rgba(18, 23, 24, 0.65)" }} axisLine={{ stroke: "rgba(18, 23, 24, 0.12)" }} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 13, fill: "rgba(18, 23, 24, 0.65)" }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Staff on shift", angle: -90, position: "insideLeft", style: { fontSize: 13, fill: "rgba(18,23,24,0.65)", textAnchor: "middle" } }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(18, 23, 24, 0.04)" }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid rgba(18, 23, 24, 0.12)",
                      fontSize: "13px",
                      boxShadow: "none",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(18, 23, 24, 0.65)" }} align="left" verticalAlign="top" iconType="circle" iconSize={8} />
                  <Bar dataKey="Day" stackId="s" fill={CHART_DAY} />
                  <Bar dataKey="Evening" stackId="s" fill={CHART_EVENING} />
                  <Bar dataKey="Night" stackId="s" fill={CHART_NIGHT} />
                  <Bar
                    dataKey="Short"
                    stackId="s"
                    name="Short of required"
                    fill={CHART_SHORTFALL}
                    legendType="none"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: "56px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>No shifts this week</div>
              <div style={{ fontSize: 14, color: "var(--ink-secondary)", marginTop: 4 }}>
                Use the arrows to pick the roster week, or schedule shifts on the Roster page.
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Leave this month" desc="Days recorded, all types.">
          {leaveBarData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {leaveBarData.map((row) => (
                <div key={row.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "var(--ink)" }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                      {row.days} d
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgb(18 23 24 / 6%)", overflow: "hidden" }}>
                    <div style={{ width: `${(row.days / leaveMax) * 100}%`, height: "100%", background: "var(--ink)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>No leave recorded</div>
              <div style={{ fontSize: 14, color: "var(--ink-secondary)", marginTop: 4 }}>
                Approved leave requests will appear here.
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Clinician table ── */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 24,
        }}
      >
        <div className="overflow-x-auto">
          <table className="ztable">
            <thead>
              <tr>
                <th style={{ textAlign: "left", position: "sticky", left: 0, background: "var(--linen)" }}>Staff</th>
                <th style={{ textAlign: "left" }}>Role</th>
                <th className="num">Shifts</th>
                <th className="num">Nights</th>
                <th className="num">Hours</th>
                <th className="num">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-tertiary)", fontSize: 14 }}>
                    No shifts recorded for this week — try another week.
                  </td>
                </tr>
              ) : (
                employeeStats.map((stat) => (
                  <tr key={stat.id}>
                    <td style={{ position: "sticky", left: 0, background: "var(--paper)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                        <span className="zavatar">{initialsOf(stat.fullName)}</span>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>
                            {stat.fullName}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--ink-tertiary)", lineHeight: 1.3 }}>
                            {stat.employeeId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap" }}>{stat.designation}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{stat.totalAssigned}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)" }}>
                      {stat.nights}
                    </td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                      {formatHours(stat.totalHours)}
                    </td>
                    <td
                      className="num"
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        color: stat.overtimeHours > 0 ? "var(--critical-text)" : "var(--ink-tertiary)",
                        fontWeight: stat.overtimeHours > 0 ? 500 : 400,
                      }}
                    >
                      {stat.overtimeHours > 0 ? formatHours(stat.overtimeHours) : "0"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        employees={employees}
        shiftTypes={shiftTypes}
        assignments={assignments}
        leaveRecords={leaveRecords}
      />
    </div>
  );
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--ink-border)",
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 14, color: "var(--ink-secondary)", margin: "4px 0 0" }}>{desc}</p>
      </div>
      {children}
    </div>
  );
}
