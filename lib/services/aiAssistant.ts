import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { getRosterWeek, cycleToday } from "@/lib/schedule-cycle";
import {
    createEmployeeAction,
    updateEmployeeAction,
    archiveEmployeeAction,
    restoreEmployeeAction,
} from "@/lib/actions/employees";
import {
    createUnitAction,
    updateUnitAction,
    deleteUnitAction,
    createRoleAction,
    updateRoleAction,
    deleteRoleAction,
} from "@/lib/actions/units";
import {
    createShiftTypeAction,
    updateShiftTypeAction,
    toggleShiftTypeActiveAction,
    createShiftAssignmentAction,
    deleteShiftAssignmentAction,
    bulkAssignShiftsAction,
    smartFillRosterAction,
    updateDepartmentSettingsAction,
} from "@/lib/actions/shifts";
import { loadSchedulingContext } from "@/lib/scheduling/loader";
import { coverage } from "@/lib/scheduling/rules";
import {
    createLeaveRecordAction,
    updateLeaveStatusAction,
    createOffDayAction,
    deleteOffDayAction,
    adjustLeaveBalanceAction,
} from "@/lib/actions/leave";

export interface AssistantMessage {
    role: "user" | "model";
    text: string;
}

export interface AssistantTurnResult {
    reply: string;
    actions: Array<{ tool: string; ok: boolean; summary: string }>;
}

const MODEL = "gemini-3.8-flash";
const MAX_TOOL_ITERATIONS = 8;

// ---------------------------------------------------------------------------
// Tool declarations            (JSON Schema via parameters)
// ---------------------------------------------------------------------------

