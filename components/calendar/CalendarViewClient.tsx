"use client";

import { useState, useMemo } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { X } from "lucide-react";
import {
  updateShiftAssignmentAction,
  deleteShiftAssignmentAction,
} from "@/lib/actions/shifts";
import { QuickAssignModal } from "@/components/modals/QuickAssignModal";
import { ConflictCheckerModal } from "@/components/modals/ConflictCheckerModal";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CalendarToolbar,
  type CalendarViewMode,
} from "@/components/calendar/CalendarToolbar";
import {
  MonthGridView,
  type CalendarDay,
} from "@/components/calendar/MonthGridView";
import { WeekScheduleTable } from "@/components/calendar/WeekScheduleTable";
import {
  AssignmentDetailDialog,
  type AssignmentStatus,
} from "@/components/calendar/AssignmentDetailDialog";

interface CalendarViewClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  settings: any;
}

const NOTIFICATION_TTL_MS = 3000;

export function CalendarViewClient({
  currentUser,
  employees,
  shiftTypes,
  assignments: initialAssignments,
  leaveRecords,
  offDays,
  settings,
}: CalendarViewClientProps) {
  void settings;
  const [assignments, setAssignments] = useState(initialAssignments);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
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

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    if (type === "success") setTimeout(() => setNotification(null), NOTIFICATION_TTL_MS);
  }

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
  const calendarDays: CalendarDay[] = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const startingDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();

    const days: CalendarDay[] = [];

    // Prev month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({ dateString: dStr, dayNum, isCurrentMonth: false, isToday: dStr === "2024-10-24" });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({ dateString: dStr, dayNum: i, isCurrentMonth: true, isToday: dStr === "2024-10-24" });
    }

    // Next month padding to fill complete weeks (up to multiple of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dStr = `${nextY}-${String(nextM + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        days.push({ dateString: dStr, dayNum: i, isCurrentMonth: false, isToday: false });
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

  const handleStatusChange = async (newStatus: AssignmentStatus) => {
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
        notify("success", `Shift status changed to ${newStatus}.`);
      }
    } catch (error: any) {
      notify("error", error.message || "Failed to update status.");
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
      notify("success", "Assignment deleted.");
    } catch (error: any) {
      notify("error", error.message || "Failed to delete assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Notifications */}
      {notification && (
        <Alert variant={notification.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{notification.message}</AlertDescription>
          <AlertAction className="top-2 right-2">
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setNotification(null)}>
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Page Title */}
      <div>
        <h1 className="m-0 text-[32px] font-medium leading-tight tracking-tight text-foreground">
          Department Schedule
        </h1>
        <div className="mt-2 flex flex-col gap-0.5">
          <span className="text-base font-normal leading-snug text-muted-foreground">
            Emergency &amp; Critical Care &middot; Live Calendar
          </span>
          <span className="text-[13px] text-muted-foreground/80">
            Real-time shift coverage, fatigue guardrails, and compliance tracking.
          </span>
        </div>
      </div>

      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentMonth={currentMonth}
        currentYear={currentYear}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        employeeCount={employees.length}
        onOpenConflicts={() => setShowConflictModal(true)}
        canAssignShifts={Boolean(currentUser.permissions?.canAssignShifts)}
        onAssignShift={() => {
          setQuickAssignDate(selectedDate);
          setShowQuickAssignModal(true);
        }}
      />

      {/* Main Calendar View Area */}
      {viewMode === "month" ? (
        <MonthGridView
          calendarDays={calendarDays}
          assignmentsByDate={assignmentsByDate}
          leavesByDate={leavesByDate}
          empMap={empMap}
          shiftMap={shiftMap}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          canAssignShifts={Boolean(currentUser.permissions?.canAssignShifts)}
          onQuickAssign={(date) => {
            setQuickAssignDate(date);
            setShowQuickAssignModal(true);
          }}
          onSelectAssignment={setSelectedAssignment}
          onSeeWeek={(date) => {
            setSelectedDate(date);
            setViewMode("week");
          }}
        />
      ) : (
        /* Week View: 7-day schedule with expanded employee rows */
        <WeekScheduleTable
          weekDays={weekDays}
          filteredEmployees={filteredEmployees}
          assignments={assignments}
          leaveRecords={leaveRecords}
          offDays={offDays}
          shiftMap={shiftMap}
          canAssignShifts={Boolean(currentUser.permissions?.canAssignShifts)}
          onQuickAssign={(date) => {
            setQuickAssignDate(date);
            setShowQuickAssignModal(true);
          }}
          onSelectAssignment={setSelectedAssignment}
        />
      )}

      {/* Selected Assignment Detail Dialog */}
      <AssignmentDetailDialog
        assignment={selectedAssignment}
        employee={selectedAssignment ? empMap.get(selectedAssignment.employeeId) : undefined}
        onClose={() => setSelectedAssignment(null)}
        onStatusChange={handleStatusChange}
        onDelete={handleDeleteAssignment}
        isSubmitting={isSubmitting}
      />

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
