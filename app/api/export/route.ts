import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user.role === "assistant" && !user.permissions?.canExportReports) {
      return NextResponse.json({ error: "Unauthorized to export reports" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "roster"; // "roster", "employees", "shifts", "leaves"
    const format = searchParams.get("format") || "csv"; // "csv", "json"
    const startDate = searchParams.get("startDate") || "2024-10-01";
    const endDate = searchParams.get("endDate") || "2024-10-31";

    if (type === "employees") {
      const { employees } = await db.getEmployees();
      if (format === "json") {
        return NextResponse.json({ employees });
      }

      let csv = "Employee_ID,Full_Name,Designation,Unit,Email,Phone,Status,Date_Joined\n";
      for (const e of employees) {
        csv += `"${e.employeeId}","${e.fullName}","${e.designation}","${e.unit}","${e.email}","${e.phoneNumber}","${e.employmentStatus}","${e.dateJoined}"\n`;
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="PatanAcademy_Employee_Directory.csv"',
        },
      });
    }

    if (type === "leaves") {
      const leaves = await db.getLeaveRecords({ startDate, endDate });
      const employees = (await db.getEmployees()).employees;
      const empMap = new Map(employees.map((e) => [e.id, e]));

      if (format === "json") {
        return NextResponse.json({ leaves });
      }

      let csv = "Employee_ID,Name,Leave_Type,Start_Date,End_Date,Duration_Days,Status,Reason\n";
      for (const l of leaves) {
        const emp = empMap.get(l.employeeId);
        csv += `"${emp?.employeeId || ""}","${emp?.fullName || ""}","${l.leaveTypeId}","${l.startDate}","${l.endDate}","${l.durationDays}","${l.status}","${l.reason}"\n`;
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="PatanAcademy_Leave_Records.csv"',
        },
      });
    }

    // Default: Roster shifts
    const assignments = await db.getShiftAssignments({ startDate, endDate });
    const [employeesList, shiftTypes] = await Promise.all([
      db.getEmployees().then((r) => r.employees),
      db.getShiftTypes(),
    ]);

    const empMap = new Map(employeesList.map((e) => [e.id, e]));
    const shiftMap = new Map(shiftTypes.map((s) => [s.id, s]));

    if (format === "json") {
      return NextResponse.json({ assignments, startDate, endDate });
    }

    let csv = "Date,Shift_Code,Shift_Name,Employee_ID,Employee_Name,Ward_Zone,Status,Conflict\n";
    for (const a of assignments) {
      const emp = empMap.get(a.employeeId);
      const st = shiftMap.get(a.shiftTypeId);
      csv += `"${a.date}","${st?.shortCode || ""}","${st?.name || ""}","${emp?.employeeId || ""}","${emp?.fullName || ""}","${a.wardZone || ""}","${a.status}","${a.conflictFlag ? "YES" : "NO"}"\n`;
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="PatanAcademy_Duty_Roster_${startDate}_to_${endDate}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Export error" }, { status: 500 });
  }
}