const toolDeclarations = [
    {
        name: "get_department_context",
        description:
            "Read-only overview: employees (with IDs), shift types (with IDs), current roster, leave records, off days and department settings. Call this first whenever you need IDs or current state.",
        parameters: { type: "object", properties: {}, required: [] },
    },
    {
        name: "create_employee",
        description:
            "Register a new clinical employee (doctor, nurse, tech). employeeId like NUR-210 / DOC-115.",
        parameters: {
            type: "object",
            properties: {
                employeeId: { type: "string" },
                fullName: { type: "string" },
                designation: { type: "string" },
                unit: { type: "string" },
                phoneNumber: { type: "string" },
                email: { type: "string" },
                dateJoined: {
                    type: "string",
                    description: "YYYY-MM-DD",
                },
            },
            required: [
                "employeeId",
                "fullName",
                "designation",
                "phoneNumber",
                "email",
            ],
        },
    },
    {
        name: "update_employee",
        description: "Update fields of an existing employee record.",
        parameters: {
            type: "object",
            properties: {
                idOrEmployeeCode: {
                    type: "string",
                    description:
                        "Internal id (emp_...) or employee code like NUR-204",
                },
                fullName: { type: "string" },
                designation: { type: "string" },
                unit: { type: "string" },
                phoneNumber: { type: "string" },
                email: { type: "string" },
                employmentStatus: { type: "string" },
            },
            required: ["idOrEmployeeCode"],
        },
    },
    {
        name: "archive_employee",
        description:
            "Archive (soft-delete) an employee. Historical shifts/leave are preserved. This is the ONLY removal path available to you — permanent deletion is not supported through the assistant.",
        parameters: {
            type: "object",
            properties: { idOrEmployeeCode: { type: "string" } },
            required: ["idOrEmployeeCode"],
        },
    },
    {
        name: "restore_employee",
        description: "Restore a previously archived employee to active status.",
        parameters: {
            type: "object",
            properties: { idOrEmployeeCode: { type: "string" } },
            required: ["idOrEmployeeCode"],
        },
    },
    {
        name: "create_unit",
        description:
            "Create a new unit (ward/zone) in the department dictionary. Unit names must be unique.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                description: { type: "string" },
                color: {
                    type: "string",
                    description: "Optional hex colour tint, e.g. #00685f",
                },
                sortOrder: { type: "number" },
            },
            required: ["name"],
        },
    },
    {
        name: "update_unit",
        description:
            "Update a unit (by id or exact name). Renaming it automatically updates every employee reference.",
        parameters: {
            type: "object",
            properties: {
                idOrName: { type: "string" },
                name: {
                    type: "string",
                    description: "New name (renames, propagating to employees)",
                },
                description: { type: "string" },
                color: { type: "string" },
                sortOrder: { type: "number" },
                active: { type: "boolean" },
            },
            required: ["idOrName"],
        },
    },
    {
        name: "delete_unit",
        description:
            "Delete a unit from the dictionary. Only works when no employee is still assigned to that unit name.",
        parameters: {
            type: "object",
            properties: { idOrName: { type: "string" } },
            required: ["idOrName"],
        },
    },
    {
        name: "create_role",
        description:
            "Create a new clinical role/designation. staffClass is the staffing class: RN, MD or Tech.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                staffClass: {
                    type: "string",
                    enum: ["RN", "MD", "Tech"],
                },
                description: { type: "string" },
                sortOrder: { type: "number" },
            },
            required: ["name"],
        },
    },
    {
        name: "update_role",
        description:
            "Update a role (by id or exact name). Renaming it automatically updates every employee designation.",
        parameters: {
            type: "object",
            properties: {
                idOrName: { type: "string" },
                name: {
                    type: "string",
                    description:
                        "New name (renames, propagating to employee designations)",
                },
                staffClass: {
                    type: "string",
                    enum: ["RN", "MD", "Tech"],
                },
                description: { type: "string" },
                sortOrder: { type: "number" },
                active: { type: "boolean" },
            },
            required: ["idOrName"],
        },
    },
    {
        name: "delete_role",
        description:
            "Delete a role from the dictionary. Only works when no employee still holds it as their designation.",
        parameters: {
            type: "object",
            properties: { idOrName: { type: "string" } },
            required: ["idOrName"],
        },
    },
    {
        name: "create_shift_type",
        description:
            "Create a new shift type template (e.g. 'Swing Intake', code SW, 13:00-21:30).",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                shortCode: {
                    type: "string",
                    description: "1-3 letters, unique",
                },
                startTime: {
                    type: "string",
                    description: "HH:MM",
                },
                endTime: {
                    type: "string",
                    description: "HH:MM",
                },
                description: { type: "string" },
                crossesMidnight: { type: "boolean" },
                minimumStaffRn: { type: "number" },
                minimumStaffMd: { type: "number" },
                targetStaff: { type: "number" },
                category: { type: "string" },
            },
            required: ["name", "shortCode", "startTime", "endTime"],
        },
    },
    {
        name: "update_shift_type",
        description:
            "Update fields of a shift type template (by id or short code).",
        parameters: {
            type: "object",
            properties: {
                idOrCode: { type: "string" },
                name: { type: "string" },
                startTime: { type: "string" },
                endTime: { type: "string" },
                crossesMidnight: { type: "boolean" },
                minimumStaffRn: { type: "number" },
                minimumStaffMd: { type: "number" },
                active: { type: "boolean" },
            },
            required: ["idOrCode"],
        },
    },
    {
        name: "toggle_shift_type_active",
        description: "Activate or deactivate a shift type template.",
        parameters: {
            type: "object",
            properties: {
                idOrCode: { type: "string" },
                active: { type: "boolean" },
            },
            required: ["idOrCode", "active"],
        },
    },
    {
        name: "assign_shift",
        description:
            "Assign one employee to a shift type on a specific date. Validations (leave, rest, overlap) run automatically.",
        parameters: {
            type: "object",
            properties: {
                employeeIdOrCode: { type: "string" },
                shiftTypeShortCode: {
                    type: "string",
                    description: "e.g. D, E, N, C, TR",
                },
                date: { type: "string", description: "YYYY-MM-DD" },
                wardZone: { type: "string" },
                notes: { type: "string" },
                forceOverrideWarnings: {
                    type: "boolean",
                    description: "true to override rest-rule warnings",
                },
            },
            required: [
                "employeeIdOrCode",
                "shiftTypeShortCode",
                "date",
            ],
        },
    },
    {
        name: "bulk_assign_shifts",
        description:
            "Assign several employees to a shift type across a date range, optionally only on certain weekdays.",
        parameters: {
            type: "object",
            properties: {
                employeeIdsOrCodes: {
                    type: "array",
                    items: { type: "string" },
                },
                shiftTypeShortCode: { type: "string" },
                startDate: { type: "string" },
                endDate: { type: "string" },
                daysOfWeek: {
                    type: "array",
                    items: { type: "number" },
                    description: "0=Sun .. 6=Sat; omit for every day",
                },
                forceOverride: { type: "boolean" },
            },
            required: [
                "employeeIdsOrCodes",
                "shiftTypeShortCode",
                "startDate",
                "endDate",
            ],
        },
    },
    {
        name: "smart_fill_roster",
        description:
            "Run the Smart Fill engine for a date range: automatically assigns available, cleared staff to every shift missing minimum safe coverage, honoring leave, rest intervals, weekly caps and fatigue streaks. Never touches existing assignments — only fills genuine shortfalls. Show the user the proposal summary before or after applying.",
        parameters: {
            type: "object",
            properties: {
                startDate: {
                    type: "string",
                    description: "YYYY-MM-DD inclusive",
                },
                endDate: {
                    type: "string",
                    description: "YYYY-MM-DD inclusive",
                },
            },
            required: ["startDate", "endDate"],
        },
    },
    {
        name: "analyze_coverage",
        description:
            "Read-only coverage analysis for a date range: per date × shift × designation required vs assigned vs short, plus the engine's own conflict scan (rest, leave, streaks, weekly caps). Use it to answer 'where are the gaps', 'who is over hours', 'what breaks if we change a rule' style questions with real numbers before proposing bulk actions.",
        parameters: {
            type: "object",
            properties: {
                startDate: {
                    type: "string",
                    description: "YYYY-MM-DD inclusive",
                },
                endDate: {
                    type: "string",
                    description: "YYYY-MM-DD inclusive",
                },
            },
            required: ["startDate", "endDate"],
        },
    },
    {
        name: "bulk_archive_employees",
        description:
            "Archive several employees at once (soft-delete; history preserved). Max 20 per call. Resolve every name/code via get_department_context first.",
        parameters: {
            type: "object",
            properties: {
                employeeIdsOrCodes: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 20,
                },
            },
            required: ["employeeIdsOrCodes"],
        },
    },
    {
        name: "bulk_restore_employees",
        description:
            "Restore several previously archived employees at once. Max 20 per call.",
        parameters: {
            type: "object",
            properties: {
                employeeIdsOrCodes: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 20,
                },
            },
            required: ["employeeIdsOrCodes"],
        },
    },
    {
        name: "bulk_move_to_unit",
        description:
            "Move several employees into one unit (ward/zone) at once. Max 20 per call. Resolve the unit via get_department_context or an exact unit name.",
        parameters: {
            type: "object",
            properties: {
                employeeIdsOrCodes: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 20,
                },
                unitIdOrName: { type: "string" },
            },
            required: ["employeeIdsOrCodes", "unitIdOrName"],
        },
    },
    {
        name: "bulk_decide_leave",
        description:
            "Approve, reject or cancel several leave records by id at once. Max 20 per call. Requires leave-approval permission; assistants without it get an authorization error.",
        parameters: {
            type: "object",
            properties: {
                leaveRecordIds: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 20,
                },
                status: {
                    type: "string",
                    enum: ["approved", "rejected", "cancelled"],
                },
            },
            required: ["leaveRecordIds", "status"],
        },
    },
    {
        name: "bulk_schedule_off_days",
        description:
            "Schedule rotational off-days for several employees on one date (or across a short date range) at once. Max 20 employee×date pairs per call.",
        parameters: {
            type: "object",
            properties: {
                employeeIdsOrCodes: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 20,
                },
                dates: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 5,
                    description:
                        "YYYY-MM-DD list; multiple dates × employees are expanded but still capped at 20 writes",
                },
                reason: { type: "string" },
                notes: { type: "string" },
            },
            required: ["employeeIdsOrCodes", "dates"],
        },
    },
    {
        name: "bulk_remove_assignments",
        description:
            "Remove several shift assignments by id at once (use assignment ids from currentWeekRoster in the context or a previous get). Max 20 per call.",
        parameters: {
            type: "object",
            properties: {
                assignmentIds: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 20,
                },
            },
            required: ["assignmentIds"],
        },
    },
    {
        name: "delete_shift_assignment",
        description:
            "Remove a shift assignment by its id (see get_department_context for ids).",
        parameters: {
            type: "object",
            properties: { assignmentId: { type: "string" } },
            required: ["assignmentId"],
        },
    },
    {
        name: "record_leave",
        description:
            "Record a leave request for an employee (Doctors+admins auto-approve; assistants submit pending).",
        parameters: {
            type: "object",
            properties: {
                employeeIdOrCode: { type: "string" },
                leaveTypeIdOrCode: {
                    type: "string",
                    description: "e.g. SICK, ANNUAL, CME, CASUAL, UNPAID",
                },
                startDate: { type: "string" },
                endDate: { type: "string" },
                reason: { type: "string" },
                notes: { type: "string" },
            },
            required: [
                "employeeIdOrCode",
                "leaveTypeIdOrCode",
                "startDate",
                "endDate",
                "reason",
            ],
        },
    },
    {
        name: "decide_leave",
        description: "Approve, reject or cancel a leave record by its id.",
        parameters: {
            type: "object",
            properties: {
                leaveRecordId: { type: "string" },
                status: {
                    type: "string",
                    enum: ["approved", "rejected", "cancelled"],
                },
            },
            required: ["leaveRecordId", "status"],
        },
    },
    {
        name: "schedule_off_day",
        description:
            "Schedule a rotational off-day for an employee on a date (separate from leave).",
        parameters: {
            type: "object",
            properties: {
                employeeIdOrCode: { type: "string" },
                date: { type: "string" },
                reason: { type: "string" },
                notes: { type: "string" },
            },
            required: ["employeeIdOrCode", "date"],
        },
    },
    {
        name: "delete_off_day",
        description: "Remove a scheduled off-day by id.",
        parameters: {
            type: "object",
            properties: { offDayId: { type: "string" } },
            required: ["offDayId"],
        },
    },
    {
        name: "adjust_leave_balance",
        description:
            "Manually adjust an employee's leave balance by +/- days (superuser only), with an auditable reason.",
        parameters: {
            type: "object",
            properties: {
                employeeIdOrCode: { type: "string" },
                leaveTypeIdOrCode: { type: "string" },
                amount: { type: "number" },
                reason: { type: "string" },
            },
            required: [
                "employeeIdOrCode",
                "leaveTypeIdOrCode",
                "amount",
                "reason",
            ],
        },
    },
    {
        name: "update_department_settings",
        description:
            "Update department fatigue guardrails: weekly hours cap, minimum rest hours, consecutive shift cap, roster lock, etc.",
        parameters: {
            type: "object",
            properties: {
                weeklyHoursCap: { type: "number" },
                warningHoursCap: { type: "number" },
                consecutiveShiftsCap: { type: "number" },
                minRestHoursBetweenShifts: { type: "number" },
                rosterLockHoursAhead: { type: "number" },
            },
            required: [],
        },
    },
];

