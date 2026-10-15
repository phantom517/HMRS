// lib/audit/catalog.ts — audit display catalogs. PURE data + pure functions:
// action codes -> plain labels, record type labels, sign-in codes and the
// 60-second grouping rule. No react, no db, no next. Unit-tested.

/** Plain sentence-case labels for action codes — never raw enums in the UI. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  EMPLOYEE_CREATED: "Added employee",
  EMPLOYEE_UPDATED: "Changed employee",
  EMPLOYEE_ARCHIVED: "Archived employee",
  EMPLOYEE_RESTORED: "Restored employee",
  EMPLOYEE_HARD_DELETED: "Deleted employee permanently",
  EMPLOYEE_ARCHIVED_RETENTION: "Archived employee (has history)",
  EMPLOYEE_HARD_DELETED_ALT: "Deleted employee permanently",
  UNIT_CREATED: "Added unit",
  UNIT_UPDATED: "Changed unit",
  UNIT_RENAMED: "Renamed unit",
  UNIT_DELETED: "Deleted unit",
  ROLE_CREATED: "Added role",
  ROLE_UPDATED: "Changed role",
  ROLE_RENAMED: "Renamed role",
  ROLE_DELETED: "Deleted role",
  DEPARTMENT_UPDATED: "Changed department",
  GUARDRAILS_UPDATED: "Changed rest rule",
  RULES_UPDATED: "Changed rules",
  SHIFT_ASSIGNED: "Assigned shift",
  SHIFT_REMOVED: "Removed shift",
  LEAVE_APPROVED: "Approved leave",
  LEAVE_REJECTED: "Rejected leave",
  LEAVE_RECORDED: "Recorded leave",
  PERMISSIONS_UPDATED: "Changed permissions",
  ASSISTANT_CREATED: "Added assistant",
  ASSISTANT_DEACTIVATED: "Deactivated assistant",
  ASSISTANT_ACTIVATED: "Reactivated assistant",
  SESSION_SWITCHED: "Switched session",
  ADMIN_LOGGED_IN: "Signed in as admin",
  EMPLOYEE_VIEW_STARTED: "Opened employee view",
};

/** Humanize an unmapped code as plain sentence case: "SOME_UNKNOWN_CODE" -> "Some unknown code". */
export function humanizeActionCode(raw: string | null | undefined): string {
  const words = (raw ?? "").toLowerCase().split("_").filter(Boolean);
  if (words.length === 0) return "";
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) +
    words.slice(1).map((w) => ` ${w}`).join("");
}

export function auditActionLabel(action: string | null | undefined): string {
  return (action && AUDIT_ACTION_LABELS[action]) || humanizeActionCode(action);
}

/** Sign-in / session noise hidden behind an "Include sign-ins" toggle. */
export const SIGN_IN_ACTIONS = [
  "ADMIN_LOGGED_IN",
  "SESSION_SWITCHED",
  "EMPLOYEE_VIEW_STARTED",
] as const;

export function isSignInAction(action: string): boolean {
  return (SIGN_IN_ACTIONS as readonly string[]).includes(action);
}

/** Record type labels (entityType -> plain words). */
export const RECORD_TYPE_LABELS: Record<string, string> = {
  employee: "Employee",
  shift_assignment: "Shift",
  leave_record: "Leave",
  off_day: "Off day",
  leave_balance: "Leave balance",
  settings: "Settings",
  department_settings: "Rules",
  unit: "Unit",
  role: "Role",
  user: "Assistant account",
  shift_requirement: "Staffing policy",
};

export function recordTypeLabel(entityType: string): string {
  return RECORD_TYPE_LABELS[entityType] ?? humanizeActionCode(entityType);
}

// ── Grouping: consecutive rows, same actor + action + record type, ≤ 60 s ───

export interface AuditRowLike {
  id: string;
  createdAt: string | Date;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string | null;
  viaAssistant?: boolean;
}

export interface AuditGroup<T extends AuditRowLike> {
  key: string;
  label: string;
  count: number;
  viaAssistant: boolean;
  rows: T[];
}

const GROUP_WINDOW_MS = 60_000;

function groupSummary(count: number, action: string, actorLabel: string): string {
  const base = auditActionLabel(action);
  // Single rows keep their plain sentence label ("Archived employee"); only
  // groups of 2+ read as the numbered form ("Archived 5 employees").
  if (count <= 1) return base;
  switch (action) {
    case "EMPLOYEE_CREATED": return `Added ${count} employees`;
    case "EMPLOYEE_ARCHIVED":
    case "EMPLOYEE_ARCHIVED_RETENTION": return `Archived ${count} employees`;
    case "EMPLOYEE_HARD_DELETED":
    case "EMPLOYEE_HARD_DELETED_ALT": return `Deleted ${count} employees permanently`;
    case "SHIFT_ASSIGNED": return `Assigned ${count} shifts`;
    case "SHIFT_REMOVED": return `Removed ${count} shifts`;
    case "LEAVE_APPROVED": return `Approved ${count} leave requests`;
    case "LEAVE_REJECTED": return `Rejected ${count} leave requests`;
    case "LEAVE_RECORDED": return `Recorded ${count} leave requests`;
  }
  return `Applied ${count} × ${base}`;
}

/**
 * Group consecutive rows (already sorted newest-first) with the same
 * actor + action + record type within 60 seconds into one display group.
 * Single rows pass through as groups of one — data is never merged.
 */
export function groupAuditRows<T extends AuditRowLike>(rows: T[]): Array<AuditGroup<T>> {
  const groups: Array<AuditGroup<T>> = [];
  let current: AuditGroup<T> | null = null;

  for (const row of rows) {
    const ts = new Date(row.createdAt).getTime();
    const fits =
      current != null &&
      current.rows[0].actorName === row.actorName &&
      current.rows[0].action === row.action &&
      current.rows[0].entityType === row.entityType &&
      current.viaAssistant === Boolean(row.viaAssistant) &&
      Math.abs(new Date(current.rows[current.rows.length - 1].createdAt).getTime() - ts) <= GROUP_WINDOW_MS;

    if (current && fits) {
      current.rows.push(row);
    } else {
      current = {
        key: `${row.actorName}|${row.action}|${row.entityType}|${ts}`,
        label: groupSummary(1, row.action, row.actorName),
        count: 1,
        viaAssistant: Boolean(row.viaAssistant),
        rows: [row],
      };
      groups.push(current);
    }
    current.label = groupSummary(current.rows.length, row.action, row.actorName);
    current.count = current.rows.length;
  }

  return groups;
}
