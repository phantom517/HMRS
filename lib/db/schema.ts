import { pgTable, text, timestamp, boolean, integer, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// Users (Superuser and Assistant Managers only)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("assistant"), // "superuser" | "assistant"
  title: text("title").notNull().default("Assistant Manager"),
  active: boolean("active").notNull().default(true),
  avatarUrl: text("avatar_url"),
  // Display-only calendar preferences (nullable = fall back to department default).
  // NEVER used for storage: dates remain Gregorian (AD) in every column.
  calendarSystem: text("calendar_system"), // null | "AD" | "BS"
  uiLocale: text("ui_locale"), // null | "en" | "ne"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

// Assistant Manager Permissions
export const assistantPermissions = pgTable("assistant_permissions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canEditEmployees: boolean("can_edit_employees").notNull().default(false),
  canManageShifts: boolean("can_manage_shifts").notNull().default(true),
  canAssignShifts: boolean("can_assign_shifts").notNull().default(true),
  canApproveLeave: boolean("can_approve_leave").notNull().default(false),
  canManagePolicies: boolean("can_manage_policies").notNull().default(false),
  canExportReports: boolean("can_export_reports").notNull().default(true),
  canViewAuditLogs: boolean("can_view_audit_logs").notNull().default(false),
  canDeleteEmployees: boolean("can_delete_employees").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("asst_perm_user_idx").on(table.userId),
]);

// Clinical Employees (Doctors, Nurses, Paramedics, Techs)
export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(), // e.g. "NUR-204", "DOC-101"
  fullName: text("full_name").notNull(),
  designation: text("designation").notNull(), // e.g. "Trauma Lead RN", "Attending Trauma MD"
  department: text("department").notNull().default("Emergency & Trauma"),
  unit: text("unit").notNull().default("Zone 1: Resuscitation"),
  // FK to the units dictionary (REMOVED text dependency once migration completes)
  unitId: text("unit_id").references(() => units.id, { onDelete: "restrict" }),
  roleId: text("role_id").references(() => roles.id, { onDelete: "restrict" }),
  phoneNumber: text("phone_number").notNull(),
  email: text("email").notNull(),
  hospitalExt: text("hospital_ext").default("x4402"),
  pagerNumber: text("pager_number").default("PGR-8891"),
  dateJoined: text("date_joined").notNull(), // YYYY-MM-DD
  employmentStatus: text("employment_status").notNull().default("active"), // "active", "on_leave", "off_duty", "archived"
  notes: text("notes"),
  avatarUrl: text("avatar_url"),
  credentials: jsonb("credentials").$type<Array<{ name: string; issuer: string; expires: string; status: string }>>().default([]),
  active: boolean("active").notNull().default(true),
  archivedAt: timestamp("archived_at"),
  // Per-employee rule EXCEPTIONS (nullable = inherit department default)
  maxHoursPerWeek: integer("max_hours_per_week"), // overrides departmentSettings.weeklyHoursCap
  canWorkNights: boolean("can_work_nights").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("employees_emp_id_idx").on(table.employeeId),
  index("employees_status_idx").on(table.employmentStatus),
  index("employees_designation_idx").on(table.designation),
]);

// Shift Types (Configurable Clinical Templates)
export const shiftTypes = pgTable("shift_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Day Shift", "Overnight ICU / Trauma"
  shortCode: text("short_code").notNull().unique(), // e.g. "D", "E", "N", "TR", "OC", "PED"
  description: text("description"),
  color: text("color").notNull().default("#00685f"), // hex or token
  category: text("category").notNull().default("REGULAR"), // "REGULAR", "PEAK SURGE", "+1 DAY", "DYNAMIC", "1.5x MULT", "SPECIALIZED"
  startTime: text("start_time").notNull(), // "HH:MM", e.g. "07:00"
  endTime: text("end_time").notNull(), // "HH:MM", e.g. "15:30"
  breakDurationMinutes: integer("break_duration_minutes").notNull().default(30),
  netDurationHours: numeric("net_duration_hours", { precision: 4, scale: 2 }).notNull().default("8.00"),
  minimumStaffRn: integer("minimum_staff_rn").notNull().default(6),
  minimumStaffMd: integer("minimum_staff_md").notNull().default(2),
  targetStaff: integer("target_staff").notNull().default(8),
  maximumStaff: integer("maximum_staff"),
  // True for shifts whose roster tint is "night" — NEVER inferred from the name.
  isNight: boolean("is_night").notNull().default(false),
  crossesMidnight: boolean("crosses_midnight").notNull().default(false),
  enforceRestRule: boolean("enforce_rest_rule").notNull().default(true),
  traumaPremium: boolean("trauma_premium").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("shift_types_code_idx").on(table.shortCode),
]);