// ---------------------------------------------------------------------------
// Context builder + resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve a shift type from its internal id OR short code ("D", "E", "N"…).
 * The roster is driven by short codes in conversation, but every server action
 * expects the internal id — mapping here is what makes AI assignments work.
 */
async function resolveShiftType(query: string) {
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

async function buildDepartmentContext() {
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

async function resolveUnit(query: string) {
    const all = await db.getUnits();
    const q = String(query).trim().toLowerCase();
    return (
        all.find((u: any) => u.id.toLowerCase() === q) ||
        all.find((u: any) => (u.name || "").toLowerCase() === q) ||
        null
    );
}

async function resolveRole(query: string) {
    const all = await db.getRoles();
    const q = String(query).trim().toLowerCase();
    return (
        all.find((r: any) => r.id.toLowerCase() === q) ||
        all.find((r: any) => (r.name || "").toLowerCase() === q) ||
        null
    );
}

async function resolveEmployee(query: string) {
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
        ) || null
    );
}

/**
 * Cap a model-supplied list argument. A single assistant action may touch at
 * most 20 records — anything larger is refused with the count, so the model
 * can split the request, and the PENDING list is never silently truncated.
 */
const BULK_LIMIT = 20;
function capBulkArgs(list: unknown, what: string, limit = BULK_LIMIT): string[] {
    if (Array.isArray(list) && list.length > limit) {
        throw new Error(
            `Too many ${what} in one action (limit ${limit}; got ${list.length}). Split it into several calls of ≤ ${limit}.`,
        );
    }
    return Array.isArray(list) ? list.map(String) : [];
}

