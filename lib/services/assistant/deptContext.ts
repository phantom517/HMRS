import { db } from "@/lib/db";
import { getRosterWeek, cycleToday } from "@/lib/schedule-cycle";

// ---------------------------------------------------------------------------
// DB-backed context loader + entity resolvers (extracted from aiAssistant.ts)
// ---------------------------------------------------------------------------

// Context builder + resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve a shift type from its internal id OR short code ("D", "E", "N"…).
 * The roster is driven by short codes in conversation, but every server action
 * expects the internal id — mapping here is what makes AI assignments work.
 */
export async function resolveShiftType(query: string) {
    if (!query) return null;
    const all = await db.getShiftTypes();
    const q = String(query).trim().toLowerCase();
    return (
        all.find((s) => s.id.toLowerCase() === q) ||
        all.find((s) => s.shortCode.toLowerCase() === q) ||
        all.find((s) => (s.name || "").toLowerCase() === q) ||
        null
    );
}

export async function buildDepartmentContext() {
    const { startDate, endDate } = getRosterWeek(0);
    const [
        employees,
        shiftTypes,
        assignments,
        leaves,
        offDays,
        settings,
        leaveTypes,
        unitsList,
        rolesList,
    ] = await Promise.all([
        db.getEmployees({ pageSize: 500 }),
        db.getShiftTypes(),
        db.getShiftAssignments({ startDate, endDate }),
        db.getLeaveRecords({}),
        db.getOffDays({ startDate, endDate }),
        db.getDepartmentSettings(),
        db.getLeaveTypes(),
        db.getUnits(),
        db.getRoles(),
    ]);

    return {
        departmentSettings: settings,
        employees: employees.employees.map((e) => ({
            id: e.id,
            code: e.employeeId,
            name: e.fullName,
            designation: e.designation,
            unit: e.unit,
            status: e.employmentStatus,
        })),
        shiftTypes: shiftTypes.map((s) => ({
            id: s.id,
            code: s.shortCode,
            name: s.name,
            time: `${s.startTime}-${s.endTime}`,
            netHours: Number(s.netDurationHours) || 8,
            active: s.active,
            minRN: s.minimumStaffRn,
            minMD: s.minimumStaffMd,
        })),
        rosterWeek: { startDate, endDate, today: cycleToday() },
        guardrails: {
            weeklyHoursCap: settings?.weeklyHoursCap || 48,
            minRestHoursBetweenShifts:
                settings?.minRestHoursBetweenShifts || 11,
            consecutiveShiftsCap: settings?.consecutiveShiftsCap || 5,
        },
        currentWeekRoster: assignments.map((a) => ({
            assignmentId: a.id,
            employeeId: a.employeeId,
            date: a.date,
            shiftTypeId: a.shiftTypeId,
            status: a.status,
            conflict: a.conflictFlag || undefined,
        })),
        leaveTypes: leaveTypes.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
        })),
        units: unitsList.map((u: any) => ({
            id: u.id,
            name: u.name,
            active: u.active,
        })),
        roles: rolesList.map((r: any) => ({
            id: r.id,
            name: r.name,
            staffClass: r.staffClass,
            active: r.active,
        })),
        leaves: leaves.slice(0, 40).map((l) => ({
            id: l.id,
            employeeId: l.employeeId,
            typeId: l.leaveTypeId,
            from: l.startDate,
            to: l.endDate,
            status: l.status,
        })),
        offDaysThisWeek: offDays.map((o) => ({
            id: o.id,
            employeeId: o.employeeId,
            date: o.date,
        })),
    };
}

export async function resolveUnit(query: string) {
    const all = await db.getUnits();
    const q = String(query).trim().toLowerCase();
    return (
        all.find((u: any) => u.id.toLowerCase() === q) ||
        all.find((u: any) => (u.name || "").toLowerCase() === q) ||
        null
    );
}

export async function resolveRole(query: string) {
    const all = await db.getRoles();
    const q = String(query).trim().toLowerCase();
    return (
        all.find((r: any) => r.id.toLowerCase() === q) ||
        all.find((r: any) => (r.name || "").toLowerCase() === q) ||
        null
    );
}

export async function resolveEmployee(query: string) {
    const { employees } = await db.getEmployees({ pageSize: 500 });
    const q = String(query).trim().toLowerCase();
    return (
        employees.find((e) => e.id.toLowerCase() === q) ||
        employees.find((e) => e.employeeId.toLowerCase() === q) ||
        employees.find((e) => e.fullName.toLowerCase() === q) ||
        employees.find(
            (e) =>
                e.fullName.toLowerCase().includes(q) ||
                e.employeeId.toLowerCase().includes(q),
        ) ||
        null
    );
}

/**
 * Cap a model-supplied list argument. A single assistant action may touch at
 * most 20 records — anything larger is refused with the count, so the model
 * can split the request, and the PENDING list is never silently truncated.
 */
const BULK_LIMIT = 20;
export function capBulkArgs(
    list: unknown,
    what: string,
    limit = BULK_LIMIT,
): string[] {
    if (Array.isArray(list) && list.length > limit) {
        throw new Error(
            `Too many ${what} in one action (limit ${limit}; got ${list.length}). Split it into several calls of ≤ ${limit}.`,
        );
    }
    return Array.isArray(list) ? list.map(String) : [];
}

/** Bulk pre-resolve: every id/code must match a real employee — none may fail. */
export async function resolveEmployeesOrThrow(codes: string[]) {
    const resolved: Array<{
        id: string;
        fullName?: string;
        employeeId?: string;
    }> = [];
    const missing: string[] = [];
    for (const code of codes) {
        const emp = await resolveEmployee(code);
        if (emp)
            resolved.push({
                id: emp.id,
                fullName: (emp as any).fullName,
                employeeId: (emp as any).employeeId,
            });
        else missing.push(String(code));
    }
    if (missing.length > 0) {
        throw new Error(
            `No employee match${missing.length === 1 ? "es" : ""} for: ${missing.join(", ")}. Resolve names/codes with get_department_context first.`,
        );
    }
    return resolved;
}
