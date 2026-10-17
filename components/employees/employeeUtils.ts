import { cycleToday } from "@/lib/schedule-cycle";

export type CredentialState = "verified" | "expiring" | "expired" | "unverified";

export function credentialStateOf(emp: any): CredentialState {
  const creds = Array.isArray(emp.credentials) ? emp.credentials : [];
  const today = cycleToday();
  if (creds.length === 0) return "unverified";
  const hasExpired = creds.some((c: any) => c.expires && c.expires < today);
  const hasExpiring = creds.some(
    (c: any) => c.expires && c.expires >= today && c.expires <= addDays(today, 60)
  );
  const allValid = creds.every(
    (c: any) => !c.expires || c.expires > addDays(today, 60)
  );
  if (hasExpired) return "expired";
  if (hasExpiring) return "expiring";
  if (allValid) return "verified";
  return "unverified";
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export const CRED_LABEL: Record<CredentialState, string> = {
  verified: "Verified",
  expiring: "Expiring",
  expired: "Expired",
  unverified: "Not verified",
};

/** Group rows by designation like the roster grid, preserving first-seen order. */
export function groupByDesignation(employees: Array<any>): Array<[string, any[]]> {
  const groups = new Map<string, any[]>();
  for (const emp of employees) {
    if (!groups.has(emp.designation)) groups.set(emp.designation, []);
    groups.get(emp.designation)!.push(emp);
  }
  return Array.from(groups.entries());
}