/** Bulk pre-resolve: every id/code must match a real employee — none may fail. */
async function resolveEmployeesOrThrow(codes: string[]) {
    const resolved: Array<{ id: string; fullName?: string; employeeId?: string }> = [];
    const missing: string[] = [];
    for (const code of codes) {
        const emp = await resolveEmployee(code);
        if (emp)
            resolved.push({ id: emp.id, fullName: (emp as any).fullName, employeeId: (emp as any).employeeId });
        else missing.push(String(code));
    }
    if (missing.length > 0) {
        throw new Error(
            `No employee match${missing.length === 1 ? "es" : ""} for: ${missing.join(", ")}. Resolve names/codes with get_department_context first.`,
        );
    }
    return resolved;
}

// ---------------------------------------------------------------------------
// Tool execution (delegates to the same server actions the UI uses, so
// permission checks, audits and validation all apply)
// ---------------------------------------------------------------------------

type ToolHandler = (args: any, user: AuthenticatedUser) => Promise<any>;

const toolHandlers: Record<string, ToolHandler> = {
    async get_department_context() {
        return buildDepartmentContext();
    },

    async create_employee(args) {
        const res = await createEmployeeAction(args);
        return { created: res.employee };
    },

    async update_employee(args) {
        const emp = await resolveEmployee(args.idOrEmployeeCode);
        if (!emp)
            throw new Error(`No employee matches "${args.idOrEmployeeCode}".`);
        const updates: Record<string, string> = {};
        for (const key of [
            "fullName",
            "designation",
            "unit",
            "phoneNumber",
            "email",
            "employmentStatus",
        ] as const) {
            if (args[key] !== undefined) updates[key] = args[key];
        }
        const res = await updateEmployeeAction(emp.id, updates);
        return { updated: res.employee };
    },

    async archive_employee(args) {
        const emp = await resolveEmployee(args.idOrEmployeeCode);
        if (!emp)
            throw new Error(`No employee matches "${args.idOrEmployeeCode}".`);
        const res = await archiveEmployeeAction(emp.id);
        return { archived: res.employee };
    },

    async restore_employee(args) {
        const emp = await resolveEmployee(args.idOrEmployeeCode);
        if (!emp)
            throw new Error(`No employee matches "${args.idOrEmployeeCode}".`);
        const res = await restoreEmployeeAction(emp.id);
        return { restored: res.employee };
    },

    // Permanent deletion is intentionally NOT available through the assistant:
    // it stays a UI-only action behind a typed confirmation. The assistant can
    // only archive (soft-delete), which preserves all history.

    async create_unit(args) {
        const res = await createUnitAction({
            name: args.name,
            description: args.description ?? undefined,
            color: args.color ?? undefined,
            sortOrder: args.sortOrder ?? undefined,
        });
        return { created: res.unit };
    },

    async update_unit(args) {
        const target = await resolveUnit(args.idOrName);
        if (!target) throw new Error(`No unit matches "${args.idOrName}".`);
        const updates: Record<string, any> = {};
        for (const key of [
            "name",
            "description",
            "color",
            "sortOrder",
            "active",
        ] as const) {
            if (args[key] !== undefined) updates[key] = args[key];
        }
        const res = await updateUnitAction(target.id, updates);
        return { updated: res.unit };
    },

    async delete_unit(args) {
        const target = await resolveUnit(args.idOrName);
        if (!target) throw new Error(`No unit matches "${args.idOrName}".`);
        const res = await deleteUnitAction(target.id);
        return { deleted: res.success };
    },

    async create_role(args) {
        const res = await createRoleAction({
            name: args.name,
            staffClass: args.staffClass ?? "RN",
            description: args.description ?? undefined,
            sortOrder: args.sortOrder ?? undefined,
        });
        return { created: res.role };
    },

    async update_role(args) {
        const target = await resolveRole(args.idOrName);
        if (!target) throw new Error(`No role matches "${args.idOrName}".`);
        const updates: Record<string, any> = {};
        for (const key of [
            "name",
            "staffClass",
            "description",
            "sortOrder",
            "active",
        ] as const) {
            if (args[key] !== undefined) updates[key] = args[key];
        }
        const res = await updateRoleAction(target.id, updates);
        return { updated: res.role };
    },

    async delete_role(args) {
        const target = await resolveRole(args.idOrName);
        if (!target) throw new Error(`No role matches "${args.idOrName}".`);
        const res = await deleteRoleAction(target.id);
        return { deleted: res.success };
    },

    async create_shift_type(args) {
        // Apply sensible clinical defaults when the model omits staffing numbers
        const res = await createShiftTypeAction({
            name: args.name,
            shortCode: args.shortCode,
            startTime: args.startTime,
            endTime: args.endTime,
            description: args.description,
            crossesMidnight: Boolean(args.crossesMidnight),
            breakDurationMinutes: 30,
            minimumStaffRn: args.minimumStaffRn ?? 4,
            minimumStaffMd: args.minimumStaffMd ?? 1,
            targetStaff: args.targetStaff ?? 6,
            category: args.category ?? "REGULAR",
            color: "#00685f",
        });
        return { created: res.shiftType };
    },

    async update_shift_type(args) {
        const { all } = { all: await db.getShiftTypes() };
        const target =
            all.find((s) => s.id === args.idOrCode) ||
            all.find(
                (s) =>
                    s.shortCode.toLowerCase() ===
                    String(args.idOrCode).toLowerCase(),
            );
        if (!target)
            throw new Error(`No shift type matches "${args.idOrCode}".`);
        const updates: Record<string, any> = {};
        for (const key of [
            "name",
            "startTime",
            "endTime",
            "crossesMidnight",
            "minimumStaffRn",
            "minimumStaffMd",
            "active",
        ] as const) {
            if (args[key] !== undefined) updates[key] = args[key];
        }
        const res = await updateShiftTypeAction(target.id, updates);
        return { updated: res.shiftType };
    },

    async toggle_shift_type_active(args) {
        const all = await db.getShiftTypes();
        const target =
            all.find((s) => s.id === args.idOrCode) ||
            all.find(
                (s) =>
                    s.shortCode.toLowerCase() ===
                    String(args.idOrCode).toLowerCase(),
            );
        if (!target)
            throw new Error(`No shift type matches "${args.idOrCode}".`);
        const res = await toggleShiftTypeActiveAction(
            target.id,
            Boolean(args.active),
        );
        return { shiftType: res.shiftType };
    },

    async assign_shift(args) {
        const emp = await resolveEmployee(args.employeeIdOrCode);
        if (!emp)
            throw new Error(`No employee matches "${args.employeeIdOrCode}".`);
        const shiftType = await resolveShiftType(args.shiftTypeShortCode);
        if (!shiftType)
            throw new Error(
                `No shift type matches "${args.shiftTypeShortCode}". Valid codes: ${(await db.getShiftTypes()).map((s) => s.shortCode).join(", ")}.`,
            );
        const res = await createShiftAssignmentAction({
            employeeId: emp.id,
            shiftTypeId: shiftType.id,
            date: args.date,
            wardZone: args.wardZone,
            notes: args.notes,
            forceOverrideWarnings: Boolean(args.forceOverrideWarnings),
        } as any);
        return {
            assigned: res.assignment,
            warnings: res.warnings?.map((w: any) => w.message) || [],
        };
    },

    async bulk_assign_shifts(args) {
        args.employeeIdsOrCodes = capBulkArgs(args.employeeIdsOrCodes, "employees");
        const empIds: Array<string> = [];
        for (const q of args.employeeIdsOrCodes) {
            const emp = await resolveEmployee(q);
            if (emp) empIds.push(emp.id);
        }
        if (empIds.length === 0)
            throw new Error("No matching employees for bulk assignment.");
        const bulkShiftType = await resolveShiftType(args.shiftTypeShortCode);
        if (!bulkShiftType)
            throw new Error(
                `No shift type matches "${args.shiftTypeShortCode}".`,
            );
        const res = await bulkAssignShiftsAction({
            employeeIds: empIds,
            shiftTypeId: bulkShiftType.id,
            startDate: args.startDate,
            endDate: args.endDate,
            daysOfWeek: args.daysOfWeek,
            forceOverride: args.forceOverride,
        });
        return res;
    },

    async smart_fill_roster(args) {
        const res = await smartFillRosterAction({
            startDate: args.startDate,
            endDate: args.endDate,
        });
        return res;
    },

    async analyze_coverage(args) {
        const ctx = await loadSchedulingContext({ from: args.startDate, to: args.endDate });
        const cells = coverage(ctx as never, { from: args.startDate, to: args.endDate });
        // Compress: one row per shift×date with the worst designation shortfall.
        const byShiftDate = new Map<string, { date: string; shift: string; required: number; assigned: number; short: number }>();
        for (const c of cells) {
            const st = ctx.shiftTypes.find((s) => s.id === c.shiftTypeId);
            const key = `${c.date}|${st?.shortCode ?? c.shiftTypeId}`;
            const prev = byShiftDate.get(key);
            if (!prev || c.short > prev.short || (c.short === prev.short && c.required > prev.required)) {
                byShiftDate.set(key, {
                    date: c.date,
                    shift: st ? `${st.shortCode} ${st.name}` : c.shiftTypeId,
                    required: Math.max(prev?.required ?? c.required, c.required),
                    assigned: c.assigned,
                    short: Math.max(0, Math.max(prev?.short ?? 0, c.short)),
                });
            }
        }
        return {
            range: { from: args.startDate, to: args.endDate },
            gapDays: Array.from(byShiftDate.values()).filter((r) => r.short > 0).slice(0, 40),
            totalShortSlots: cells.reduce((n, c) => n + c.short, 0),
        };
    },

    async bulk_archive_employees(args) {
        const ids = capBulkArgs(args.employeeIdsOrCodes, "employees");
        const resolved = await resolveEmployeesOrThrow(ids);
        const archived: string[] = [];
        const failed: Array<{ code: string; error: string }> = [];
        for (const emp of resolved) {
            try {
                await archiveEmployeeAction(emp.id);
                archived.push(emp.fullName || emp.id);
            } catch (err: any) {
                failed.push({ code: emp.employeeId || emp.id, error: err?.message || " failed" });
            }
        }
        return { archived, failed, skipped: ids.length - resolved.length };
    },

    async bulk_restore_employees(args) {
        const ids = capBulkArgs(args.employeeIdsOrCodes, "employees");
        const resolved = await resolveEmployeesOrThrow(ids);
        const restored: string[] = [];
        const failed: Array<{ code: string; error: string }> = [];
        for (const emp of resolved) {
            try {
                await restoreEmployeeAction(emp.id);
                restored.push(emp.fullName || emp.id);
            } catch (err: any) {
                failed.push({ code: emp.employeeId || emp.id, error: err?.message || " failed" });
            }
        }
        return { restored, failed, skipped: ids.length - resolved.length };
    },

    async bulk_move_to_unit(args) {
        const ids = capBulkArgs(args.employeeIdsOrCodes, "employees");
        const resolved = await resolveEmployeesOrThrow(ids);
        const target = await resolveUnit(args.unitIdOrName);
        if (!target)
            throw new Error(
                `No unit matches "${args.unitIdOrName}". Valid units: ${(await db.getUnits()).map((u: any) => u.name).join(", ")}.`,
            );
        const moved: string[] = [];
        const failed: Array<{ code: string; error: string }> = [];
        for (const emp of resolved) {
            try {
                await updateEmployeeAction(emp.id, { unit: target.name } as never);
                moved.push(emp.fullName || emp.id);
            } catch (err: any) {
                failed.push({ code: emp.employeeId || emp.id, error: err?.message || " failed" });
            }
        }
        return { moved, unit: target.name, failed, skipped: ids.length - resolved.length };
    },

    async bulk_decide_leave(args) {
        const ids = capBulkArgs(args.leaveRecordIds, "leave records", 20);
        const decided: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        for (const id of ids) {
            try {
                const res = await updateLeaveStatusAction(id, args.status);
                decided.push(res.leaveRecord?.id || id);
            } catch (err: any) {
                failed.push({ id, error: err?.message || " failed" });
            }
        }
        return { status: args.status, decided, failed };
    },

    async bulk_schedule_off_days(args) {
        const ids = capBulkArgs(args.employeeIdsOrCodes, "employees");
        const resolved = await resolveEmployeesOrThrow(ids);
        const dates = capBulkArgs(args.dates, "dates", 5);
        const scheduled: string[] = [];
        const failed: Array<{ code: string; error: string }> = [];
        let writes = 0;
        for (const emp of resolved) {
            for (const date of dates) {
                if (writes >= 20) break; // hard cap: 20 written pairs per assistant action
                writes++;
                try {
                    const res = await createOffDayAction({
                        employeeId: emp.id,
                        date,
                        reason: args.reason,
                        notes: args.notes,
                    });
                    scheduled.push(`${emp.fullName || emp.id} · ${res.offDay?.date || date}`);
                    writes++;
                } catch (err: any) {
                    failed.push({ code: `${emp.employeeId || emp.id} on ${date}`, error: err?.message || " failed" });
                    writes++;
                }
            }
        }
        return { scheduled, failed };
    },

    async bulk_remove_assignments(args) {
        const ids = capBulkArgs(args.assignmentIds, "assignments");
        const removed: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        for (const id of ids) {
            try {
                await deleteShiftAssignmentAction(id);
                removed.push(id);
            } catch (err: any) {
                failed.push({ id, error: err?.message || " failed" });
            }
        }
        return { removed, failed };
    },

    async delete_shift_assignment(args) {
        const res = await deleteShiftAssignmentAction(args.assignmentId);
        return { deleted: res.success };
    },

    async record_leave(args) {
        const emp = await resolveEmployee(args.employeeIdOrCode);
        if (!emp)
            throw new Error(`No employee matches "${args.employeeIdOrCode}".`);
        const leaveTypes = await db.getLeaveTypes();
        const lt =
            leaveTypes.find(
                (t) => t.id === args.leaveTypeIdOrCode || t.code.toLowerCase() === String(args.leaveTypeIdOrCode).toLowerCase(),
            ) || leaveTypes.find((t) => t.name.toLowerCase().includes(String(args.leaveTypeIdOrCode).toLowerCase()));
        if (!lt)
            throw new Error(
                `No leave type matches "${args.leaveTypeIdOrCode}".`,
            );
        const res = await createLeaveRecordAction({
            employeeId: emp.id,
            leaveTypeId: lt.id,
            startDate: args.startDate,
            endDate: args.endDate,
            reason: args.reason,
            notes: args.notes,
        });
        return { leaveRecord: res.leaveRecord };
    },

    async decide_leave(args) {
        const res = await updateLeaveStatusAction(args.leaveRecordId, args.status);
        return { leaveRecord: res.leaveRecord };
    },

    async schedule_off_day(args) {
        const emp = await resolveEmployee(args.employeeIdOrCode);
        if (!emp)
            throw new Error(`No employee matches "${args.employeeIdOrCode}".`);
        const res = await createOffDayAction({
            employeeId: emp.id,
            date: args.date,
            reason: args.reason,
            notes: args.notes,
        });
        return { offDay: res.offDay };
    },

    async delete_off_day(args) {
        const res = await deleteOffDayAction(args.offDayId);
        return { deleted: res.success };
    },

    async adjust_leave_balance(args) {
        const emp = await resolveEmployee(args.employeeIdOrCode);
        if (!emp)
            throw new Error(`No employee matches "${args.employeeIdOrCode}".`);
        const leaveTypes = await db.getLeaveTypes();
        const lt =
            leaveTypes.find(
                (t) => t.id === args.leaveTypeIdOrCode || t.code.toLowerCase() === String(args.leaveTypeIdOrCode).toLowerCase(),
            ) || leaveTypes[0];
        const res = await adjustLeaveBalanceAction({
            employeeId: emp.id,
            leaveTypeId: lt.id,
            amount: args.amount,
            reason: args.reason,
        });
        return { adjustment: res.adjustment };
    },

    async update_department_settings(args) {
        const res = await updateDepartmentSettingsAction(args);
        return { settings: res.settings };
    },
};