// Shift Assignments (Roster cells)
export const shiftAssignments = pgTable("shift_assignments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  shiftTypeId: text("shift_type_id").notNull().references(() => shiftTypes.id, { onDelete: "restrict" }),
  date: text("date").notNull(), // "YYYY-MM-DD"
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  scheduledBreakMinutes: integer("scheduled_break_minutes").notNull().default(30),
  status: text("status").notNull().default("assigned"), // "assigned", "completed", "cancelled", "missed"
  actualStartAt: timestamp("actual_start_at"),
  actualEndAt: timestamp("actual_end_at"),
  wardZone: text("ward_zone").default("Red Zone (Trauma Resus 1-4)"),
  stationRole: text("station_role"), // e.g. "Lead Triage Resus", "Charge RN", "OR Support"
  notes: text("notes"),
  handoverNotes: text("handover_notes"),
  conflictFlag: boolean("conflict_flag").notNull().default(false),
  conflictReason: text("conflict_reason"),
  createdBy: text("created_by").notNull().default("System"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("shift_assign_emp_idx").on(table.employeeId),
  index("shift_assign_date_idx").on(table.date),
  index("shift_assign_type_idx").on(table.shiftTypeId),
  index("shift_assign_status_idx").on(table.status),
]);

// Leave Types (Sick, Annual, CME, Casual, Unpaid, etc.)
export const leaveTypes = pgTable("leave_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // "Sick / Medical Leave", "Annual Planned Vacation"
  code: text("code").notNull().unique(), // "SICK", "ANNUAL", "CME", "CASUAL", "UNPAID"
  description: text("description"),
  paid: boolean("paid").notNull().default(true),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  color: text("color").notNull().default("#00685f"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("leave_types_code_idx").on(table.code),
]);

