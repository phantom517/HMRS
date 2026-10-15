import { db } from "@/lib/db";

/**
 * Smart Fill — automatic roster filler.
 *
 * Fills ONLY the shortfall: for each date and active shift type it tops staffing up
 * to the shift type minimums (minimumStaffRn + minimumStaffMd, plus a small tech buffer
 * toward targetStaff). It never modifies or removes existing assignments.
 * Candidate scoring respects: approved leave, rotational off-days, the minimum rest
 * interval between shifts, the weekly-hours cap, and the consecutive-shifts fatigue cap.
 */

export interface SmartFillResult {
  created: Array<any>;
  skipped: number;
  byDate: Record<string, number>;
}

export async function runSmartFill(params: {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}): Promise<SmartFillResult> {
  const [employeesData, allShiftTypes, settings, rangeAssignments, rangeOffDays, rangeLeaves] =
    await Promise.all([
      db.getEmployees({ status: "active", pageSize: 1000 }),
      db.getShiftTypes(),
      db.getDepartmentSettings(),
      db.getShiftAssignments({ startDate: params.startDate, endDate: params.endDate }),
      db.getOffDays({ startDate: params.startDate, endDate: params.endDate }),
      db.getLeaveRecords({ startDate: params.startDate, endDate: params.endDate }),
    ]);

  const weeklyHourCap = (settings.weeklyHoursCap || 48) + 12; // soft tolerance, flagged not fatal
  const minRestHours = settings.minRestHoursBetweenShifts || 11;
  const consecutiveCap = settings.consecutiveShiftsCap || 5;

  // Week padding around the range so cross-boundary rest/streak checks work.
  const prevWeekAssignments = await db.getShiftAssignments({
    startDate: shiftDate(params.startDate, -7),
    endDate: shiftDate(params.startDate, -1),
  });
  const nextWeekAssignments = await db.getShiftAssignments({
    startDate: shiftDate(params.endDate, 1),
    endDate: shiftDate(params.endDate, 7),
  });

  const shiftTypes = allShiftTypes.filter(
    (s) => s.active && !/STANDBY|ON-?CALL/i.test(s.category || "")
  );
  const employees = employeesData.employees;
  const shiftTypeMap = new Map(allShiftTypes.map((s) => [s.id, s]));

  // --- indexes -------------------------------------------------------------
  const assignmentsByDate = new Map<string, Array<any>>();
  const assignmentsByEmp = new Map<string, Array<any>>();
  const allPreexisting = [...prevWeekAssignments, ...rangeAssignments, ...nextWeekAssignments];
  for (const a of allPreexisting) {
    if (!assignmentsByDate.has(a.date)) assignmentsByDate.set(a.date, []);
    assignmentsByDate.get(a.date)!.push(a);
    if (!assignmentsByEmp.has(a.employeeId)) assignmentsByEmp.set(a.employeeId, []);
    assignmentsByEmp.get(a.employeeId)!.push(a);
  }

  const offDaysByEmp = new Map<string, Set<string>>();
  for (const off of rangeOffDays) {
    if (!offDaysByEmp.has(off.employeeId)) offDaysByEmp.set(off.employeeId, new Set());
    offDaysByEmp.get(off.employeeId)!.add(off.date);
  }

  const leavesByEmp = new Map<string, Array<any>>();
  for (const leave of rangeLeaves) {
    if (leave.status !== "approved") continue;
    if (!leavesByEmp.has(leave.employeeId)) leavesByEmp.set(leave.employeeId, []);
    leavesByEmp.get(leave.employeeId)!.push(leave);
  }

  const hoursByEmp = new Map<string, number>();
  for (const emp of employees) {
    hoursByEmp.set(emp.id, weekHoursFor(assignmentsByEmp.get(emp.id) || [], shiftTypeMap));
  }

  function roleOf(emp: any): "RN" | "MD" | "TECH" {
    const d = emp.designation || "";
    if (/MD|Physician|Surgeon|Intensivist|Toxicolog|Anesthesiolog/i.test(d)) return "MD";
    if (/Tech|Paramedic|EMT/i.test(d)) return "TECH";
    return "RN";
  }

  const created: Array<any> = [];
  const liveAssignmentsByDate = new Map(assignmentsByDate); // includes new ones as we fill
  let skipped = 0;
  const byDate: Record<string, number> = {};

  const dates = listDates(params.startDate, params.endDate);

  // Live bookkeeping of what we add during this run
  const newByDate = new Map<string, Array<any>>();
  const newByEmp = new Map<string, Array<any>>();

  function dayPool(date: string): Array<any> {
    return [...(assignmentsByDate.get(date) || []), ...(newByDate.get(date) || [])];
  }
  function empPool(empId: string): Array<any> {
    return [...(assignmentsByEmp.get(empId) || []), ...(newByEmp.get(empId) || [])];
  }

  for (const date of dates) {
    const dayAssignments = dayPool(date);

    for (const shift of shiftTypes) {
      const current = dayAssignments.filter(
        (a) => a.shiftTypeId === shift.id && a.status !== "cancelled"
      );

      const roleCounts = { RN: 0, MD: 0, TECH: 0 };
      for (const a of current) {
        const emp = employees.find((e) => e.id === a.employeeId);
        if (emp) roleCounts[roleOf(emp)]++;
      }

      const needRn = Math.max(0, (shift.minimumStaffRn || 0) - roleCounts.RN);
      const needMd = Math.max(0, (shift.minimumStaffMd || 0) - roleCounts.MD);
      const techBudget = Math.max(
        0,
        Math.min(2, (shift.targetStaff || 0) - current.length - needRn - needMd)
      );
      const needed = { RN: needRn, MD: needMd, TECH: techBudget };
      const totalNeeded = needRn + needMd + techBudget;
      if (totalNeeded === 0) continue;

      // --- candidate scoring -------------------------------------------------
      const candidates = employees
        .map((emp) => {
          const role = roleOf(emp);
          if (needed[role] <= 0) return null;

          if (dayAssignments.some((a) => a.employeeId === emp.id && a.status !== "cancelled")) {
            return null; // already assigned that day
          }

          const empLeaves = leavesByEmp.get(emp.id) || [];
          if (empLeaves.some((l) => l.startDate <= date && l.endDate >= date)) return null;

          // Fatigue: consecutive-day streak across the scheduled day (back + forward)
          const streakBack = countStreak(emp.id, date, -1, empPool(emp.id));
          const streakFwd = countStreak(emp.id, date, +1, empPool(emp.id));
          const potentialStreak = streakBack + 1 + streakFwd;
          if (potentialStreak > consecutiveCap) return null;

          // Weekly hours cap (soft — overCap trailers get flagged for review)
          const shiftHours = shiftDuration(shift);
          const hoursSoFar = (hoursByEmp.get(emp.id) || 0) + shiftHours;
          if (hoursSoFar > weeklyHourCap) return null;

          // Rest interval vs every neighbouring shift (day before/after)
          if (!restIntervalOk(empPool(emp.id), date, shift, shiftTypeMap, minRestHours)) return null;

          // Soft preference: keep trauma/resus-bay staff on high-acuity shifts, spread load
          const highAcuity = /Resus|Trauma/i.test(shift.name || "");
          const acuityAffinity = highAcuity && /Resus|Trauma/i.test(emp.unit || "") ? 2 : 0;
          const offDayPenalty = offDaysByEmp.get(emp.id)?.has(date) ? -5 : 0;
          const score = acuityAffinity + offDayPenalty - hoursSoFar / 20;

          return { emp, score, overCap: hoursSoFar > (settings.weeklyHoursCap || 48) };
        })
        .filter(Boolean) as Array<{ emp: any; score: number; overCap: boolean }>;

      candidates.sort((a, b) => b.score - a.score);

      // --- greedy fill --------------------------------------------------------
      const filled = { RN: 0, MD: 0, TECH: 0 };
      for (const cand of candidates) {
        const role = roleOf(cand.emp);
        if (filled[role] >= needed[role]) continue;
        if (filled.RN + filled.MD + filled.TECH >= totalNeeded) break;

        const startAt = new Date(`${date}T${shift.startTime}:00Z`);
        let endAt = new Date(`${date}T${shift.endTime}:00Z`);
        if (shift.crossesMidnight) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

        const record = {
          employeeId: cand.emp.id,
          shiftTypeId: shift.id,
          date,
          startAt,
          endAt,
          scheduledBreakMinutes: shift.breakDurationMinutes || 30,
          status: "assigned",
          wardZone: cand.emp.unit,
          stationRole: cand.emp.designation,
          notes: "Smart Fill: auto-scheduled to meet minimum safe staffing.",
          handoverNotes: null,
          conflictFlag: cand.overCap,
          conflictReason: cand.overCap
            ? "Smart Fill: weekly hours above soft cap flagged for manager review."
            : null,
          createdBy: "Smart Fill Engine",
          updatedBy: null,
        };

        const saved = await db.createShiftAssignment(record);
        created.push(saved);

        // Update live pools
        if (!newByDate.has(date)) newByDate.set(date, []);
        newByDate.get(date)!.push({ ...record, id: saved.id });
        if (!newByEmp.has(cand.emp.id)) newByEmp.set(cand.emp.id, []);
        newByEmp.get(cand.emp.id)!.push({ ...record, id: saved.id });
        hoursByEmp.set(cand.emp.id, (hoursByEmp.get(cand.emp.id) || 0) + shiftDuration(shift));

        filled[role]++;
        byDate[date] = (byDate[date] || 0) + 1;
      }

      skipped += totalNeeded - (filled.RN + filled.MD + filled.TECH);
    }
  }

  return { created, skipped, byDate };
}

