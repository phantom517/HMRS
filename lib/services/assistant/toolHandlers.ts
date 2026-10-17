import { db } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth/session";
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
import {
    resolveShiftType,
    resolveUnit,
    resolveRole,
    resolveEmployee,
    capBulkArgs,
    resolveEmployeesOrThrow,
    buildDepartmentContext,
} from "@/lib/services/assistant/deptContext";

// Tool execution (delegates to the same server actions the UI uses, so
// permission checks, audits and validation all apply)
// ---------------------------------------------------------------------------

type ToolHandler = (args: any, user: AuthenticatedUser) => Promise<any>;

export const toolHandlers: Record<string, ToolHandler> = {
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
        args.employeeIdsOrCodes = capBulkArgs(
            args.employeeIdsOrCodes,
            "employees",
        );
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
        const ctx = await loadSchedulingContext({
            from: args.startDate,
            to: args.endDate,
        });
        const cells = coverage(ctx as never, {
            from: args.startDate,
            to: args.endDate,
        });
        // Compress: one row per shift×date with the worst designation shortfall.
        const byShiftDate = new Map<
            string,
            {
                date: string;
                shift: string;
                required: number;
                assigned: number;
                short: number;
            }
        >();
        for (const c of cells) {
            const st = ctx.shiftTypes.find((s) => s.id === c.shiftTypeId);
            const key = `${c.date}|${st?.shortCode ?? c.shiftTypeId}`;
            const prev = byShiftDate.get(key);
            if (
                !prev ||
                c.short > prev.short ||
                (c.short === prev.short && c.required > prev.required)
            ) {
                byShiftDate.set(key, {
                    date: c.date,
                    shift: st ? `${st.shortCode} ${st.name}` : c.shiftTypeId,
                    required: Math.max(
                        prev?.required ?? c.required,
                        c.required,
                    ),
                    assigned: c.assigned,
                    short: Math.max(0, Math.max(prev?.short ?? 0, c.short)),
                });
            }
        }
        return {
            range: { from: args.startDate, to: args.endDate },
            gapDays: Array.from(byShiftDate.values())
                .filter((r) => r.short > 0)
                .slice(0, 40),
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
                failed.push({
                    code: emp.employeeId || emp.id,
                    error: err?.message || " failed",
                });
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
                failed.push({
                    code: emp.employeeId || emp.id,
                    error: err?.message || " failed",
                });
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
                await updateEmployeeAction(emp.id, {
                    unit: target.name,
                } as never);
                moved.push(emp.fullName || emp.id);
            } catch (err: any) {
                failed.push({
                    code: emp.employeeId || emp.id,
                    error: err?.message || " failed",
                });
            }
        }
        return {
            moved,
            unit: target.name,
            failed,
            skipped: ids.length - resolved.length,
        };
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
                    scheduled.push(
                        `${emp.fullName || emp.id} · ${res.offDay?.date || date}`,
                    );
                    writes++;
                } catch (err: any) {
                    failed.push({
                        code: `${emp.employeeId || emp.id} on ${date}`,
                        error: err?.message || " failed",
                    });
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
                (t) =>
                    t.id === args.leaveTypeIdOrCode ||
                    t.code.toLowerCase() ===
                        String(args.leaveTypeIdOrCode).toLowerCase(),
            ) ||
            leaveTypes.find((t) =>
                t.name
                    .toLowerCase()
                    .includes(String(args.leaveTypeIdOrCode).toLowerCase()),
            );
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
        const res = await updateLeaveStatusAction(
            args.leaveRecordId,
            args.status,
        );
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
                (t) =>
                    t.id === args.leaveTypeIdOrCode ||
                    t.code.toLowerCase() ===
                        String(args.leaveTypeIdOrCode).toLowerCase(),
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
