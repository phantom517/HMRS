"use client";

import { useState, useMemo } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  User,
  Shield,
  Layers,
  Sparkles,
  Info,
  CalendarDays,
  Grid3X3,
  ListFilter,
  Check,
  Ban,
  Phone,
} from "lucide-react";
import {
  createShiftAssignmentAction,
  updateShiftAssignmentAction,
  deleteShiftAssignmentAction,
} from "@/lib/actions/shifts";
import { QuickAssignModal } from "@/components/modals/QuickAssignModal";
import { ConflictCheckerModal } from "@/components/modals/ConflictCheckerModal";
import Image from "next/image";

interface CalendarViewClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  settings: any;
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

export function CalendarViewClient({
  currentUser,
  employees,
  shiftTypes,
  assignments: initialAssignments,
  leaveRecords,
  offDays,
  settings,
}: CalendarViewClientProps) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentYear, setCurrentYear] = useState(2024);
  const [currentMonth, setCurrentMonth] = useState(9); // 0-indexed: 9 = October
  const [selectedUnit, setSelectedUnit] = useState<string>("All");
  const [selectedRole, setSelectedRole] = useState<string>("All");
  const [selectedDate, setSelectedDate] = useState<string>("2024-10-25");
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);

  // Modals
  const [showQuickAssignModal, setShowQuickAssignModal] = useState(false);
  const [quickAssignDate, setQuickAssignDate] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const shiftMap = useMemo(() => {
    const map = new Map<string, any>();
    shiftTypes.forEach((st) => {
      map.set(st.id, st);
      map.set(st.shortCode, st);
    });
    return map;
  }, [shiftTypes]);

  const empMap = useMemo(() => {
    const map = new Map<string, any>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedUnit !== "All" && !e.unit.includes(selectedUnit)) return false;
      if (selectedRole !== "All" && !e.designation.includes(selectedRole)) return false;
      return true;
    });
  }, [employees, selectedUnit, selectedRole]);

  const filteredEmpIds = useMemo(() => {
    return new Set(filteredEmployees.map((e) => e.id));
  }, [filteredEmployees]);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const startingDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();

    const days: Array<{
      dateString: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Prev month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dateString: dStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dStr === "2024-10-24",
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateString: dStr,
        dayNum: i,
        isCurrentMonth: true,
        isToday: dStr === "2024-10-24",
      });
    }

    // Next month padding to fill complete weeks (up to multiple of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dStr = `${nextY}-${String(nextM + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        days.push({
          dateString: dStr,
          dayNum: i,
          isCurrentMonth: false,
          isToday: false,
        });
      }
    }

    return days;
  }, [currentYear, currentMonth]);

  // Assignments grouped by date
  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Array<any>>();
    assignments.forEach((a) => {
      if (a.status !== "cancelled" && filteredEmpIds.has(a.employeeId)) {
        const list = map.get(a.date) || [];
        list.push(a);
        map.set(a.date, list);
      }
    });
    return map;
  }, [assignments, filteredEmpIds]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, Array<any>>();
    leaveRecords.forEach((l) => {
      if (l.status === "approved" && filteredEmpIds.has(l.employeeId)) {
        let curr = new Date(l.startDate + "T00:00:00Z");
        const end = new Date(l.endDate + "T00:00:00Z");
        while (curr <= end) {
          const dateStr = curr.toISOString().split("T")[0];
          const list = map.get(dateStr) || [];
          list.push(l);
          map.set(dateStr, list);
          curr = new Date(curr.getTime() + 24 * 60 * 60 * 1000);
        }
      }
    });
    return map;
  }, [leaveRecords, filteredEmpIds]);

  const offDaysByDate = useMemo(() => {
    const map = new Map<string, Array<any>>();
    offDays.forEach((o) => {
      if (filteredEmpIds.has(o.employeeId)) {
        const list = map.get(o.date) || [];
        list.push(o);
        map.set(o.date, list);
      }
    });
    return map;
  }, [offDays, filteredEmpIds]);

  // Week view slice
  const weekDays = useMemo(() => {
    const targetIdx = calendarDays.findIndex((d) => d.dateString === selectedDate);
    if (targetIdx === -1) return calendarDays.slice(0, 7);
    const startOfWeekIdx = Math.floor(targetIdx / 7) * 7;
    return calendarDays.slice(startOfWeekIdx, startOfWeekIdx + 7);
  }, [calendarDays, selectedDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleStatusChange = async (newStatus: "assigned" | "completed" | "cancelled" | "missed") => {
    if (!selectedAssignment) return;
    setIsSubmitting(true);
    try {
      const res = await updateShiftAssignmentAction(selectedAssignment.id, {
        status: newStatus,
      });
      if (res.success) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === selectedAssignment.id ? { ...a, status: newStatus } : a))
        );
        setSelectedAssignment((prev: any) => (prev ? { ...prev, status: newStatus } : null));
        setNotification({ type: "success", message: `Shift status changed to ${newStatus}.` });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update status." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;
    if (!confirm("Are you sure you want to remove this shift assignment?")) return;
    setIsSubmitting(true);
    try {
      await deleteShiftAssignmentAction(selectedAssignment.id);
      setAssignments((prev) => prev.filter((a) => a.id !== selectedAssignment.id));
      setSelectedAssignment(null);
      setNotification({ type: "success", message: "Assignment deleted." });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to delete assignment." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Notifications */}
      {notification && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: notification.type === "success" ? "var(--linen)" : "var(--critical-bg)",
            color: notification.type === "success" ? "var(--ink)" : "var(--critical-text)",
            border: "1px solid var(--ink-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
          }}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="zbtn zbtn-text">
            <X style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
          </button>
        </div>
      )}

      {/* Page Title & Control Bar */}
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
          Department Schedule
        </h1>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 400, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
            Emergency &amp; Critical Care &middot; Live Calendar
          </span>
          <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>
            Real-time shift coverage, fatigue guardrails, and compliance tracking.
          </span>
        </div>
      </div>

      {/* Calendar Controls Surface */}
      <div
        className="zelt-surface"
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* View Mode Switcher */}
          <div
            style={{
              display: "inline-flex",
              padding: 3,
              background: "var(--linen)",
              borderRadius: 12,
              border: "1px solid var(--ink-border)",
            }}
          >
            <button
              onClick={() => setViewMode("month")}
              style={{
                padding: "6px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: viewMode === "month" ? 500 : 400,
                color: "var(--ink)",
                background: viewMode === "month" ? "var(--paper)" : "transparent",
                border: viewMode === "month" ? "1px solid var(--ink-border)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode("week")}
              style={{
                padding: "6px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: viewMode === "week" ? 500 : 400,
                color: "var(--ink)",
                background: viewMode === "week" ? "var(--paper)" : "transparent",
                border: viewMode === "week" ? "1px solid var(--ink-border)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              Week View
            </button>
          </div>

          {/* Month Stepper */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--linen)",
              padding: "4px 10px",
              borderRadius: 12,
              border: "1px solid var(--ink-border)",
            }}
          >
            <button
              onClick={handlePrevMonth}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              <ChevronLeft style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", minWidth: 130, textAlign: "center" }}>
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              <ChevronRight style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            </button>
          </div>

          {/* Right Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowConflictModal(true)}
              className="zbtn zbtn-secondary"
            >
              <AlertTriangle style={{ width: 14, height: 14, strokeWidth: 1.5, color: "var(--critical-text)" }} />
              <span>2 Conflicts</span>
            </button>

            {currentUser.permissions?.canAssignShifts && (
              <button
                onClick={() => {
                  setQuickAssignDate(selectedDate);
                  setShowQuickAssignModal(true);
                }}
                className="zbtn zbtn-primary"
              >
                <Plus style={{ width: 15, height: 15, strokeWidth: 1.5 }} />
                <span>Assign shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Lower Row: Filter bar & Shift legend */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--ink-border)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--ink-secondary)", fontWeight: 500 }}>Filter:</span>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                fontSize: 13,
                color: "var(--ink)",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <option value="All">All Units ({employees.length} staff)</option>
              <option value="Resuscitation">Trauma &amp; Resuscitation</option>
              <option value="Acute Care">Acute Care Bay</option>
              <option value="Rapid Assessment">Fast Track Ambulatory</option>
              <option value="Triage">Triage Station</option>
              <option value="Pediatric">Pediatric ED</option>
            </select>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                fontSize: 13,
                color: "var(--ink)",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <option value="All">All Roles</option>
              <option value="Physician">Physicians (MD)</option>
              <option value="Nurse">Nurses (RN)</option>
              <option value="Fellow">Fellows &amp; Residents</option>
              <option value="Triage">Triage Specialists</option>
            </select>
          </div>

          {/* Clean Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span className="ztag ztag-neutral">D (07:00)</span>
            <span className="ztag ztag-neutral">E (15:00)</span>
            <span className="ztag ztag-warning">N (22:00)</span>
            <span className="ztag ztag-neutral">Leave</span>
            <span style={{ color: "var(--ink-tertiary)" }}>Off</span>
          </div>
        </div>
      </div>

      {/* Main Calendar View Area */}
      {viewMode === "month" ? (
        <div className="zelt-surface" style={{ overflow: "hidden" }}>
          {/* Day of Week Headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--ink-border)",
              background: "var(--linen)",
              textAlign: "center",
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink-secondary)",
            }}
          >
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Grid Cells */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              background: "var(--ink-border)",
              gap: 1,
            }}
          >
            {calendarDays.map((day) => {
              const dayAssignments = assignmentsByDate.get(day.dateString) || [];
              const dayLeaves = leavesByDate.get(day.dateString) || [];
              const dayOffs = offDaysByDate.get(day.dateString) || [];
              const isSelected = selectedDate === day.dateString;
              const hasConflict = dayAssignments.some((a) => a.conflictFlag);

              return (
                <div
                  key={day.dateString}
                  onClick={() => setSelectedDate(day.dateString)}
                  style={{
                    minHeight: 120,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: isSelected
                      ? "var(--linen)"
                      : day.isCurrentMonth
                      ? "var(--paper)"
                      : "rgba(246, 243, 239, 0.4)",
                    cursor: "pointer",
                    transition: "background-color 150ms ease",
                  }}
                >
                  {/* Top Bar of Day Cell */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: day.isToday || isSelected ? 600 : 400,
                          color: "var(--ink)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {day.dayNum}
                      </span>
                      {hasConflict && (
                        <AlertTriangle style={{ width: 12, height: 12, strokeWidth: 1.5, color: "var(--critical-text)" }} />
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {dayAssignments.length > 0 && (
                        <span style={{ fontSize: 11, color: "var(--ink-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                          {dayAssignments.length} staff
                        </span>
                      )}
                      {currentUser.permissions?.canAssignShifts && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickAssignDate(day.dateString);
                            setShowQuickAssignModal(true);
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 6,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--ink-tertiary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title="Assign shift on this day"
                        >
                          <Plus style={{ width: 12, height: 12, strokeWidth: 1.5 }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List of Shift Badges in this Cell */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflow: "hidden" }}>
                    {dayAssignments.slice(0, 3).map((asg) => {
                      const emp = empMap.get(asg.employeeId);
                      const shift = shiftMap.get(asg.shiftTypeId);
                      const isNight = shift?.shortCode === "N";

                      return (
                        <div
                          key={asg.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssignment(asg);
                          }}
                          style={{
                            padding: "3px 6px",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 4,
                            background: asg.conflictFlag
                              ? "var(--critical-bg)"
                              : isNight
                              ? "var(--apricot)"
                              : "var(--linen)",
                            color: asg.conflictFlag ? "var(--critical-text)" : "var(--ink)",
                            border: "1px solid var(--ink-border)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{shift?.shortCode || "D"}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {emp?.fullName ? emp.fullName.split(" ").slice(-1)[0] : "Staff"}
                          </span>
                        </div>
                      );
                    })}

                    {dayAssignments.length > 3 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(day.dateString);
                          setViewMode("week");
                        }}
                        style={{ fontSize: 11, color: "var(--ink-secondary)", cursor: "pointer", paddingLeft: 2 }}
                      >
                        +{dayAssignments.length - 3} more...
                      </div>
                    )}

                    {dayLeaves.map((l) => {
                      const emp = empMap.get(l.employeeId);
                      return (
                        <div
                          key={l.id}
                          style={{
                            padding: "2px 6px",
                            borderRadius: 8,
                            fontSize: 10,
                            background: "var(--linen)",
                            color: "var(--ink-secondary)",
                            border: "1px solid var(--ink-border)",
                          }}
                        >
                          Leave: {emp?.fullName?.split(" ").slice(-1)[0] || "Staff"}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Day Status Indicator */}
                  <div style={{ paddingTop: 4, fontSize: 11, color: "var(--ink-tertiary)", display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {dayAssignments.length >= 6 ? "Full cover" : dayAssignments.length > 0 ? "Min met" : "Unscheduled"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Week View: 7-day schedule with expanded employee rows */
        <div className="zelt-surface" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              background: "var(--linen)",
              borderBottom: "1px solid var(--ink-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
              Week Schedule: {weekDays[0]?.dateString} to {weekDays[6]?.dateString}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-secondary)" }}>
              {filteredEmployees.length} staff across 7 clinical duty days
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="ztable" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 240 }}>Staff member</th>
                  {weekDays.map((d) => (
                    <th key={d.dateString} style={{ textAlign: "center" }}>
                      <div>{new Date(d.dateString + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short" })}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}>
                        {d.dayNum}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.slice(0, 15).map((emp) => {
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <ZAvatar name={emp.fullName} />
                          <div>
                            <div style={{ fontWeight: 500, color: "var(--ink)" }}>{emp.fullName}</div>
                            <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                              {emp.designation} &middot; {emp.unit}
                            </div>
                          </div>
                        </div>
                      </td>

                      {weekDays.map((d) => {
                        const asg = assignments.find((a) => a.employeeId === emp.id && a.date === d.dateString);
                        const isLeave = leaveRecords.some(
                          (l) => l.employeeId === emp.id && l.status === "approved" && d.dateString >= l.startDate && d.dateString <= l.endDate
                        );
                        const isOff = offDays.some((o) => o.employeeId === emp.id && o.date === d.dateString);
                        const shift = asg ? shiftMap.get(asg.shiftTypeId) : null;
                        const isNight = shift?.shortCode === "N";

                        return (
                          <td key={d.dateString} style={{ textAlign: "center", verticalAlign: "middle" }}>
                            {asg ? (
                              <button
                                onClick={() => setSelectedAssignment(asg)}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 10,
                                  background: asg.conflictFlag
                                    ? "var(--critical-bg)"
                                    : isNight
                                    ? "var(--apricot)"
                                    : "var(--linen)",
                                  color: asg.conflictFlag ? "var(--critical-text)" : "var(--ink)",
                                  border: "1px solid var(--ink-border)",
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 2,
                                  fontSize: 12,
                                  fontWeight: 500,
                                }}
                              >
                                <span>{shift?.shortCode}</span>
                                <span style={{ fontSize: 10, color: "var(--ink-secondary)" }}>
                                  {shift?.startTime.slice(0, 5)}
                                </span>
                              </button>
                            ) : isLeave ? (
                              <span className="ztag ztag-warning" style={{ fontSize: 11, padding: "2px 8px" }}>
                                Leave
                              </span>
                            ) : isOff ? (
                              <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>Off</span>
                            ) : currentUser.permissions?.canAssignShifts ? (
                              <button
                                onClick={() => {
                                  setQuickAssignDate(d.dateString);
                                  setShowQuickAssignModal(true);
                                }}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  background: "transparent",
                                  border: "1px solid var(--ink-border)",
                                  cursor: "pointer",
                                  color: "var(--ink-tertiary)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Plus style={{ width: 12, height: 12, strokeWidth: 1.5 }} />
                              </button>
                            ) : (
                              <span style={{ color: "var(--ink-tertiary)" }}>-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Assignment Detail Modal */}
      {selectedAssignment && (
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
              maxWidth: 480,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 16,
                borderBottom: "1px solid var(--ink-border)",
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>Shift Details</h3>
                <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>{selectedAssignment.date}</span>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                <X style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
              </button>
            </div>

            <div
              style={{
                padding: "12px 16px",
                background: "var(--linen)",
                borderRadius: 12,
                border: "1px solid var(--ink-border)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                {empMap.get(selectedAssignment.employeeId)?.fullName}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 2 }}>
                {empMap.get(selectedAssignment.employeeId)?.designation} &middot; {selectedAssignment.wardZone}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>Status</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {(["assigned", "completed", "cancelled"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      background: selectedAssignment.status === st ? "var(--paper)" : "var(--linen)",
                      border: selectedAssignment.status === st ? "1px solid var(--ink)" : "1px solid var(--ink-border)",
                      fontSize: 13,
                      fontWeight: selectedAssignment.status === st ? 500 : 400,
                      color: "var(--ink)",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 16,
                borderTop: "1px solid var(--ink-border)",
              }}
            >
              <button
                type="button"
                onClick={handleDeleteAssignment}
                disabled={isSubmitting}
                className="zbtn zbtn-text"
                style={{ color: "var(--critical-text)" }}
              >
                Delete assignment
              </button>

              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="zbtn zbtn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QuickAssignModal
        isOpen={showQuickAssignModal}
        onClose={() => setShowQuickAssignModal(false)}
        employees={employees}
        shiftTypes={shiftTypes}
        preselectedDate={quickAssignDate || undefined}
      />
      <ConflictCheckerModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </div>
  );
}
