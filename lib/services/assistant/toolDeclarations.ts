/* JSON-schema tool declarations for the Gemini function-calling API. */

export const toolDeclarations = [
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
            required: ["employeeIdOrCode", "shiftTypeShortCode", "date"],
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
