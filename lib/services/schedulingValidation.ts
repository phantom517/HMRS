import { db } from "@/lib/db";

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
}

export async function validateShiftAssignment(params: {
  employeeId: string;
  shiftTypeId: string;
  date: string; // YYYY-MM-DD
  existingAssignmentId?: string;
  ignoreRestWarning?: boolean;
}): Promise<ValidationResult> {
  const errors: Array<{ code: string; message: string }> = [];
  const warnings: Array<{ code: string; message: string }> = [];

  const [employee, shiftType, settings] = await Promise.all([
    db.getEmployeeById(params.employeeId),
    db.getShiftTypeById(params.shiftTypeId),
    db.getDepartmentSettings(),
  ]);

  // 1. Employee existence and active status
  if (!employee) {
    errors.push({ code: "EMPLOYEE_NOT_FOUND", message: "Clinical employee does not exist." });
    return { isValid: false, errors, warnings };
  }

  if (employee.employmentStatus === "archived" || !employee.active) {
    errors.push({
      code: "EMPLOYEE_INACTIVE",
      message: `Cannot schedule ${employee.fullName}: Employee record is archived/inactive.`,
    });
  }

  // 2. Shift type existence and active status
  if (!shiftType) {
    errors.push({ code: "SHIFT_TYPE_NOT_FOUND", message: "Selected shift type does not exist." });
    return { isValid: false, errors, warnings };
  }

  if (!shiftType.active) {
    errors.push({
      code: "SHIFT_TYPE_INACTIVE",
      message: `Shift template [${shiftType.shortCode}] is deactivated and cannot accept new assignments.`,
    });
  }

  // 3. Check Approved Leave Conflict
  const leaves = await db.getLeaveRecords({ employeeId: params.employeeId });
  const approvedLeaveConflict = leaves.find(
    (l) => l.status === "approved" && l.startDate <= params.date && l.endDate >= params.date
  );

  if (approvedLeaveConflict) {
    errors.push({
      code: "LEAVE_CONFLICT",
      message: `${employee.fullName} is on approved leave from ${approvedLeaveConflict.startDate} to ${approvedLeaveConflict.endDate} (${approvedLeaveConflict.reason}).`,
    });
  }

  // 4. Check Scheduled Off-Days
  const offDays = await db.getOffDays({ employeeId: params.employeeId, date: params.date });
  if (offDays.length > 0) {
    warnings.push({
      code: "OFF_DAY_SCHEDULED",
      message: `${employee.fullName} has a recorded rotational off-day on ${params.date} (${offDays[0].reason}).`,
    });
  }

  // 5. Check Overlapping Shifts on Same Date
  const dayAssignments = await db.getShiftAssignments({
    employeeId: params.employeeId,
    startDate: params.date,
    endDate: params.date,
  });

  const overlap = dayAssignments.find(
    (a) => a.id !== params.existingAssignmentId && a.status !== "cancelled"
  );
  if (overlap) {
    const assignedShift = await db.getShiftTypeById(overlap.shiftTypeId);
    errors.push({
      code: "OVERLAPPING_SHIFT",
      message: `${employee.fullName} is already assigned to ${assignedShift?.name || "another shift"} on ${params.date}.`,
    });
  }

  // 6. Rest Interval & Turnaround Check (Min Rest Hours)
  // Calculate rest interval from previous day shift
  const prevDate = getRelativeDate(params.date, -1);
  const prevAssignments = await db.getShiftAssignments({
    employeeId: params.employeeId,
    startDate: prevDate,
    endDate: prevDate,
  });

  const activePrev = prevAssignments.find((a) => a.status !== "cancelled");
  if (activePrev && shiftType) {
    const prevShift = await db.getShiftTypeById(activePrev.shiftTypeId);
    if (prevShift) {
      const restHours = calculateRestIntervalHours(
        prevDate,
        prevShift.endTime,
        prevShift.crossesMidnight,
        params.date,
        shiftType.startTime
      );

      const minRest = settings.minRestHoursBetweenShifts || 11;
      if (restHours < minRest) {
        const warningMsg = `Rest turnaround violation: ${restHours.toFixed(1)}h rest between shifts (Mandatory minimum is ${minRest}h rest per JCAHO & Hospital Policy §4.1).`;
        if (params.ignoreRestWarning) {
          warnings.push({ code: "REST_VIOLATION_OVERRIDDEN", message: warningMsg });
        } else {
          warnings.push({ code: "REST_INTERVAL_BREACH", message: warningMsg });
        }
      }
    }
  }

  // 7. Consecutive Days Cap Check
  const consecutiveDays = await countConsecutiveDays(params.employeeId, params.date, params.existingAssignmentId);
  const maxConsecutive = settings.consecutiveShiftsCap || 5;
  if (consecutiveDays >= maxConsecutive) {
    warnings.push({
      code: "CONSECUTIVE_DAYS_LIMIT",
      message: `Fatigue Directive: ${employee.fullName} has ${consecutiveDays} consecutive shifts scheduled. Recommends mandatory 48h rest period.`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function getRelativeDate(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function calculateRestIntervalHours(
  prevDate: string,
  prevEndTime: string,
  prevCrossesMidnight: boolean,
  currDate: string,
  currStartTime: string
): number {
  const [peH, peM] = prevEndTime.split(":").map(Number);
  const [csH, csM] = currStartTime.split(":").map(Number);

  const prevEnd = new Date(`${prevDate}T00:00:00Z`);
  prevEnd.setUTCHours(peH, peM, 0, 0);
  if (prevCrossesMidnight) {
    prevEnd.setDate(prevEnd.getDate() + 1);
  }

  const currStart = new Date(`${currDate}T00:00:00Z`);
  currStart.setUTCHours(csH, csM, 0, 0);

  const diffMs = currStart.getTime() - prevEnd.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

async function countConsecutiveDays(employeeId: string, targetDate: string, excludeId?: string): Promise<number> {
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    const dayStr = getRelativeDate(targetDate, -i);
    const shifts = await db.getShiftAssignments({ employeeId, startDate: dayStr, endDate: dayStr });
    const hasShift = shifts.some((s) => s.id !== excludeId && s.status !== "cancelled");
    if (hasShift) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
