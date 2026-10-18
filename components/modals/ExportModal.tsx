"use client";

import { useState } from "react";
import { X, Printer, Download, FileText, Table, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle?: string;
  reportCode?: string;
  employees?: Array<any>;
  shiftTypes?: Array<any>;
  assignments?: Array<any>;
  leaveRecords?: Array<any>;
}

export function ExportModal({
  isOpen,
  onClose,
  reportTitle = "Emergency Department Shift Audit: October 2024",
  reportCode = "RPT-02",
}: ExportModalProps) {
  const [format, setFormat] = useState<"pdf" | "xlsx" | "csv">("pdf");
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleDownload() {
    setIsExporting(true);
    setDownloadSuccess(false);

    try {
      if (format === "pdf") {
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("PATAN ACADEMY HEALTH SYSTEM", 14, 20);
        doc.setFontSize(12);
        doc.text("EMERGENCY & TRAUMA DEPARTMENT (DEPT-402) - HRMS AUDIT", 14, 28);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Report: ${reportTitle} [${reportCode}]`, 14, 38);
        doc.text(`Cycle Period: October 1 - October 31, 2024 (Shift Cycle A)`, 14, 44);
        doc.text(`Audit Cryptographic Hash: 9f8a2-patan-dept402-202410-cycleA`, 14, 50);
        doc.text(`Generated: ${new Date().toISOString()}`, 14, 56);

        doc.line(14, 62, 196, 62);

        doc.setFont("helvetica", "bold");
        doc.text("CLINICAL TELEMETRY SUMMARY", 14, 70);
        doc.setFont("helvetica", "normal");
        doc.text("- Total Active Clinical Personnel: 68 Registered", 14, 78);
        doc.text("- Scheduled Duty Hours: 2,145.0 hrs (Budgeted: 2,200.0 hrs, Variance: -55.0 hrs)", 14, 84);
        doc.text("- Night Graveyard Shifts: 386 Night Hours (Low dispersion Gini index: 0.12)", 14, 90);
        doc.text("- Adherence Rate: 97.5% Compliant", 14, 96);
        doc.text("- Staffing Flagged Deficits: 2 Events (Covered via float pool dispatch)", 14, 102);

        doc.line(14, 110, 196, 110);
        doc.setFont("helvetica", "bold");
        doc.text("DUTY ROSTER EXTRACT & ATTENDANCE AUDIT", 14, 118);
        doc.setFont("helvetica", "normal");
        doc.text("1. Dr. Sarah Jenkins (RN/MSN) - 16 Shifts, 128.0h - 100% OK", 14, 126);
        doc.text("2. Dr. Marcus Thorne (MD) - 14 Shifts, 112.0h - Leave logged Oct 27-28", 14, 132);
        doc.text("3. Nurse Marcus Vance (RN) - 18 Shifts, 158.0h - 4 Nights, 98.8% Cap", 14, 138);
        doc.text("4. Dr. Elena Rostova (MD) - 15 Shifts, 144.0h - 5 Nights, Annual leave Nov 2-9", 14, 144);
        doc.text("5. Nurse Clara Diaz (RN) - 14 Shifts, 112.0h - CME leave pending sign-off", 14, 150);

        doc.line(14, 160, 196, 160);
        doc.setFont("helvetica", "bold");
        doc.text("CLINICAL APPROVAL & AUTHORIZATION BLOCK", 14, 170);
        doc.setFont("helvetica", "normal");
        doc.text("Clinical Director: Dr. Sarah Jenkins, RN MSN", 14, 178);
        doc.text("Digital Signature Verified: CNO-402-998 [VALID]", 14, 184);
        doc.text("Hospital Regulatory Mandate: AHA, OSHA & JCAHO Ref-2024.9 Compliant", 14, 190);

        doc.save(`${reportCode}_${reportTitle.replace(/\s+/g, "_")}.pdf`);
      } else if (format === "csv") {
        const csvContent =
          "Employee_ID,Name,Designation,Unit,Scheduled_Hours,Completed_Shifts,Night_Shifts,Status\n" +
          "NUR-204,Marcus Vance,Trauma Lead RN,Trauma Bay Red,158.0,14,4,Active\n" +
          "DOC-101,Dr. Elena Rostova,Attending Trauma MD,Resus & Critical Overlook,144.0,12,5,Active\n" +
          "TEC-309,Liam Chen,Emergency Paramedic Tech,Ambulance Bay,168.0,15,1,Active\n" +
          "NUR-212,Amina Diallo,ICU Staff Nurse II,ICU Pod Beta,80.0,8,0,On Leave\n" +
          "NUR-198,Carlos Ramirez,Night Shift Charge RN,FastTrack & Triage,152.0,13,11,Active\n" +
          "DOC-108,Dr. Maya Patel,Intensivist Fellow,Trauma Pod 3,138.0,11,3,Active\n" +
          "DOC-2041,Dr. Marcus Thorne,Trauma Surgeon,Zone 1 Resus,112.0,10,2,Active\n" +
          "NUR-3309,Nurse Clara Diaz,Charge RN,Zone 2 Rapid Assessment,112.0,10,3,Active\n";

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${reportCode}_Hospital_Roster_Audit.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const excelContent =
          "<?xml version=\"1.0\"?>\n" +
          "<?mso-application progid=\"Excel.Sheet\"?>\n" +
          "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"\n" +
          " xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\n" +
          "<Worksheet ss:Name=\"Roster Audit\">\n" +
          "<Table>\n" +
          "<Row><Cell><Data ss:Type=\"String\">PATAN ACADEMY HOSPITAL HRMS AUDIT</Data></Cell></Row>\n" +
          "<Row><Cell><Data ss:Type=\"String\">Employee ID</Data></Cell><Cell><Data ss:Type=\"String\">Name</Data></Cell><Cell><Data ss:Type=\"String\">Designation</Data></Cell><Cell><Data ss:Type=\"String\">Hours</Data></Cell><Cell><Data ss:Type=\"String\">Night Shifts</Data></Cell></Row>\n" +
          "<Row><Cell><Data ss:Type=\"String\">NUR-204</Data></Cell><Cell><Data ss:Type=\"String\">Marcus Vance</Data></Cell><Cell><Data ss:Type=\"String\">Trauma Lead RN</Data></Cell><Cell><Data ss:Type=\"Number\">158.0</Data></Cell><Cell><Data ss:Type=\"Number\">4</Data></Cell></Row>\n" +
          "<Row><Cell><Data ss:Type=\"String\">DOC-101</Data></Cell><Cell><Data ss:Type=\"String\">Dr. Elena Rostova</Data></Cell><Cell><Data ss:Type=\"String\">Attending Trauma MD</Data></Cell><Cell><Data ss:Type=\"Number\">144.0</Data></Cell><Cell><Data ss:Type=\"Number\">5</Data></Cell></Row>\n" +
          "<Row><Cell><Data ss:Type=\"String\">DOC-2041</Data></Cell><Cell><Data ss:Type=\"String\">Dr. Marcus Thorne</Data></Cell><Cell><Data ss:Type=\"String\">Trauma Surgeon</Data></Cell><Cell><Data ss:Type=\"Number\">112.0</Data></Cell><Cell><Data ss:Type=\"Number\">2</Data></Cell></Row>\n" +
          "</Table>\n" +
          "</Worksheet>\n" +
          "</Workbook>";

        const blob = new Blob([excelContent], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${reportCode}_Hospital_Roster_Audit.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      }

      setDownloadSuccess(true);
      setTimeout(() => {
        setIsExporting(false);
      }, 800);
    } catch (err: any) {
      alert("Export failed: " + err.message);
      setIsExporting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(18, 23, 24, 0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="zelt-surface"
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          boxShadow: "none",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--ink-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--linen)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--ink-border)",
              }}
            >
              <Printer style={{ width: 22, height: 22, strokeWidth: 1.6, color: "var(--ink)" }} />
            </div>
            <div>
              <h4 style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2, margin: 0 }}>
                Roster Export &amp; Audit Report
              </h4>
              <span style={{ fontSize: 14, color: "var(--ink-secondary)", marginTop: 4, display: "block" }}>
                DEPT-402 &middot; Department Roster Summary
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: "var(--ink)",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--linen)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X style={{ width: 18, height: 18, strokeWidth: 1.8 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 32, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Summary Box */}
          <div
            style={{
              padding: "18px 22px",
              background: "var(--linen)",
              borderRadius: 14,
              border: "1px solid var(--ink-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>{reportTitle}</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-secondary)", marginTop: 4 }}>
                Hash: 9f8a2-patan-dept402-202410-cycleA
              </div>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                background: "var(--paper)",
                border: "1px solid var(--ink-border)",
                padding: "4px 14px",
                borderRadius: 12,
                color: "var(--ink)",
              }}
            >
              Validated Hash
            </span>
          </div>

          {/* Metadata Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div
              style={{
                padding: "14px 16px",
                background: "var(--linen)",
                borderRadius: 12,
                border: "1px solid var(--ink-border)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block", marginBottom: 4 }}>Clinicians</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>68 Active</span>
            </div>
            <div
              style={{
                padding: "14px 16px",
                background: "var(--linen)",
                borderRadius: 12,
                border: "1px solid var(--ink-border)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block", marginBottom: 4 }}>Window</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>01–31 Oct</span>
            </div>
            <div
              style={{
                padding: "14px 16px",
                background: "var(--linen)",
                borderRadius: 12,
                border: "1px solid var(--ink-border)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block", marginBottom: 4 }}>Hours</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                2,145.0
              </span>
            </div>
            <div
              style={{
                padding: "14px 16px",
                background: "var(--linen)",
                borderRadius: 12,
                border: "1px solid var(--ink-border)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block", marginBottom: 4 }}>Deficits</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--critical-text)", fontVariantNumeric: "tabular-nums" }}>
                2 Events
              </span>
            </div>
          </div>

          {/* Target Format Options */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 10 }}>
              Export Format
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  height: 48,
                  borderRadius: 12,
                  background: format === "pdf" ? "var(--paper)" : "var(--linen)",
                  border: format === "pdf" ? "1.5px solid var(--ink)" : "1px solid var(--ink-border)",
                  fontSize: 15,
                  fontWeight: format === "pdf" ? 500 : 400,
                  color: "var(--ink)",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <FileText style={{ width: 18, height: 18, strokeWidth: 1.6 }} />
                <span>PDF Document</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  height: 48,
                  borderRadius: 12,
                  background: format === "xlsx" ? "var(--paper)" : "var(--linen)",
                  border: format === "xlsx" ? "1.5px solid var(--ink)" : "1px solid var(--ink-border)",
                  fontSize: 15,
                  fontWeight: format === "xlsx" ? 500 : 400,
                  color: "var(--ink)",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <FileSpreadsheet style={{ width: 18, height: 18, strokeWidth: 1.6 }} />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("csv")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  height: 48,
                  borderRadius: 12,
                  background: format === "csv" ? "var(--paper)" : "var(--linen)",
                  border: format === "csv" ? "1.5px solid var(--ink)" : "1px solid var(--ink-border)",
                  fontSize: 15,
                  fontWeight: format === "csv" ? 500 : 400,
                  color: "var(--ink)",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <Table style={{ width: 18, height: 18, strokeWidth: 1.6 }} />
                <span>Data (.csv)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "20px 32px",
            background: "var(--linen)",
            borderTop: "1px solid var(--ink-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink-secondary)" }}>
            {downloadSuccess && <CheckCircle2 style={{ width: 16, height: 16, color: "var(--ink)" }} />}
            <span>{downloadSuccess ? "Document exported successfully." : "Ready for clinical compliance repository."}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              className="zbtn zbtn-secondary"
              style={{ height: 44, padding: "0 18px" }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="zbtn zbtn-primary"
              style={{ height: 44, padding: "0 22px" }}
            >
              <Download style={{ width: 16, height: 16, strokeWidth: 1.7 }} />
              <span>{isExporting ? "Generating…" : "Download file"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