// ---------------------------------------------------------------------------
// Conversation loop
// ---------------------------------------------------------------------------

function extractText(response: any): string {
    try {
        return response.text || "";
    } catch {
        const parts = response?.candidates?.[0]?.content?.parts || [];
        return parts.map((p: any) => p.text || "").join("");
    }
}

export async function runAssistantTurn(params: {
    user: AuthenticatedUser;
    history: AssistantMessage[];
    message: string;
}): Promise<AssistantTurnResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    const user = params.user;
    const contextSummary = await buildDepartmentContext();
    const { weekLabel, startDate, endDate } = getRosterWeek(0);

    // Fallback if no GEMINI_API_KEY is configured in the environment
    if (!apiKey) {
        const queryLower = params.message.toLowerCase();
        let fallbackReply = "";

        if (queryLower.includes("night") || queryLower.includes("tonight") || queryLower.includes("who is working")) {
            const today = cycleToday();
            const todayShifts = contextSummary.currentWeekRoster.filter((r) => r.date === today);
            const nightShiftType = contextSummary.shiftTypes.find((s) => s.code === "N" || s.name.toLowerCase().includes("night"));
            const nightStaffIds = todayShifts.filter((s) => s.shiftTypeId === nightShiftType?.id).map((s) => s.employeeId);
            const nightStaff = contextSummary.employees.filter((e) => nightStaffIds.includes(e.id));

            fallbackReply = `### Night Shift Coverage for Today (${today})\n\n` +
                (nightStaff.length > 0
                    ? `Currently **${nightStaff.length} staff member(s)** assigned to Night Shift (${nightShiftType?.time || "23:00 - 07:30"}):\n\n` +
                      nightStaff.map((s) => `- **${s.name}** (${s.code}) — *${s.designation}* [${s.unit}]`).join("\n")
                    : `No staff currently assigned to the Night shift for today (${today}). Minimum required RNs: ${nightShiftType?.minRN ?? 4}, MDs: ${nightShiftType?.minMD ?? 2}.`);
        } else if (queryLower.includes("gap") || queryLower.includes("shortage") || queryLower.includes("coverage")) {
            fallbackReply = `### Clinical Roster Coverage Summary (${weekLabel})\n\n` +
                `- **Total Active Employees:** ${contextSummary.employees.length} clinicians\n` +
                `- **Active Shift Types:** ${contextSummary.shiftTypes.length} operational shifts (Day, Evening, Night, Trauma)\n` +
                `- **Weekly Hours Guardrail:** Max ${contextSummary.guardrails.weeklyHoursCap} hours/week\n` +
                `- **Fatigue Rest Interval:** Minimum ${contextSummary.guardrails.minRestHoursBetweenShifts}h rest required between shifts\n` +
                `- **Consecutive Shifts Cap:** Max ${contextSummary.guardrails.consecutiveShiftsCap} consecutive shifts\n\n` +
                `*Tip: Use the 'Smart Fill' engine or ask Gemini to automatically resolve uncovered slots.*`;
        } else if (queryLower.includes("leave") || queryLower.includes("off")) {
            const leaves = contextSummary.leaves || [];
            fallbackReply = `### Department Leave & Off-Duty Status\n\n` +
                (leaves.length > 0
                    ? `There are **${leaves.length} leave record(s)** logged for this period:\n\n` +
                      leaves.slice(0, 5).map((l) => {
                          const emp = contextSummary.employees.find((e) => e.id === l.employeeId);
                          return `- **${emp?.name || l.employeeId}** (${emp?.code || ""}): ${l.from} → ${l.to} [Status: **${l.status.toUpperCase()}**]`;
                      }).join("\n")
                    : `No active leave records registered for the current roster week.`);
        } else {
            fallbackReply = `### Patan Academy Clinical Assistant (DEPT-402)\n\n` +
                `Hello **${user.name}** (${user.title}). I am your context-aware hospital management assistant.\n\n` +
                `- **Roster Cycle:** ${weekLabel} (${startDate} to ${endDate})\n` +
                `- **Department Staff:** ${contextSummary.employees.length} active clinical personnel\n` +
                `- **Shifts Registered:** ${contextSummary.shiftTypes.map((s) => s.code).join(", ")}\n` +
                `- **Fatigue Rules:** 11h minimum rest, ${contextSummary.guardrails.weeklyHoursCap}h weekly cap\n\n` +
                `You can ask me about shift coverage, staff availability, fatigue warnings, and leave approvals.`;
        }

        return {
            reply: fallbackReply,
            actions: [],
        };
    }

    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
            headers: {
                "User-Agent": "aistudio-build",
            },
        },
    });

    const adminPasswordNote = "";

    const systemInstruction = [
        `You are the on-call AI management assistant for the Patan Academy Emergency & Critical Care HRMS (DEPT-402).`,
        `Signed-in user: ${user.name} — role "${user.role}" (${user.title}). Their permissions: ${JSON.stringify(user.permissions)}.`,
        `Current roster cycle: ${weekLabel} (Mon ${startDate} → Sun ${endDate}; today is ${cycleToday()}). Use ISO dates YYYY-MM-DD. When the user says "today", "this week", "tomorrow" or similar, resolve it against these dates — never guess calendar dates from memory.`,
        `You can BOTH answer questions and actually operate the system using the tools: create/update/archive employees (and do it in BULK up to 20 per call), move staff between units in bulk, manage shift types, assign and remove shifts singly and in bulk, run the Smart Fill engine over a date range, record and decide leave singly and in bulk, schedule off-days in bulk for multiple staff/dates, adjust balances and update fatigue guardrails. You also have analyze_coverage for real per-day coverage and conflict numbers before you propose anything.`,
        `Every mutation runs through the app's enforced permission system — if a call fails with an authorization error, tell the user their account lacks that permission instead of retrying.`,
        `Rules of conduct:`,
        `- Prefer get_department_context first to resolve real IDs; never invent IDs.`,
        `- BULK work: for anything touching many records (archive several leavers, move a whole team to a new unit, approve this week's pending leave, clear conflicts on a date) use the matching bulk_ tool instead of repeating single calls. Hard cap: 20 records per action — if the user asks for more, say the cap and split it, and tell them how many are left.`,
        `- Before proposing bulk changes, run analyze_coverage on the affected dates and report WHICH days/shifts are short and who the candidates are; state what you are about to change and how many records, then do it. Summarize per-item failures honestly (name + reason) — never gloss over partial failures.`,
        `- assign_shift takes a shiftTypeShortCode like D/E/N/TR/PED — the server maps codes to real IDs for you. If the code is invalid the error lists all valid codes.`,
        `- If a shift assignment fails validation (rest interval, approved leave, overlapping shift, inactive staff), do NOT blindly retry with forceOverrideWarnings. Read the error, pick a better option (another date, another employee, or removing the conflicting assignment first) and explain your choice. Only force-override rest warnings when the user explicitly asks.`,
        `- Before assigning, sanity-check the target: not on approved leave that date, no existing assignment that date, weekly hours stay under the guardrails in LIVE DEPARTMENT CONTEXT.`,
        `- Employee fields: employeeId (code like NUR-204), fullName, designation (e.g. "Staff Critical Care RN"), unit, phone, email, dateJoined.`,
        `- For leave/date ranges include the reason. For destructive actions (archive) confirm the exact target list was resolved by code or name before executing — list the names you are about to archive in bulk.`,
        `- After performing actions, summarize briefly what you changed and flag any validation warnings.`,
        `- If the user asks something you can answer from the context, answer directly with real numbers.`,
        `LIVE DEPARTMENT CONTEXT (as of now):\n${JSON.stringify(contextSummary).slice(0, 12000)}`,
        adminPasswordNote,
    ]
        .filter(Boolean)
        .join("\n\n");

    const contents: Array<any> = [];
    for (const msg of params.history.slice(-12)) {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
    contents.push({ role: "user", parts: [{ text: params.message }] });

    const actions: AssistantTurnResult["actions"] = [];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations: toolDeclarations as any }],
                temperature: 0.3,
            },
        });

        const candidate = response?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const functionCalls = parts
            .filter((p: any) => p.functionCall)
            .map((p: any) => p.functionCall);

        // If no tool calls, this is the final natural language answer
        if (functionCalls.length === 0) {
            return { reply: extractText(response) || "I've reviewed your request against the department records.", actions };
        }

        // Push the model's function-calling turn to history
        if (candidate?.content) {
            contents.push(candidate.content);
        }

        // Execute every requested tool call
        const toolResponseParts: Array<any> = [];
        for (const call of functionCalls) {
            const handler = toolHandlers[call.name];
            let result: any;
            if (!handler) {
                result = { ok: false, error: `Unknown tool "${call.name}".` };
            } else {
                try {
                    result = await handler(call.args, user);
                } catch (err: any) {
                    result = { ok: false, error: err?.message || `Tool "${call.name}" failed.` };
                }
            }
            actions.push({ tool: call.name, ok: result.ok !== false, summary: result.summary || JSON.stringify(result) });
            toolResponseParts.push({
                functionResponse: {
                    name: call.name,
                    response: { result },
                },
            });
        }

        // Add the tool execution results back to the conversation as user functionResponse parts
        contents.push({
            role: "user",
            parts: toolResponseParts,
        });

        // The loop continues so Gemini can see the tool results and generate the conversational reply
    }

    return {
        reply: "I completed the requested system operations. Please review the live roster and department status.",
        actions,
    };
}