// --- pure helpers -----------------------------------------------------------

function shiftDate(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function listDates(startDate: string, endDate: string): Array<string> {
  const out: Array<string> = [];
  let cur = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().split("T")[0]);
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

function shiftDuration(shift: any): number {
  return parseFloat(shift.netDurationHours as string) || 8;
}

function weekHoursFor(assignments: Array<any>, shiftTypeMap: Map<string, any>): number {
  let total = 0;
  for (const a of assignments) {
    const st = shiftTypeMap.get(a.shiftTypeId);
    total += st ? shiftDuration(st) : 8;
  }
  return total;
}

function countStreak(
  employeeId: string,
  fromDate: string,
  direction: -1 | 1,
  empAssignments: Array<any>
): number {
  let streak = 0;
  for (let i = 1; i <= 14; i++) {
    const day = shiftDate(fromDate, direction * i);
    const has = empAssignments.some(
      (a) => a.employeeId === employeeId && a.date === day && a.status !== "cancelled"
    );
    if (has) streak++;
    else break;
  }
  return streak;
}

function startAtMs(date: string, shift: any): number {
  const [h, m] = shift.startTime.split(":").map(Number);
  return new Date(`${date}T00:00:00Z`).getTime() + (h * 60 + m) * 60000;
}

function endAtMs(date: string, shift: any): number {
  const [h, m] = shift.endTime.split(":").map(Number);
  let end = new Date(`${date}T00:00:00Z`).getTime() + (h * 60 + m) * 60000;
  if (shift.crossesMidnight) end += 24 * 3600 * 1000;
  return end;
}

function restIntervalOk(
  empAssignments: Array<any>,
  date: string,
  shift: any,
  shiftTypeMap: Map<string, any>,
  minRestHours: number
): boolean {
  const minRestMs = minRestHours * 3600 * 1000;
  const startMs = startAtMs(date, shift);
  const endMs = endAtMs(date, shift);

  for (const a of empAssignments) {
    if (a.status === "cancelled") continue;
    const other = shiftTypeMap.get(a.shiftTypeId);
    if (!other) continue;

    const gapDays =
      Math.abs(new Date(`${a.date}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) /
      86400000;
    if (gapDays > 1) continue; // only adjacent days constrain rest

    const otherStart = startAtMs(a.date, other);
    const otherEnd = endAtMs(a.date, other);

    // Gap from the end of the other shift to the start of this one
    if (otherEnd <= startMs && startMs - otherEnd < minRestMs) return false;
    // Gap from the end of this shift to the start of the other one
    if (otherStart >= endMs && otherStart - endMs < minRestMs) return false;
    // Overlap
    if (startMs < otherEnd && otherStart < endMs) return false;
  }
  return true;
}
