import { db } from "@/lib/db";

export interface EmployeeLeaveBalanceSummary {
  employeeId: string;
  balances: Array<{
    leaveTypeId: string;
    leaveTypeCode: string;
    leaveTypeName: string;
    color: string;
    allowanceDays: number;
    usedDays: number;
    pendingDays: number;
    adjustedDays: number;
    remainingDays: number;
  }>;
  totalOffDaysScheduled: number;
}

export async function calculateEmployeeLeaveBalances(employeeId: string): Promise<EmployeeLeaveBalanceSummary> {
  const [employee, leaveTypes, policies, leaveRecords, adjustments, offDays] = await Promise.all([
    db.getEmployeeById(employeeId),
    db.getLeaveTypes(),
    db.getLeavePolicies(),
    db.getLeaveRecords({ employeeId }),
    db.getLeaveBalanceAdjustments(employeeId),
    db.getOffDays({ employeeId }),
  ]);

  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  const isPhysician = employee.designation.includes("MD") || employee.designation.includes("Physician") || employee.designation.includes("Surgeon") || employee.designation.includes("Fellow");
  const isNurse = employee.designation.includes("RN") || employee.designation.includes("Nurse");

  const balances = leaveTypes.map((lt) => {
    // Find matching policy for designation
    const policy = policies.find((p) => {
      if (p.leaveTypeId !== lt.id) return false;
      if (isPhysician && p.designation === "Physician") return true;
      if (isNurse && p.designation === "Nurse") return true;
      return p.designation === "All";
    }) || policies.find((p) => p.leaveTypeId === lt.id);

    const baseAllowance = policy ? parseFloat(policy.allowanceDays as string) || 10.0 : 10.0;

    // Sum adjustments for this leave type
    const adjSum = adjustments
      .filter((a) => a.leaveTypeId === lt.id)
      .reduce((acc, a) => acc + (parseFloat(a.amount as string) || 0), 0);

    // Sum approved leave duration
    const approvedUsed = leaveRecords
      .filter((r) => r.leaveTypeId === lt.id && r.status === "approved")
      .reduce((acc, r) => acc + (parseFloat(r.durationDays as string) || 0), 0);

    // Sum pending leave duration (not subtracted from remaining, displayed separately)
    const pendingSum = leaveRecords
      .filter((r) => r.leaveTypeId === lt.id && r.status === "pending")
      .reduce((acc, r) => acc + (parseFloat(r.durationDays as string) || 0), 0);

    const remaining = Math.max(0, baseAllowance + adjSum - approvedUsed);

    return {
      leaveTypeId: lt.id,
      leaveTypeCode: lt.code,
      leaveTypeName: lt.name,
      color: lt.color,
      allowanceDays: parseFloat(baseAllowance.toFixed(1)),
      usedDays: parseFloat(approvedUsed.toFixed(1)),
      pendingDays: parseFloat(pendingSum.toFixed(1)),
      adjustedDays: parseFloat(adjSum.toFixed(1)),
      remainingDays: parseFloat(remaining.toFixed(1)),
    };
  });

  return {
    employeeId,
    balances,
    totalOffDaysScheduled: offDays.length,
  };
}