// Leave Policies (Quota per designation/tier)
export const leavePolicies = pgTable("leave_policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  designation: text("designation").notNull(), // "All", "Physician", "Nurse", "Paramedic"
  leaveTypeId: text("leave_type_id").notNull().references(() => leaveTypes.id, { onDelete: "cascade" }),
  allowanceDays: numeric("allowance_days", { precision: 5, scale: 1 }).notNull().default("15.0"),
  policyPeriod: text("policy_period").notNull().default("calendar_year"), // "calendar_year", "cycle"
  carryForwardDays: numeric("carry_forward_days", { precision: 5, scale: 1 }).notNull().default("5.0"),
  effectiveFrom: text("effective_from").notNull(), // "YYYY-MM-DD"
  effectiveTo: text("effective_to"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Leave Records & Requests
export const leaveRecords = pgTable("leave_records", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  leaveTypeId: text("leave_type_id").notNull().references(() => leaveTypes.id, { onDelete: "restrict" }),
  startDate: text("start_date").notNull(), // "YYYY-MM-DD"
  endDate: text("end_date").notNull(), // "YYYY-MM-DD"
  durationDays: numeric("duration_days", { precision: 4, scale: 1 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected", "cancelled"
  replacementEmployeeId: text("replacement_employee_id").references(() => employees.id, { onDelete: "set null" }),
  replacementStatus: text("replacement_status").default("unassigned"), // "assigned", "unassigned", "optimal"
  recordedBy: text("recorded_by").notNull().default("Manager"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("leave_rec_emp_idx").on(table.employeeId),
  index("leave_rec_status_idx").on(table.status),
  index("leave_rec_dates_idx").on(table.startDate, table.endDate),
]);

// Leave Balance Adjustments (Audit trail for manual quota balance changes)
export const leaveBalanceAdjustments = pgTable("leave_balance_adjustments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  leaveTypeId: text("leave_type_id").notNull().references(() => leaveTypes.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 5, scale: 1 }).notNull(), // e.g. +2.0 or -1.5
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("leave_adj_emp_idx").on(table.employeeId),
]);

// Scheduled Rotational Off-Days (Separate from leave)
export const offDays = pgTable("off_days", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // "YYYY-MM-DD"
  reason: text("reason").notNull().default("Rotational Rest Roster"), // "Rotational Rest Roster", "Compensatory Rest", "Fatigue Directive"
  notes: text("notes"),
  recordedBy: text("recorded_by").notNull().default("System Roster Engine"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("off_days_emp_idx").on(table.employeeId),
  index("off_days_date_idx").on(table.date),
  uniqueIndex("off_days_emp_date_idx").on(table.employeeId, table.date),
]);

// Per shift type × designation staffing POLICY row.
// Designation "any" is the fallback when a shift type only has minimumStaffRn/Md.
export const shiftRequirements = pgTable("shift_requirements", {
  id: text("id").primaryKey(),
  shiftTypeId: text("shift_type_id").notNull().references(() => shiftTypes.id, { onDelete: "cascade" }),
  designation: text("designation").notNull().default("any"), // "any", "RN", "MD", "Tech", or a full designation
  minStaff: integer("min_staff").notNull().default(1),
  maxStaff: integer("max_staff"), // nullable = no per-shift cap
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("shift_requirements_type_desig_idx").on(table.shiftTypeId, table.designation),
]);

// Department Fatigue & Scheduling Guardrails Settings
// Every scheduling rule lives here — ONE stored value read by the scheduling
// engine, the roster, the dashboard, the conflict checker and auto-assign.
export const departmentSettings = pgTable("department_settings", {
  id: text("id").primaryKey(),
  departmentCode: text("department_code").notNull().default("DEPT-402"),
  departmentName: text("department_name").notNull().default("Emergency & Trauma Department"),
  weeklyHoursCap: integer("weekly_hours_cap").notNull().default(48),
  warningHoursCap: integer("warning_hours_cap").notNull().default(40),
  consecutiveShiftsCap: integer("consecutive_shifts_cap").notNull().default(5),
  minRestHoursBetweenShifts: integer("min_rest_hours_between_shifts").notNull().default(11),
  rosterLockHoursAhead: integer("roster_lock_hours_ahead").notNull().default(72),
  nurseToBedRatioTarget: text("nurse_to_bed_ratio_target").notNull().default("1:3.2"),
  // Customizable scheduling-engine knobs (all adjustable from the UI)
  timezone: text("timezone").notNull().default("America/Chicago"),
  weekStartDay: integer("week_start_day").notNull().default(1), // 0=Sun, 1=Mon
  maxNightsPerMonth: integer("max_nights_per_month").notNull().default(7),
  minimumStaffRn: integer("minimum_staff_rn").notNull().default(0), // legacy default; shiftRequirements wins
  maxWeeklyHoursSeverity: text("max_weekly_hours_severity").notNull().default("warn"), // "warn" | "block"
  maxNightsSeverity: text("max_nights_severity").notNull().default("warn"), // "warn" | "block"
  pendingLeaveAction: text("pending_leave_action").notNull().default("warn"), // "warn" | "ignore" | "block"
  enforceRestInterval: boolean("enforce_rest_interval").notNull().default(true),
  // Calendar display defaults (resolved per user; users may override)
  defaultCalendarSystem: text("default_calendar_system").notNull().default("AD"), // "AD" | "BS"
  defaultLocale: text("default_locale").notNull().default("en"), // "en" | "ne"
  // Basis for monthly count keys (e.g. max nights per month): Gregorian month
  // or Bikram Sambat month. The engine only sees an injected periodKey(iso).
  periodBasis: text("period_basis").notNull().default("AD_MONTH"), // "AD_MONTH" | "BS_MONTH"
  autoAssignEnabled: boolean("auto_assign_enabled").notNull().default(true),
  autoAssignTimeBudgetMs: integer("auto_assign_time_budget_ms").notNull().default(2000),
  updatedBy: text("updated_by").default("Dr. Sarah Jenkins"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Public Holidays — stored as Gregorian 'YYYY-MM-DD' dates ONLY (never BS), with an
// optional Nepali name. NOT complete or authoritative: must be reviewed against the
// official Nepal government calendar each year before masks/scheduling rely on it.
export const holidays = pgTable("holidays", {
  id: text("id").primaryKey(),
  date: text("date").notNull(), // "YYYY-MM-DD" Gregorian
  name: text("name").notNull(),
  nameNp: text("name_np"), // Nepali script name for BS-locale display
  category: text("category").notNull().default("public"), // "public" | "department"
  observed: boolean("observed").notNull().default(true),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("holidays_date_idx").on(table.date),
]);

// Units (wards/zones of the department) and Roles (designations) — admin-managed
// dictionaries. Employees reference them BY NAME in their `unit` / `designation`
// columns; renaming is allowed but keeps existing employee references in sync,
// and deleting is blocked while any employee still uses the name.
export const units = pgTable("units", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"), // optional hex tint for roster/calendar headers
  sortOrder: integer("sort_order").notNull().default(100),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("units_name_idx").on(table.name),
]);

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  // Staffing class for rules: "RN", "MD", "Tech", or a free class label
  staffClass: text("staff_class").notNull().default("RN"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(100),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("roles_name_idx").on(table.name),
]);

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(), // e.g. "SHIFT_ASSIGNED", "EMPLOYEE_ARCHIVED", "LEAVE_APPROVED", "GUARDRAILS_UPDATED"
  entityType: text("entity_type").notNull(), // "employee", "shift_assignment", "leave_record", "settings", "user"
  entityId: text("entity_id").notNull(),
  details: text("details"),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("audit_action_idx").on(table.action),
  index("audit_entity_idx").on(table.entityType, table.entityId),
  index("audit_created_idx").on(table.createdAt),
]);
