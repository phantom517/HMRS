export const ROSTER_ZONES = [
  "Red Zone (Resus 1-4 & Trauma Bays)",
  "Yellow Zone (Urgent Acute Assessment)",
  "Green Zone (Fast-Track Ambulatory)",
  "Zone 4: Pediatric ED Wing",
];

/** Filter the roster by staff search text, role filter, and care-zone filter. */
export function filterRosterEmployees(
  employees: Array<any>,
  searchQuery: string,
  selectedRole: string,
  selectedZone: string
): Array<any> {
  return employees.filter((emp) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = emp.fullName.toLowerCase().includes(q);
      const matchId = emp.employeeId.toLowerCase().includes(q);
      const matchRole = emp.designation.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchRole) return false;
    }
    if (selectedRole !== "ALL") {
      if (selectedRole === "MD" && !emp.designation.includes("MD") && !emp.designation.includes("Physician") && !emp.designation.includes("Surgeon")) return false;
      if (selectedRole === "RN" && !emp.designation.includes("RN") && !emp.designation.includes("Nurse")) return false;
      if (selectedRole === "TECH" && !emp.designation.includes("Tech") && !emp.designation.includes("Paramedic")) return false;
    }
    if (selectedZone !== "ALL") {
      if (selectedZone === "Red" && !emp.unit.includes("Trauma") && !emp.unit.includes("Resus") && !emp.unit.includes("ICU")) return false;
      if (selectedZone === "Acute" && !emp.unit.includes("Acute") && !emp.unit.includes("ICU")) return false;
      if (selectedZone === "FastTrack" && !emp.unit.includes("FastTrack") && !emp.unit.includes("Triage")) return false;
    }
    return true;
  });
}

/** Group the filtered roster rows by designation, preserving first-seen order. */
export function groupByDesignation(employees: Array<any>): Array<[string, any[]]> {
  const groups = new Map<string, any[]>();
  for (const emp of employees) {
    if (!groups.has(emp.designation)) groups.set(emp.designation, []);
    groups.get(emp.designation)!.push(emp);
  }
  return Array.from(groups.entries());
}
