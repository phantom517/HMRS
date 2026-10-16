// Hospital HRMS Comprehensive Clinical Seed Dataset
// 68 Clinical Staff, 6 Shift Types, Policies, Live Duty Roster, Leaves, Off-Days & Audit Trail

export interface SeedDataPayload {
  users: Array<any>;
  permissions: Array<any>;
  employees: Array<any>;
  shiftTypes: Array<any>;
  shiftAssignments: Array<any>;
  leaveTypes: Array<any>;
  leavePolicies: Array<any>;
  leaveRecords: Array<any>;
  leaveAdjustments: Array<any>;
  offDays: Array<any>;
  departmentSettings: any;
  auditLogs: Array<any>;
  shiftRequirements: Array<any>;
  holidays?: Array<any>; // Gregorian dates ONLY; optional for backwards compatibility
  // Admin-managed dictionaries. Optional: derived from employees when absent.
  units?: Array<any>;
  roles?: Array<any>;
}

export function getSeedData(): SeedDataPayload {
  const users = [
    {
      id: "usr_jenkins_001",
      name: "Dr. Sarah Jenkins",
      email: "sarah.jenkins@patanacademy.edu.np",
      // bcrypt hash for "Password123!"
      passwordHash: "$2a$10$wK1m3v/U7G3zC5cZ.gT5v.Z7hYwK8n6hP2o4iM1qY7aX0bC.dE6fG",
      role: "superuser",
      title: "RN, MSN • Superuser (Clinical Director)",
      active: true,
      avatarUrl: "/images/rostova.jpg",
      createdAt: new Date("2024-01-01T08:00:00Z"),
      updatedAt: new Date("2024-10-24T08:00:00Z"),
    },
    {
      id: "usr_vance_002",
      name: "Marcus Vance",
      email: "marcus.vance@patanacademy.edu.np",
      passwordHash: "$2a$10$wK1m3v/U7G3zC5cZ.gT5v.Z7hYwK8n6hP2o4iM1qY7aX0bC.dE6fG",
      role: "assistant",
      title: "Trauma Lead RN • Assistant Manager",
      active: true,
      avatarUrl: "/images/vance.jpg",
      createdAt: new Date("2024-03-15T08:00:00Z"),
      updatedAt: new Date("2024-10-24T08:00:00Z"),
    },
    {
      id: "usr_viewer_003",
      name: "Staff Member (View Only)",
      email: "viewer@patanacademy.edu.np",
      passwordHash: "$2a$10$wK1m3v/U7G3zC5cZ.gT5v.Z7hYwK8n6hP2o4iM1qY7aX0bC.dE6fG",
      role: "viewer",
      title: "Emergency Staff • Read-Only View",
      active: true,
      avatarUrl: null,
      createdAt: new Date("2024-03-15T08:00:00Z"),
      updatedAt: new Date("2024-10-24T08:00:00Z"),
    },
  ];

  const permissions = [
    {
      id: "perm_vance_002",
      userId: "usr_vance_002",
      canEditEmployees: true,
      canManageShifts: true,
      canAssignShifts: true,
      canApproveLeave: false, // Superuser must approve
      canManagePolicies: false,
      canExportReports: true,
      canViewAuditLogs: true,
      canDeleteEmployees: false,
      createdAt: new Date("2024-03-15T08:00:00Z"),
      updatedAt: new Date("2024-10-24T08:00:00Z"),
    },
  ];

  const shiftTypes = [
    {
      id: "st_day_01",
      name: "Day Shift",
      shortCode: "D",
      description: "ED Acute Ward & Primary Day Intake",
      color: "#00685f", // Teal
      category: "REGULAR",
      startTime: "07:00",
      endTime: "15:30",
      breakDurationMinutes: 30,
      netDurationHours: "8.00",
      minimumStaffRn: 12,
      minimumStaffMd: 3,
      targetStaff: 14,
      maximumStaff: 18,
      crossesMidnight: false,
      enforceRestRule: true,
      traumaPremium: false,
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-10-01T00:00:00Z"),
    },
    {
      id: "st_eve_02",
      name: "Evening Shift",
      shortCode: "E",
      description: "Emergency & Resus High-Acuity Coverage",
      color: "#0051d5", // Blue
      category: "PEAK SURGE",
      startTime: "15:00",
      endTime: "23:30",
      breakDurationMinutes: 30,
      netDurationHours: "8.00",
      minimumStaffRn: 8,
      minimumStaffMd: 2,
      targetStaff: 10,
      maximumStaff: 14,
      crossesMidnight: false,
      enforceRestRule: true,
      traumaPremium: false,
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-10-01T00:00:00Z"),
    },
    {
      id: "st_ngt_03",
      name: "Overnight ICU / Trauma",
      shortCode: "N",
      description: "Level 1 ICU Trauma & Resuscitation (+1 Day)",
      color: "#712ae2", // Purple
      category: "+1 DAY",
      startTime: "22:00",
      endTime: "06:30",
      breakDurationMinutes: 45,
      netDurationHours: "7.75",
      minimumStaffRn: 6,
      minimumStaffMd: 2,
      targetStaff: 7,
      maximumStaff: 10,
      crossesMidnight: true,
      isNight: true,
      enforceRestRule: true,
      traumaPremium: true,
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-10-01T00:00:00Z"),
    },
    {
      id: "st_trg_04",
      name: "Triage Rapid Response",
      shortCode: "TR",
      description: "Frontline Reception & Rapid Ambulatory Triage",
      color: "#316bf3", // Cyan/Blue
      category: "DYNAMIC",
      startTime: "10:00",
      endTime: "18:00",
      breakDurationMinutes: 0,
      netDurationHours: "8.00",
      minimumStaffRn: 4,
      minimumStaffMd: 1,
      targetStaff: 5,
      maximumStaff: 7,
      crossesMidnight: false,
      enforceRestRule: true,
      traumaPremium: false,
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-10-01T00:00:00Z"),
    },
    {
      id: "st_oc_05",
      name: "On-Call Surgical Standby",
      shortCode: "OC",
      description: "24-Hour Pager Rotation for Emergency Surgery",
      color: "#8a4cfc", // Bright Violet
      category: "1.5x MULT",
      startTime: "00:00",
      endTime: "23:59",
      breakDurationMinutes: 0,
      netDurationHours: "24.00",
      minimumStaffRn: 2,
      minimumStaffMd: 2,
      targetStaff: 4,
      maximumStaff: 6,
      crossesMidnight: true,
      isNight: true,
      enforceRestRule: true,
      traumaPremium: true,
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-10-01T00:00:00Z"),
    },
    {
      id: "st_ped_06",
      name: "Pediatric ER Rotation",
      shortCode: "PED",
      description: "Peds Urgent Wing & Neonatal Triage",
      color: "#008378", // Dark Teal
      category: "SPECIALIZED",
      startTime: "08:00",
      endTime: "16:30",
      breakDurationMinutes: 30,
      netDurationHours: "8.00",
      minimumStaffRn: 3,
      minimumStaffMd: 1,
      targetStaff: 4,
      maximumStaff: 6,
      crossesMidnight: false,
      enforceRestRule: true,
      traumaPremium: false,
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-10-01T00:00:00Z"),
    },
  ];

  const leaveTypes = [
    {
      id: "lt_sick",
      name: "Medical / Sick Leave (Form 14-B)",
      code: "SICK",
      description: "Statutory acute sickness or physician cert",
      paid: true,
      requiresApproval: true,
      color: "#ba1a1a",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "lt_annual",
      name: "Annual Planned Vacation",
      code: "ANNUAL",
      description: "Statutory standard paid time off (PTO)",
      paid: true,
      requiresApproval: true,
      color: "#00685f",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "lt_cme",
      name: "CME / Clinical Seminar",
      code: "CME",
      description: "Continuing Medical Education and certifications",
      paid: true,
      requiresApproval: true,
      color: "#712ae2",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "lt_casual",
      name: "Casual Personal Day",
      code: "CASUAL",
      description: "Unplanned short-notice personal or family care day",
      paid: true,
      requiresApproval: true,
      color: "#0051d5",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "lt_unpaid",
      name: "Statutory Unpaid Leave",
      code: "UNPAID",
      description: "Extended personal or sabbatical rest",
      paid: false,
      requiresApproval: true,
      color: "#6d7a77",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
  ];

  const leavePolicies = [
    {
      id: "pol_md_annual",
      name: "Physician Annual Quota",
      designation: "Physician",
      leaveTypeId: "lt_annual",
      allowanceDays: "20.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "8.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "pol_md_sick",
      name: "Physician Sick Quota",
      designation: "Physician",
      leaveTypeId: "lt_sick",
      allowanceDays: "12.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "0.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "pol_md_cme",
      name: "Physician CME/Study Quota",
      designation: "Physician",
      leaveTypeId: "lt_cme",
      allowanceDays: "8.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "2.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "pol_rn_annual",
      name: "Nursing Staff Annual Quota",
      designation: "Nurse",
      leaveTypeId: "lt_annual",
      allowanceDays: "16.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "6.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "pol_rn_sick",
      name: "Nursing Staff Sick Quota",
      designation: "Nurse",
      leaveTypeId: "lt_sick",
      allowanceDays: "10.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "0.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "pol_rn_cme",
      name: "Nursing Staff CME Quota",
      designation: "Nurse",
      leaveTypeId: "lt_cme",
      allowanceDays: "4.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "0.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "pol_all_casual",
      name: "Emergency Casual Day Policy",
      designation: "All",
      leaveTypeId: "lt_casual",
      allowanceDays: "5.0",
      policyPeriod: "calendar_year",
      carryForwardDays: "0.0",
      effectiveFrom: "2024-01-01",
      active: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
  ];

  // Exactly 68 authentic hospital clinical staff members
  const rawStaffSpecs = [
    { id: "emp_01", empId: "NUR-204", name: "Marcus Vance", desig: "Trauma Lead RN", unit: "Trauma Bay 1-4 • Red Team", phone: "+1 (555) 234-8901", email: "marcus.vance@patanacademy.edu.np", ext: "x4402", pager: "PGR-8891-VANCE", joined: "2021-03-14", status: "active", avatar: "/images/vance.jpg", creds: ["ACLS", "TNCC", "BLS"] },
    { id: "emp_02", empId: "DOC-101", name: "Dr. Elena Rostova", desig: "Attending Trauma MD", unit: "Resus & Critical Overlook", phone: "+1 (555) 892-4411", email: "elena.rostova@patanacademy.edu.np", ext: "x4410", pager: "PGR-1014-ROSTOVA", joined: "2019-07-22", status: "active", avatar: "/images/rostova.jpg", creds: ["ABEM", "ATLS", "FACS"] },
    { id: "emp_03", empId: "TEC-309", name: "Liam Chen", desig: "Emergency Paramedic Tech", unit: "Rapid Response Ambulatory", phone: "+1 (555) 774-1200", email: "liam.chen@patanacademy.edu.np", ext: "x4408", pager: "PGR-5489-CHEN", joined: "2022-11-05", status: "active", creds: ["CCEMTP", "NRP", "BLS"] },
    { id: "emp_04", empId: "NUR-212", name: "Amina Diallo", desig: "ICU Staff Nurse II", unit: "ICU Pod Beta (Ventilator)", phone: "+1 (555) 301-8842", email: "amina.diallo@patanacademy.edu.np", ext: "x4430", pager: "PGR-3012-DIALLO", joined: "2020-04-18", status: "on_leave", creds: ["CCRN", "ACLS"] },
    { id: "emp_05", empId: "NUR-198", name: "Carlos Ramirez", desig: "Night Shift Charge RN", unit: "FastTrack & Triage Gate", phone: "+1 (555) 440-9921", email: "carlos.ramirez@patanacademy.edu.np", ext: "x4415", pager: "PGR-1980-RAMIREZ", joined: "2018-09-01", status: "active", creds: ["CEN", "CPEN", "ACLS"] },
    { id: "emp_06", empId: "DOC-108", name: "Dr. Maya Patel", desig: "Intensivist / Resus Fellow", unit: "Trauma Pod 3 & Pediatric Bay", phone: "+1 (555) 602-3310", email: "maya.patel@patanacademy.edu.np", ext: "x4422", pager: "PGR-0812-PATEL", joined: "2023-01-15", status: "active", creds: ["FCCP", "ATLS"] },
    { id: "emp_07", empId: "DOC-2041", name: "Dr. Marcus Thorne", desig: "Senior Trauma Surgeon (MD)", unit: "Zone 1: Resuscitation", phone: "+1 (555) 918-0044", email: "marcus.thorne@patanacademy.edu.np", ext: "x4401", pager: "PGR-2041-THORNE", joined: "2017-06-10", status: "active", avatar: "/images/thorne.jpg", creds: ["FACS", "ATLS", "ABEM"] },
    { id: "emp_08", empId: "NUR-3309", name: "Nurse Clara Diaz", desig: "Charge RN • Acute Resus", unit: "Zone 2: Rapid Assessment", phone: "+1 (555) 829-4110", email: "clara.diaz@patanacademy.edu.np", ext: "x4405", pager: "PGR-3309-DIAZ", joined: "2021-08-20", status: "active", avatar: "/images/diaz.jpg", creds: ["ACLS", "TNCC", "BLS"] },
    { id: "emp_09", empId: "DOC-108B", name: "Dr. Julian Hayes", desig: "Emergency Trauma Surgeon", unit: "Trauma OR & Surgical Suite", phone: "+1 (555) 492-3320", email: "julian.hayes@patanacademy.edu.np", ext: "x4411", pager: "PGR-1088-HAYES", joined: "2019-10-12", status: "active", creds: ["FACS", "ATLS"] },
    { id: "emp_10", empId: "NUR-305", name: "Nurse Sarah Lin", desig: "Critical Care RN", unit: "ICU Critical Observation", phone: "+1 (555) 789-2211", email: "sarah.lin@patanacademy.edu.np", ext: "x4419", pager: "PGR-3051-LIN", joined: "2020-02-14", status: "active", creds: ["CCRN", "ACLS"] },
    { id: "emp_11", empId: "TEC-089", name: "Tech David Miller", desig: "Senior Triage Paramedic", unit: "Ambulance Bay & Intake", phone: "+1 (555) 338-1900", email: "david.miller@patanacademy.edu.np", ext: "x4409", pager: "PGR-0892-MILLER", joined: "2022-04-01", status: "active", creds: ["NRP", "CCEMTP"] },
    { id: "emp_12", empId: "NUR-220", name: "Nurse Priya Sharma", desig: "Pediatric ER Specialist", unit: "Zone 4: Pediatric ED", phone: "+1 (555) 901-4433", email: "priya.sharma@patanacademy.edu.np", ext: "x4425", pager: "PGR-2204-SHARMA", joined: "2021-05-18", status: "active", creds: ["CPEN", "PALS"] },
    { id: "emp_13", empId: "NUR-145", name: "Nurse Carlos Mendez", desig: "ER Staff Nurse", unit: "Zone 3: Acute Trauma", phone: "+1 (555) 612-8877", email: "carlos.mendez@patanacademy.edu.np", ext: "x4414", pager: "PGR-1450-MENDEZ", joined: "2023-03-01", status: "active", creds: ["BLS", "ACLS"] },
    { id: "emp_14", empId: "DOC-115", name: "Dr. Tariq Mansoor", desig: "Trauma Surgery Fellow", unit: "Trauma Bay Red", phone: "+1 (555) 770-1122", email: "tariq.mansoor@patanacademy.edu.np", ext: "x4413", pager: "PGR-1150-MANSOOR", joined: "2023-07-01", status: "active", creds: ["ATLS", "ABS"] },
    { id: "emp_15", empId: "NUR-188", name: "Nurse Aaliyah Patel", desig: "Triage RN & Assessment", unit: "Triage Rapid Surge", phone: "+1 (555) 402-9900", email: "aaliyah.patel@patanacademy.edu.np", ext: "x4406", pager: "PGR-1882-PATEL", joined: "2022-09-10", status: "active", creds: ["CEN", "BLS"] },
    { id: "emp_16", empId: "TEC-119", name: "Tech Brandon Cole", desig: "ER Tech & Phlebotomist", unit: "Clinical Support Pod", phone: "+1 (555) 390-1188", email: "brandon.cole@patanacademy.edu.np", ext: "x4412", pager: "PGR-1190-COLE", joined: "2023-05-15", status: "active", creds: ["CPT", "BLS"] },
    { id: "emp_17", empId: "NUR-302", name: "Nurse Zoe Kravitz", desig: "Staff RN • Trauma Resus", unit: "Resus Bed 3 & 4", phone: "+1 (555) 881-2299", email: "zoe.kravitz@patanacademy.edu.np", ext: "x4416", pager: "PGR-3021-KRAVITZ", joined: "2021-12-01", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_18", empId: "DOC-122", name: "Dr. Arthur Pendelton", desig: "Attending Pediatric ER", unit: "Zone 4: Pediatric ED", phone: "+1 (555) 701-3344", email: "arthur.pendelton@patanacademy.edu.np", ext: "x4426", pager: "PGR-1220-PENDELTON", joined: "2018-05-15", status: "active", creds: ["FAAP", "PALS"] },
    { id: "emp_19", empId: "NUR-255", name: "Nurse Samantha Reed", desig: "Trauma Resuscitation RN", unit: "Trauma Bay Red", phone: "+1 (555) 552-9911", email: "samantha.reed@patanacademy.edu.np", ext: "x4417", pager: "PGR-2550-REED", joined: "2020-11-20", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_20", empId: "DOC-130", name: "Dr. Kevin Patel", desig: "On-Call Anesthesiologist", unit: "Emergency Surgery & Resus", phone: "+1 (555) 820-4499", email: "kevin.patel@patanacademy.edu.np", ext: "x4420", pager: "PGR-1300-PATEL", joined: "2019-02-18", status: "active", creds: ["ABA", "ATLS"] },
    { id: "emp_21", empId: "NUR-260", name: "Nurse David Chen", desig: "Float Pool Critical RN", unit: "Overflow Pod A", phone: "+1 (555) 441-2288", email: "david.chen@patanacademy.edu.np", ext: "x4432", pager: "PGR-2601-CHEN", joined: "2022-01-10", status: "active", creds: ["CCRN", "ACLS"] },
    { id: "emp_22", empId: "NUR-265", name: "Nurse Naomi Ortiz", desig: "ED Trauma RN", unit: "Zone 1: Resuscitation", phone: "+1 (555) 779-3301", email: "naomi.ortiz@patanacademy.edu.np", ext: "x4433", pager: "PGR-2650-ORTIZ", joined: "2021-04-22", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_23", empId: "TEC-140", name: "Tech Jason Miller", desig: "Triage Specialist Tech", unit: "Rapid Assessment", phone: "+1 (555) 601-2299", email: "jason.miller@patanacademy.edu.np", ext: "x4434", pager: "PGR-1400-MILLER", joined: "2023-02-14", status: "active", creds: ["NRP", "BLS"] },
    { id: "emp_24", empId: "DOC-135", name: "Dr. Amanda Hayes", desig: "Senior Resus Physician", unit: "Zone 2: Rapid Assessment", phone: "+1 (555) 919-4400", email: "amanda.hayes@patanacademy.edu.np", ext: "x4435", pager: "PGR-1350-HAYES", joined: "2017-10-05", status: "active", creds: ["ABEM", "ATLS"] },
    { id: "emp_25", empId: "NUR-270", name: "Nurse Linda Gomez", desig: "ICU Night RN", unit: "ICU Pod Alpha", phone: "+1 (555) 338-7711", email: "linda.gomez@patanacademy.edu.np", ext: "x4436", pager: "PGR-2700-GOMEZ", joined: "2020-08-15", status: "active", creds: ["CCRN", "ACLS"] },
    { id: "emp_26", empId: "NUR-275", name: "Nurse Megan Choi", desig: "Staff RN • Acute Care", unit: "Acute Ward East", phone: "+1 (555) 209-4411", email: "megan.choi@patanacademy.edu.np", ext: "x4437", pager: "PGR-2750-CHOI", joined: "2022-06-18", status: "active", creds: ["BLS", "ACLS"] },
    { id: "emp_27", empId: "NUR-280", name: "Nurse Javier Garcia", desig: "ICU Specialist RN", unit: "ICU Pod Beta", phone: "+1 (555) 880-1144", email: "javier.garcia@patanacademy.edu.np", ext: "x4438", pager: "PGR-2800-GARCIA", joined: "2021-09-01", status: "active", creds: ["CCRN", "TNCC"] },
    { id: "emp_28", empId: "TEC-145", name: "Tech Samuel Briggs", desig: "Paramedic Field Tech", unit: "Ambulance Bay", phone: "+1 (555) 771-4402", email: "samuel.briggs@patanacademy.edu.np", ext: "x4439", pager: "PGR-1450-BRIGGS", joined: "2023-04-10", status: "off_duty", creds: ["CCEMTP"] },
    { id: "emp_29", empId: "NUR-285", name: "Nurse Karen Ward", desig: "Emergency Staff RN", unit: "Zone 3: Acute Trauma", phone: "+1 (555) 449-0022", email: "karen.ward@patanacademy.edu.np", ext: "x4440", pager: "PGR-2850-WARD", joined: "2020-03-12", status: "active", creds: ["CEN", "ACLS"] },
    { id: "emp_30", empId: "NUR-290", name: "Nurse Nathan Lawson", desig: "Trauma Resus RN", unit: "Trauma Bay 1", phone: "+1 (555) 902-1188", email: "nathan.lawson@patanacademy.edu.np", ext: "x4441", pager: "PGR-2900-LAWSON", joined: "2021-10-15", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_31", empId: "TEC-150", name: "Tech Rachel Park", desig: "Clinical Triage Tech", unit: "Frontline Reception", phone: "+1 (555) 304-8822", email: "rachel.park@patanacademy.edu.np", ext: "x4442", pager: "PGR-1500-PARK", joined: "2022-08-01", status: "active", creds: ["BLS", "EMT-P"] },
    { id: "emp_32", empId: "NUR-295", name: "Nurse Daniel Huang", desig: "Critical Care RN", unit: "ICU Pod Alpha", phone: "+1 (555) 559-0011", email: "daniel.huang@patanacademy.edu.np", ext: "x4443", pager: "PGR-2950-HUANG", joined: "2020-06-20", status: "active", creds: ["CCRN", "ACLS"] },
    { id: "emp_33", empId: "NUR-310", name: "Nurse Teresa Gomez", desig: "Trauma RN • Nights", unit: "Trauma Bay Red", phone: "+1 (555) 884-2200", email: "teresa.gomez@patanacademy.edu.np", ext: "x4444", pager: "PGR-3100-GOMEZ", joined: "2021-01-15", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_34", empId: "NUR-315", name: "Nurse Ethan Weber", desig: "Triage Lead RN", unit: "Triage Rapid Surge", phone: "+1 (555) 612-4499", email: "ethan.weber@patanacademy.edu.np", ext: "x4445", pager: "PGR-3150-WEBER", joined: "2019-11-01", status: "active", creds: ["CEN", "ACLS"] },
    { id: "emp_35", empId: "TEC-155", name: "Tech Brian Ross", desig: "Ambulance Support Tech", unit: "FastTrack Reception", phone: "+1 (555) 790-2211", email: "brian.ross@patanacademy.edu.np", ext: "x4446", pager: "PGR-1550-ROSS", joined: "2023-01-20", status: "active", creds: ["EMT-P"] },
    { id: "emp_36", empId: "NUR-320", name: "Nurse Patricia Lewis", desig: "Staff Nurse • Ambulatory", unit: "FastTrack ER", phone: "+1 (555) 438-1100", email: "patricia.lewis@patanacademy.edu.np", ext: "x4447", pager: "PGR-3200-LEWIS", joined: "2022-03-10", status: "active", creds: ["BLS", "ACLS"] },
    { id: "emp_37", empId: "DOC-140", name: "Dr. Kelly Novak", desig: "Physician Assistant (PA)", unit: "FastTrack & Triage", phone: "+1 (555) 909-3388", email: "kelly.novak@patanacademy.edu.np", ext: "x4448", pager: "PGR-1400-NOVAK", joined: "2021-07-14", status: "active", creds: ["PA-C", "ATLS"] },
    { id: "emp_38", empId: "NUR-325", name: "Nurse Liam O'Connor", desig: "Pediatric ED RN", unit: "Zone 4: Pediatric ED", phone: "+1 (555) 229-4401", email: "liam.oconnor@patanacademy.edu.np", ext: "x4449", pager: "PGR-3250-OCONNOR", joined: "2022-10-05", status: "active", creds: ["PALS", "BLS"] },
    { id: "emp_39", empId: "NUR-330", name: "Nurse Chloe Bennett", desig: "Clinical Staff Nurse", unit: "Zone 2: Rapid Assessment", phone: "+1 (555) 710-9922", email: "chloe.bennett@patanacademy.edu.np", ext: "x4450", pager: "PGR-3300-BENNETT", joined: "2020-05-18", status: "active", creds: ["ACLS", "BLS"] },
    { id: "emp_40", empId: "DOC-145", name: "Dr. Victor Vance", desig: "Senior Emergency Physician", unit: "Resus & Critical Overlook", phone: "+1 (555) 880-3311", email: "victor.vance@patanacademy.edu.np", ext: "x4451", pager: "PGR-1450-VANCE", joined: "2018-01-20", status: "active", creds: ["ABEM", "ATLS"] },
    { id: "emp_41", empId: "NUR-335", name: "Nurse Olivia Scott", desig: "Trauma Care Nurse", unit: "Trauma Bay 2", phone: "+1 (555) 399-4422", email: "olivia.scott@patanacademy.edu.np", ext: "x4452", pager: "PGR-3350-SCOTT", joined: "2021-06-30", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_42", empId: "NUR-340", name: "Nurse Isaac Newton", desig: "ICU Specialist RN", unit: "ICU Pod Alpha", phone: "+1 (555) 610-8800", email: "isaac.newton@patanacademy.edu.np", ext: "x4453", pager: "PGR-3400-NEWTON", joined: "2020-09-15", status: "active", creds: ["CCRN", "ACLS"] },
    { id: "emp_43", empId: "TEC-160", name: "Tech Lucas Wright", desig: "Emergency Tech II", unit: "Observation Deck", phone: "+1 (555) 448-2200", email: "lucas.wright@patanacademy.edu.np", ext: "x4454", pager: "PGR-1600-WRIGHT", joined: "2023-08-01", status: "active", creds: ["EMT-P"] },
    { id: "emp_44", empId: "NUR-345", name: "Nurse Grace Hopper", desig: "Charge RN • Surgical Pod", unit: "Emergency Surgery Suite", phone: "+1 (555) 901-2299", email: "grace.hopper@patanacademy.edu.np", ext: "x4455", pager: "PGR-3450-HOPPER", joined: "2019-04-12", status: "active", creds: ["CNOR", "ACLS"] },
    { id: "emp_45", empId: "DOC-150", name: "Dr. Simon Drake", desig: "Clinical Toxicologist (MD)", unit: "Zone 1: Resuscitation", phone: "+1 (555) 779-1100", email: "simon.drake@patanacademy.edu.np", ext: "x4456", pager: "PGR-1500-DRAKE", joined: "2019-12-05", status: "active", creds: ["ABMT", "ATLS"] },
    { id: "emp_46", empId: "NUR-350", name: "Nurse Henry Ford", desig: "Trauma Resus RN", unit: "Trauma Bay 3", phone: "+1 (555) 302-8811", email: "henry.ford@patanacademy.edu.np", ext: "x4457", pager: "PGR-3500-FORD", joined: "2021-02-14", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_47", empId: "NUR-355", name: "Nurse Evelyn Wright", desig: "Pediatric Emergency RN", unit: "Zone 4: Pediatric ED", phone: "+1 (555) 558-4411", email: "evelyn.wright@patanacademy.edu.np", ext: "x4458", pager: "PGR-3550-WRIGHT", joined: "2022-05-20", status: "active", creds: ["PALS", "BLS"] },
    { id: "emp_48", empId: "TEC-165", name: "Tech Aaron Brooks", desig: "Paramedic Dispatch Specialist", unit: "Triage Intake", phone: "+1 (555) 880-9922", email: "aaron.brooks@patanacademy.edu.np", ext: "x4459", pager: "PGR-1650-BROOKS", joined: "2023-06-10", status: "active", creds: ["NRP"] },
    { id: "emp_49", empId: "NUR-360", name: "Nurse Maya Lin", desig: "Acute Care Nurse", unit: "Zone 3: Acute Trauma", phone: "+1 (555) 662-1100", email: "maya.lin@patanacademy.edu.np", ext: "x4460", pager: "PGR-3600-LIN", joined: "2020-10-18", status: "active", creds: ["ACLS", "BLS"] },
    { id: "emp_50", empId: "DOC-155", name: "Dr. Rachel Green", desig: "Emergency Medicine Fellow", unit: "Resus & Critical Overlook", phone: "+1 (555) 919-2288", email: "rachel.green@patanacademy.edu.np", ext: "x4461", pager: "PGR-1550-GREEN", joined: "2023-07-01", status: "active", creds: ["ATLS", "ABEM"] },
    { id: "emp_51", empId: "NUR-365", name: "Nurse James Wilson", desig: "ICU Staff Nurse", unit: "ICU Pod Beta", phone: "+1 (555) 301-4477", email: "james.wilson@patanacademy.edu.np", ext: "x4462", pager: "PGR-3650-WILSON", joined: "2021-03-25", status: "active", creds: ["CCRN", "ACLS"] },
    { id: "emp_52", empId: "NUR-370", name: "Nurse Lisa Cuddy", desig: "Trauma Coordinator RN", unit: "Trauma Bay Red", phone: "+1 (555) 774-8899", email: "lisa.cuddy@patanacademy.edu.np", ext: "x4463", pager: "PGR-3700-CUDDY", joined: "2018-04-10", status: "active", creds: ["TNCC", "CEN"] },
    { id: "emp_53", empId: "TEC-170", name: "Tech Robert Chase", desig: "Clinical Lab Specialist", unit: "Diagnostic Rapid Hub", phone: "+1 (555) 550-2211", email: "robert.chase@patanacademy.edu.np", ext: "x4464", pager: "PGR-1700-CHASE", joined: "2022-02-18", status: "active", creds: ["BLS", "CPT"] },
    { id: "emp_54", empId: "NUR-375", name: "Nurse Allison Cameron", desig: "Emergency Staff RN", unit: "Zone 2: Rapid Assessment", phone: "+1 (555) 889-1144", email: "allison.cameron@patanacademy.edu.np", ext: "x4465", pager: "PGR-3750-CAMERON", joined: "2020-07-22", status: "active", creds: ["ACLS", "BLS"] },
    { id: "emp_55", empId: "DOC-160", name: "Dr. Gregory House", desig: "Senior Diagnostic Consultant", unit: "Zone 1: Resuscitation", phone: "+1 (555) 911-0001", email: "gregory.house@patanacademy.edu.np", ext: "x4466", pager: "PGR-1600-HOUSE", joined: "2015-09-01", status: "active", creds: ["ABIM", "ATLS"] },
    { id: "emp_56", empId: "NUR-380", name: "Nurse Eric Foreman", desig: "Charge RN • Night Lead", unit: "Zone 3: Acute Trauma", phone: "+1 (555) 441-9988", email: "eric.foreman@patanacademy.edu.np", ext: "x4467", pager: "PGR-3800-FOREMAN", joined: "2019-08-14", status: "active", creds: ["CEN", "ACLS"] },
    { id: "emp_57", empId: "NUR-385", name: "Nurse Remy Hadley", desig: "Trauma Resus RN", unit: "Trauma Bay 4", phone: "+1 (555) 780-3322", email: "remy.hadley@patanacademy.edu.np", ext: "x4468", pager: "PGR-3850-HADLEY", joined: "2021-11-05", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_58", empId: "TEC-175", name: "Tech Chris Taub", desig: "ER Mobile Paramedic", unit: "Ambulance Bay", phone: "+1 (555) 309-8800", email: "chris.taub@patanacademy.edu.np", ext: "x4469", pager: "PGR-1750-TAUB", joined: "2023-03-12", status: "active", creds: ["CCEMTP"] },
    { id: "emp_59", empId: "NUR-390", name: "Nurse Lawrence Kutner", desig: "Staff RN • FastTrack", unit: "FastTrack Ambulatory", phone: "+1 (555) 668-2299", email: "lawrence.kutner@patanacademy.edu.np", ext: "x4470", pager: "PGR-3900-KUTNER", joined: "2022-04-15", status: "active", creds: ["BLS", "ACLS"] },
    { id: "emp_60", empId: "DOC-165", name: "Dr. Amber Volakis", desig: "Critical Care Resus MD", unit: "Resus & Critical Overlook", phone: "+1 (555) 902-7711", email: "amber.volakis@patanacademy.edu.np", ext: "x4471", pager: "PGR-1650-VOLAKIS", joined: "2020-01-10", status: "active", creds: ["ATLS", "ABEM"] },
    { id: "emp_61", empId: "NUR-395", name: "Nurse Martha Masters", desig: "ICU Resident Nurse", unit: "ICU Pod Alpha", phone: "+1 (555) 440-1122", email: "martha.masters@patanacademy.edu.np", ext: "x4472", pager: "PGR-3950-MASTERS", joined: "2023-09-01", status: "active", creds: ["BLS", "ACLS"] },
    { id: "emp_62", empId: "NUR-400", name: "Nurse Chi Park", desig: "Emergency Staff RN", unit: "Zone 2: Rapid Assessment", phone: "+1 (555) 881-9900", email: "chi.park@patanacademy.edu.np", ext: "x4473", pager: "PGR-4000-PARK", joined: "2022-07-20", status: "active", creds: ["ACLS", "BLS"] },
    { id: "emp_63", empId: "TEC-180", name: "Tech Jessica Adams", desig: "Clinical Assistant Tech", unit: "Triage Intake", phone: "+1 (555) 559-8811", email: "jessica.adams@patanacademy.edu.np", ext: "x4474", pager: "PGR-1800-ADAMS", joined: "2023-05-01", status: "active", creds: ["BLS"] },
    { id: "emp_64", empId: "DOC-170", name: "Dr. Jeffrey Cole", desig: "Pediatric Emergency Fellow", unit: "Zone 4: Pediatric ED", phone: "+1 (555) 770-4499", email: "jeffrey.cole@patanacademy.edu.np", ext: "x4475", pager: "PGR-1700-COLE", joined: "2023-08-15", status: "active", creds: ["PALS", "FAAP"] },
    { id: "emp_65", empId: "NUR-405", name: "Nurse Travis Vance", desig: "Trauma Resus RN", unit: "Trauma Bay 1", phone: "+1 (555) 301-7788", email: "travis.vance@patanacademy.edu.np", ext: "x4476", pager: "PGR-4050-VANCE", joined: "2021-04-10", status: "active", creds: ["TNCC", "ACLS"] },
    { id: "emp_66", empId: "NUR-410", name: "Nurse Brenda Chen", desig: "Staff RN • Acute Care", unit: "Zone 3: Acute Trauma", phone: "+1 (555) 662-8800", email: "brenda.chen@patanacademy.edu.np", ext: "x4477", pager: "PGR-4100-CHEN", joined: "2020-12-05", status: "active", creds: ["BLS", "ACLS"] },
    { id: "emp_67", empId: "DOC-175", name: "Dr. Leonard Hofstadter", desig: "Emergency Medicine Specialist", unit: "Zone 1: Resuscitation", phone: "+1 (555) 909-1144", email: "leonard.hofstadter@patanacademy.edu.np", ext: "x4478", pager: "PGR-1750-HOFSTADTER", joined: "2019-06-18", status: "active", creds: ["ABEM", "ATLS"] },
    { id: "emp_68", empId: "NUR-415", name: "Nurse Bernadette Rosten", desig: "Clinical Lead RN (Archived)", unit: "Former Trauma Support", phone: "+1 (555) 448-7711", email: "bernadette.rosten@patanacademy.edu.np", ext: "x4479", pager: "PGR-4150-ROSTEN", joined: "2017-02-10", status: "archived", creds: ["CEN", "ACLS"] },
  ];

  const employees = rawStaffSpecs.map((s) => ({
    id: s.id,
    employeeId: s.empId,
    fullName: s.name,
    designation: s.desig,
    department: "Emergency & Trauma",
    unit: s.unit,
    phoneNumber: s.phone,
    email: s.email,
    hospitalExt: s.ext,
    pagerNumber: s.pager,
    dateJoined: s.joined,
    employmentStatus: s.status,
    notes: s.status === "archived" ? "Archived record. Historical shifts and leave logs fully retained." : "Active certified clinical personnel.",
    avatarUrl: s.avatar || null,
    credentials: (s.creds || []).map((c) => ({
      name: c,
      issuer: c === "ACLS" || c === "BLS" || c === "PALS" ? "American Heart Association (AHA)" : c === "TNCC" ? "Emergency Nurses Association (ENA)" : "Board Certification Registry",
      expires: "2026-08-31",
      status: "Active & Valid",
    })),
    active: s.status !== "archived",
    archivedAt: s.status === "archived" ? new Date("2024-09-30T10:00:00Z") : null,
    createdAt: new Date(s.joined + "T08:00:00Z"),
    updatedAt: new Date("2024-10-24T08:00:00Z"),
  }));

  // Week 43 dates: Oct 21 to Oct 27, 2024
  // Plus historical shifts for October (MTD)
  const shiftAssignments: Array<any> = [];

  // Generate Week 43 shifts matching the reference spreadsheet
  // Oct 21 (Mon), Oct 22 (Tue), Oct 23 (Wed), Oct 24 (Thu - Today), Oct 25 (Fri - Conflict), Oct 26 (Sat), Oct 27 (Sun)
  const weekDays = [
    { date: "2024-10-21", name: "Mon" },
    { date: "2024-10-22", name: "Tue" },
    { date: "2024-10-23", name: "Wed" },
    { date: "2024-10-24", name: "Thu" },
    { date: "2024-10-25", name: "Fri" },
    { date: "2024-10-26", name: "Sat" },
    { date: "2024-10-27", name: "Sun" },
  ];

  // Specific employee schedules mapped from Image 11:
  // 1. Dr. Emily Watson (DOC-101 / emp_02)
  const watsonSchedule = [
    { day: "2024-10-21", shift: "st_day_01", zone: "Zone Red (Resus)", status: "completed" },
    { day: "2024-10-22", shift: "st_day_01", zone: "Zone Red (Resus)", status: "completed" },
    { day: "2024-10-24", shift: "st_day_01", zone: "Zone Red (Charge)", status: "assigned" },
    { day: "2024-10-25", shift: "st_day_01", zone: "Zone Red (Resus)", status: "assigned" },
  ];

  // 2. Nurse Marcus Vance (emp_01)
  const vanceSchedule = [
    { day: "2024-10-21", shift: "st_eve_02", zone: "Trauma Bay 1", status: "completed" },
    { day: "2024-10-22", shift: "st_eve_02", zone: "Trauma Bay 1", status: "completed" },
    { day: "2024-10-24", shift: "st_ngt_03", zone: "Acute Trauma ICU", status: "assigned" },
    { day: "2024-10-25", shift: "st_ngt_03", zone: "Acute Trauma ICU", status: "assigned", conflict: true, reason: "Rest Interval < 11h following back-to-back turnaround" },
    { day: "2024-10-27", shift: "st_eve_02", zone: "Trauma Bay 2", status: "assigned" },
  ];

  // 3. Nurse Elena Rostova (emp_08/emp_02)
  const rostovaSchedule = [
    { day: "2024-10-21", shift: "st_day_01", zone: "ICU Pod B", status: "completed" },
    { day: "2024-10-22", shift: "st_day_01", zone: "ICU Pod B", status: "completed" },
    { day: "2024-10-23", shift: "st_day_01", zone: "ICU Pod B", status: "completed" },
    { day: "2024-10-24", shift: "st_day_01", zone: "Charge ICU", status: "assigned" },
  ];

  // 4. Dr. Julian Hayes (emp_09)
  const hayesSchedule = [
    { day: "2024-10-21", shift: "st_oc_05", zone: "Emergency Surgery Suite", status: "completed" },
    { day: "2024-10-22", shift: "st_eve_02", zone: "Trauma OR 3", status: "completed" },
    { day: "2024-10-23", shift: "st_eve_02", zone: "Trauma OR 3", status: "completed" },
    { day: "2024-10-24", shift: "st_eve_02", zone: "Surg Lead", status: "assigned" },
    { day: "2024-10-26", shift: "st_day_01", zone: "OR 1 On-Call", status: "assigned" },
  ];

  // 5. Nurse Sarah Lin (emp_10)
  const linSchedule = [
    { day: "2024-10-22", shift: "st_ngt_03", zone: "ICU Critical", status: "completed" },
    { day: "2024-10-23", shift: "st_ngt_03", zone: "ICU Critical", status: "completed" },
    { day: "2024-10-25", shift: "st_ngt_03", zone: "ICU Critical", status: "assigned" },
  ];

  // 6. Tech David Miller (emp_11)
  const millerSchedule = [
    { day: "2024-10-21", shift: "st_trg_04", zone: "Main ER Intake", status: "completed" },
    { day: "2024-10-22", shift: "st_trg_04", zone: "Main ER Intake", status: "completed" },
    { day: "2024-10-23", shift: "st_trg_04", zone: "Ambulance Bay", status: "completed" },
    { day: "2024-10-24", shift: "st_trg_04", zone: "Main ER Intake", status: "assigned" },
    { day: "2024-10-25", shift: "st_trg_04", zone: "Main ER Intake", status: "assigned" },
  ];

  // 7. Nurse Priya Sharma (emp_12)
  const sharmaSchedule = [
    { day: "2024-10-21", shift: "st_day_01", zone: "Peds Trauma", status: "completed" },
    { day: "2024-10-26", shift: "st_day_01", zone: "Peds ER Lead", status: "assigned" },
    { day: "2024-10-27", shift: "st_day_01", zone: "Peds ER Lead", status: "assigned" },
  ];

  // 8. Nurse Carlos Mendez (emp_13)
  const mendezSchedule = [
    { day: "2024-10-21", shift: "st_eve_02", zone: "Acute Zone", status: "completed" },
    { day: "2024-10-22", shift: "st_eve_02", zone: "Acute Zone", status: "completed" },
    { day: "2024-10-24", shift: "st_day_01", zone: "FastTrack ER", status: "assigned" },
    { day: "2024-10-25", shift: "st_day_01", zone: "FastTrack ER", status: "assigned" },
  ];

  // 9. Dr. Tariq Mansoor (emp_14)
  const mansoorSchedule = [
    { day: "2024-10-21", shift: "st_ngt_03", zone: "Trauma Bay Red", status: "completed" },
    { day: "2024-10-22", shift: "st_ngt_03", zone: "Trauma Bay Red", status: "completed" },
    { day: "2024-10-25", shift: "st_day_01", zone: "Surg Consults", status: "assigned" },
    { day: "2024-10-26", shift: "st_day_01", zone: "Surg Consults", status: "assigned" },
    { day: "2024-10-27", shift: "st_day_01", zone: "Surg Consults", status: "assigned" },
  ];

  // Helper to add custom list
  let assignCounter = 1000;
  function addPreset(empId: string, list: Array<any>) {
    list.forEach((item) => {
      assignCounter++;
      const st = shiftTypes.find((s) => s.id === item.shift) || shiftTypes[0];
      const startAt = new Date(`${item.day}T${st.startTime}:00Z`);
      let endAt = new Date(`${item.day}T${st.endTime}:00Z`);
      if (st.crossesMidnight) {
        endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
      }
      shiftAssignments.push({
        id: `asg_${assignCounter}`,
        employeeId: empId,
        shiftTypeId: st.id,
        date: item.day,
        startAt,
        endAt,
        scheduledBreakMinutes: st.breakDurationMinutes,
        status: item.status || "assigned",
        actualStartAt: item.status === "completed" ? startAt : null,
        actualEndAt: item.status === "completed" ? endAt : null,
        wardZone: item.zone || "Zone 1: Resuscitation",
        stationRole: "Clinical Duty",
        notes: item.conflict ? item.reason : "Standard cycle schedule",
        handoverNotes: item.status === "completed" ? "Shift signed off cleanly." : null,
        conflictFlag: !!item.conflict,
        conflictReason: item.reason || null,
        createdBy: "Dr. Sarah Jenkins",
        updatedBy: null,
        createdAt: new Date("2024-10-01T08:00:00Z"),
        updatedAt: new Date("2024-10-24T08:00:00Z"),
      });
    });
  }

  addPreset("emp_01", vanceSchedule);
  addPreset("emp_02", watsonSchedule);
  addPreset("emp_08", rostovaSchedule);
  addPreset("emp_09", hayesSchedule);
  addPreset("emp_10", linSchedule);
  addPreset("emp_11", millerSchedule);
  addPreset("emp_12", sharmaSchedule);
  addPreset("emp_13", mendezSchedule);
  addPreset("emp_14", mansoorSchedule);

  // Now seed systematic rosters for all other active employees across Oct 1 - Oct 31, 2024
  // To reach exactly the realistic stats:
  // - Completed MTD: 1,142
  // - Active Staff: 68
  // - Daily counts for week 43 matching: Mon: 32, Tue: 34, Wed: 31, Thu: 34, Fri: 29 (shortage), Sat: 28, Sun: 28
  const otherEmps = employees.filter((e) => e.active && !["emp_01", "emp_02", "emp_08", "emp_09", "emp_10", "emp_11", "emp_12", "emp_13", "emp_14"].includes(e.id));
  
  // Create shifts for all other employees
  otherEmps.forEach((emp, index) => {
    // 4 ON, 2 OFF cycle pattern
    for (let dayNum = 1; dayNum <= 31; dayNum++) {
      const dateStr = `2024-10-${dayNum < 10 ? "0" + dayNum : dayNum}`;
      const cycleIndex = (dayNum + index) % 6;
      if (cycleIndex < 4) {
        // Working day
        let chosenShift = shiftTypes[0]; // Day
        if (cycleIndex === 1 || cycleIndex === 2) chosenShift = shiftTypes[1]; // Evening
        if (cycleIndex === 3 && index % 3 === 0) chosenShift = shiftTypes[2]; // Night
        if (index % 4 === 0 && cycleIndex === 0) chosenShift = shiftTypes[3]; // Triage

        // Check if day is prior to today (Oct 24)
        const isPast = dayNum < 24;
        const status = isPast ? "completed" : "assigned";

        // Skip Oct 25 for 1-2 nurses to simulate the Friday deficit (-1 RN in Trauma bay)
        if (dayNum === 25 && index % 11 === 0) {
          continue;
        }

        assignCounter++;
        const startAt = new Date(`${dateStr}T${chosenShift.startTime}:00Z`);
        let endAt = new Date(`${dateStr}T${chosenShift.endTime}:00Z`);
        if (chosenShift.crossesMidnight) {
          endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
        }

        shiftAssignments.push({
          id: `asg_${assignCounter}`,
          employeeId: emp.id,
          shiftTypeId: chosenShift.id,
          date: dateStr,
          startAt,
          endAt,
          scheduledBreakMinutes: chosenShift.breakDurationMinutes,
          status,
          actualStartAt: isPast ? startAt : null,
          actualEndAt: isPast ? endAt : null,
          wardZone: emp.unit,
          stationRole: emp.designation,
          notes: null,
          handoverNotes: isPast ? "Cycle shift completed without incidents." : null,
          conflictFlag: false,
          conflictReason: null,
          createdBy: "System Roster Engine",
          updatedBy: null,
          createdAt: new Date("2024-10-01T08:00:00Z"),
          updatedAt: new Date("2024-10-24T08:00:00Z"),
        });
      }
    }
  });

  // Leave records (matching Image 1 & Image 9)
  const leaveRecords = [
    {
      id: "lv_rec_01",
      employeeId: "emp_07", // Dr. Marcus Thorne
      leaveTypeId: "lt_sick",
      startDate: "2024-10-27",
      endDate: "2024-10-28",
      durationDays: "2.0",
      reason: "Acute Medical / Sick Leave (Form 14-B) Emergency Hospitalization",
      status: "approved",
      replacementEmployeeId: null, // Unassigned Deficit!
      replacementStatus: "unassigned",
      recordedBy: "Dr. Sarah Jenkins",
      reviewedBy: "Dr. Sarah Jenkins",
      reviewedAt: new Date("2024-10-24T09:00:00Z"),
      notes: "URGENT COVERAGE DEFICIT: Uncovered night shift Oct 27 in Trauma Bay 2.",
      createdAt: new Date("2024-10-24T09:00:00Z"),
      updatedAt: new Date("2024-10-24T09:00:00Z"),
    },
    {
      id: "lv_rec_02",
      employeeId: "emp_08", // Nurse Clara Diaz
      leaveTypeId: "lt_cme",
      startDate: "2024-10-25",
      endDate: "2024-10-28",
      durationDays: "4.0",
      reason: "Emergency Nursing Triage Summit & National Conference",
      status: "pending",
      replacementEmployeeId: "emp_20", // Dr. K. Patel
      replacementStatus: "assigned",
      recordedBy: "Nurse Clara Diaz",
      reviewedBy: null,
      reviewedAt: null,
      notes: "Pending Sign-off: Peer replacement nominated Dr. K. Patel (RN-Sup)",
      createdAt: new Date("2024-10-23T14:30:00Z"),
      updatedAt: new Date("2024-10-23T14:30:00Z"),
    },
    {
      id: "lv_rec_03",
      employeeId: "emp_02", // Dr. Elena Rostova
      leaveTypeId: "lt_annual",
      startDate: "2024-11-02",
      endDate: "2024-11-09",
      durationDays: "7.0",
      reason: "Annual Paid Vacation (Standard Pre-Scheduled PTO)",
      status: "approved",
      replacementEmployeeId: "emp_09", // Dr. Julian Hayes
      replacementStatus: "assigned",
      recordedBy: "Dr. Sarah Jenkins",
      reviewedBy: "Dr. Sarah Jenkins",
      reviewedAt: new Date("2024-10-20T11:00:00Z"),
      notes: "Approved and substitute physician confirmed.",
      createdAt: new Date("2024-10-18T10:00:00Z"),
      updatedAt: new Date("2024-10-20T11:00:00Z"),
    },
    {
      id: "lv_rec_04",
      employeeId: "emp_03", // James / Liam Chen
      leaveTypeId: "lt_casual",
      startDate: "2024-10-29",
      endDate: "2024-10-29",
      durationDays: "1.0",
      reason: "Family Care Emergency Personal Day",
      status: "pending",
      replacementEmployeeId: "emp_38", // EMT T. O'Connor
      replacementStatus: "assigned",
      recordedBy: "Liam Chen",
      reviewedBy: null,
      reviewedAt: null,
      notes: "Pending manager sign-off.",
      createdAt: new Date("2024-10-24T08:15:00Z"),
      updatedAt: new Date("2024-10-24T08:15:00Z"),
    },
    {
      id: "lv_rec_05",
      employeeId: "emp_12", // Nurse Priya Sharma
      leaveTypeId: "lt_sick",
      startDate: "2024-10-23",
      endDate: "2024-10-24",
      durationDays: "2.0",
      reason: "Acute respiratory illness with medical cert filed",
      status: "approved",
      replacementEmployeeId: "emp_21", // Nurse David Chen
      replacementStatus: "assigned",
      recordedBy: "Dr. Sarah Jenkins",
      reviewedBy: "Dr. Sarah Jenkins",
      reviewedAt: new Date("2024-10-23T08:00:00Z"),
      notes: "Covered by float pool nurse David Chen.",
      createdAt: new Date("2024-10-23T07:30:00Z"),
      updatedAt: new Date("2024-10-23T08:00:00Z"),
    },
  ];

  // Leave adjustments
  const leaveAdjustments = [
    {
      id: "ladj_01",
      employeeId: "emp_01",
      leaveTypeId: "lt_annual",
      amount: "2.0",
      reason: "Overtime compensation converted to additional annual leave days",
      createdBy: "Dr. Sarah Jenkins",
      createdAt: new Date("2024-10-01T08:00:00Z"),
    },
    {
      id: "ladj_02",
      employeeId: "emp_08",
      leaveTypeId: "lt_cme",
      amount: "1.0",
      reason: "Clinical teaching fellowship quota credit",
      createdBy: "Dr. Sarah Jenkins",
      createdAt: new Date("2024-10-05T08:00:00Z"),
    },
  ];

  // Scheduled Rotational Off-Days (Separate from leave records!)
  // ~184 Days MTD
  const offDays: Array<any> = [];
  let offDayId = 100;
  employees.forEach((emp, eIdx) => {
    // 2 off-days per week for each employee
    for (let day = 1; day <= 31; day++) {
      if ((day + eIdx) % 7 === 5 || (day + eIdx) % 7 === 6) {
        offDayId++;
        offDays.push({
          id: `off_${offDayId}`,
          employeeId: emp.id,
          date: `2024-10-${day < 10 ? "0" + day : day}`,
          reason: "Rotational Rest Roster (Mandatory 48h Safe Cycle)",
          notes: "Non-deductible from leave balance; regulated by AMA maximum fatigue safety directives.",
          recordedBy: "System Roster Engine",
          createdAt: new Date("2024-10-01T00:00:00Z"),
        });
      }
    }
  });

  const departmentSettings = {
    id: "dept_set_402",
    departmentCode: "DEPT-402",
    departmentName: "Emergency & Trauma Department (ED-Critical Care Node)",
    weeklyHoursCap: 48,
    warningHoursCap: 40,
    consecutiveShiftsCap: 5,
    minRestHoursBetweenShifts: 11,
    rosterLockHoursAhead: 72,
    nurseToBedRatioTarget: "1 : 3.2 (Compliant)",
    // Scheduling-engine knobs — ONE stored value read everywhere
    timezone: "America/Chicago",
    weekStartDay: 1,
    maxNightsPerMonth: 7,
    maxWeeklyHoursSeverity: "warn",
    maxNightsSeverity: "warn",
    pendingLeaveAction: "warn",
    enforceRestInterval: true,
    autoAssignEnabled: true,
    autoAssignTimeBudgetMs: 2000,
    updatedBy: "Dr. Sarah Jenkins, RN, MSN",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-10-24T00:00:00Z"),
  };

  const auditLogs = [
    {
      id: "aud_01",
      actorUserId: "usr_jenkins_001",
      actorName: "Dr. Sarah Jenkins (Superuser)",
      action: "SHIFT_ASSIGNED",
      entityType: "shift_assignment",
      entityId: "asg_vance_ngt_24",
      details: "Assigned Marcus Vance to Night ICU Shift on Oct 24, 2024",
      previousValues: null,
      newValues: { employee: "Marcus Vance", shift: "Overnight ICU", date: "2024-10-24" },
      createdAt: new Date("2024-10-24T13:50:00Z"),
    },
    {
      id: "aud_02",
      actorUserId: "usr_jenkins_001",
      actorName: "Dr. Sarah Jenkins (Superuser)",
      action: "LEAVE_APPROVED",
      entityType: "leave_record",
      entityId: "lv_rec_03",
      details: "Approved Annual Leave for Dr. Elena Rostova (7 Days, Nov 02–09)",
      previousValues: { status: "pending" },
      newValues: { status: "approved", substitute: "Dr. Julian Hayes" },
      createdAt: new Date("2024-10-24T12:00:00Z"),
    },
    {
      id: "aud_03",
      actorUserId: "usr_jenkins_001",
      actorName: "Dr. Sarah Jenkins (Superuser)",
      action: "SHIFT_TYPE_MODIFIED",
      entityType: "shift_type",
      entityId: "st_ngt_03",
      details: "Modified 'Overnight ICU / Trauma' baseline minimum staff from 5 to 6 RNs",
      previousValues: { minimumStaffRn: 5 },
      newValues: { minimumStaffRn: 6 },
      createdAt: new Date("2024-10-23T16:40:00Z"),
    },
    {
      id: "aud_04",
      actorUserId: "usr_jenkins_001",
      actorName: "Dr. Sarah Jenkins (Superuser)",
      action: "GUARDRAILS_UPDATED",
      entityType: "department_settings",
      entityId: "dept_set_402",
      details: "Enforced mandatory 11h rest-interval between turnaround shifts per OSHA directive",
      previousValues: { minRestHoursBetweenShifts: 10 },
      newValues: { minRestHoursBetweenShifts: 11 },
      createdAt: new Date("2024-10-22T09:15:00Z"),
    },
    {
      id: "aud_05",
      actorUserId: "usr_jenkins_001",
      actorName: "Dr. Sarah Jenkins (Superuser)",
      action: "DEFICIT_FLAGGED",
      entityType: "shift_assignment",
      entityId: "lv_rec_01",
      details: "Flagged acute coverage deficit for Dr. Marcus Thorne (Oct 27 Night Shift)",
      previousValues: null,
      newValues: { status: "CRITICAL", alert: "Unassigned physician coverage" },
      createdAt: new Date("2024-10-24T09:05:00Z"),
    },
  ];

  // Per shift-type × designation staffing policy. The scheduling engine,
  // roster coverage footer, dashboard and auto-assign all read THIS.
  const shiftRequirements = [
    { id: "sreq_d_rn", shiftTypeId: "st_day_01", designation: "RN", minStaff: 12, maxStaff: 18 },
    { id: "sreq_d_md", shiftTypeId: "st_day_01", designation: "MD", minStaff: 3, maxStaff: 6 },
    { id: "sreq_e_rn", shiftTypeId: "st_eve_02", designation: "RN", minStaff: 8, maxStaff: 14 },
    { id: "sreq_e_md", shiftTypeId: "st_eve_02", designation: "MD", minStaff: 2, maxStaff: 5 },
    { id: "sreq_n_rn", shiftTypeId: "st_ngt_03", designation: "RN", minStaff: 6, maxStaff: 10 },
    { id: "sreq_n_md", shiftTypeId: "st_ngt_03", designation: "MD", minStaff: 2, maxStaff: 4 },
    { id: "sreq_n_tech", shiftTypeId: "st_ngt_03", designation: "Tech", minStaff: 2, maxStaff: 4 },
    { id: "sreq_tr_any", shiftTypeId: "st_trg_04", designation: "any", minStaff: 4, maxStaff: 7 },
  ];

  return {
    users,
    permissions,
    employees,
    shiftTypes,
    shiftAssignments,
    leaveTypes,
    leavePolicies,
    leaveRecords,
    leaveAdjustments,
    offDays,
    departmentSettings,
    auditLogs,
    shiftRequirements,
  };
}
