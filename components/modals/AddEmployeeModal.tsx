"use client";

import { useState } from "react";
import { X, UserPlus, CheckCircle2, AlertTriangle, Stethoscope, Mail, Phone, Calendar, Hash, Building2 } from "lucide-react";
import { createEmployeeAction } from "@/lib/actions/employees";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DESIGNATION_OPTIONS = [
  { value: "Emergency Attending Physician", label: "Emergency Attending Physician", sublabel: "MD • Specialist" },
  { value: "Senior Trauma Surgeon", label: "Senior Trauma Surgeon", sublabel: "MD • Surgical Team" },
  { value: "Critical Care Anesthesiologist", label: "Critical Care Anesthesiologist", sublabel: "MD • Anesthesia" },
  { value: "Staff Critical Care RN", label: "Staff Critical Care RN", sublabel: "RN • Intensive & Resus" },
  { value: "Emergency Staff Nurse", label: "Emergency Staff Nurse", sublabel: "RN • General & Acute" },
  { value: "Pediatric Emergency Nurse", label: "Pediatric Emergency Nurse", sublabel: "RN • Peds ER" },
  { value: "Senior Resuscitation Specialist", label: "Senior Resuscitation Specialist", sublabel: "RN/MD • Resus Lead" },
  { value: "Critical Care Paramedic / EMT-P", label: "Critical Care Paramedic / EMT-P", sublabel: "Tech • Transport & Trauma" },
  { value: "Emergency Medical Technician", label: "Emergency Medical Technician", sublabel: "Tech • Acute Support" },
  { value: "Trauma Surgical Technologist", label: "Trauma Surgical Technologist", sublabel: "Tech • OR & Trauma Bay" },
];

const UNIT_OPTIONS = [
  { value: "Emergency & Trauma", label: "Emergency & Trauma", sublabel: "Main ER Core & Red Zone" },
  { value: "Pediatric Emergency", label: "Pediatric Emergency", sublabel: "Peds Acute & Observ." },
  { value: "Trauma Resuscitation (Red Zone)", label: "Trauma Resuscitation (Red Zone)", sublabel: "Critical Bays 1-4" },
  { value: "Observation & Short Stay", label: "Observation & Short Stay", sublabel: "Yellow Zone / 24h" },
  { value: "Fast Track / Ambulatory", label: "Fast Track / Ambulatory", sublabel: "Green Zone / Minor" },
  { value: "Critical Care Transport", label: "Critical Care Transport", sublabel: "Prehospital & Transfer" },
];

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState(DESIGNATION_OPTIONS[3].value);
  const [unit, setUnit] = useState(UNIT_OPTIONS[0].value);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateJoined, setDateJoined] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!fullName.trim()) throw new Error("Please enter clinician full name.");
      if (!employeeId.trim()) throw new Error("Please specify employee badge code.");
      if (!email.trim()) throw new Error("Please enter hospital email address.");

      await createEmployeeAction({
        employeeId: employeeId.trim().toUpperCase(),
        fullName: fullName.trim(),
        designation,
        unit,
        department: "Emergency & Critical Care",
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || "+977-1-5522295",
        dateJoined,
        employmentStatus: "active",
        notes: notes.trim() || "Added via Dashboard Quick Actions",
      });

      setSuccess(`Profile created for ${fullName.trim()} (${employeeId.trim().toUpperCase()}).`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setFullName("");
        setEmployeeId("");
        setEmail("");
        setPhoneNumber("");
        setNotes("");
        setSuccess(null);
      }, 900);
    } catch (err: any) {
      setError(err.message || "Failed to add clinical employee.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in-0 duration-150">
      <div className="w-full max-w-2xl bg-[var(--paper)] rounded-2xl border border-[var(--ink-border)] p-6 sm:p-8 shadow-2xl space-y-6 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-5 border-b border-[var(--ink-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--linen)] border border-[var(--ink-border)] flex items-center justify-center text-[var(--ink)]">
              <UserPlus className="w-5 h-5 stroke-[1.7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)] leading-tight">
                Add Clinical Employee
              </h3>
              <p className="text-xs text-[var(--ink-secondary)] mt-0.5">
                Register a new doctor, nurse, or technologist to DEPT-402 roster
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--linen)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="p-3.5 rounded-xl bg-[var(--critical-bg)] text-[var(--critical-text)] text-sm flex items-center gap-2.5 border border-red-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2.5 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* Form Body with generous spacing */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)] flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-[var(--ink-secondary)]" />
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Apekshya Shrestha"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-secondary)]/60 text-sm focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/15 outline-none transition-all"
              />
            </div>

            {/* Employee ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)] flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[var(--ink-secondary)]" />
                Badge / Employee ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. NUR-205 or PHY-108"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-secondary)]/60 text-sm focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/15 outline-none transition-all uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Clinical Designation / Role */}
            <CustomSelect
              label="Role & Clinical Designation"
              value={designation}
              onChange={setDesignation}
              options={DESIGNATION_OPTIONS}
              searchable
            />

            {/* Department Unit */}
            <CustomSelect
              label="Primary Ward / Unit"
              value={unit}
              onChange={setUnit}
              options={UNIT_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hospital Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--ink-secondary)]" />
                Hospital Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clinician@hospital.np"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-secondary)]/60 text-sm focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/15 outline-none transition-all"
              />
            </div>

            {/* Contact Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[var(--ink-secondary)]" />
                Contact Phone
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+977-98XXXXXXXX"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-secondary)]/60 text-sm focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/15 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Joined */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--ink-secondary)]" />
                Date Joined
              </label>
              <input
                type="date"
                value={dateJoined}
                onChange={(e) => setDateJoined(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] text-sm focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/15 outline-none transition-all"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">
                Admin Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional shift preferences or notes..."
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-secondary)]/60 text-sm focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/15 outline-none transition-all"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[var(--ink-border)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-[var(--ink-border)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--linen)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[var(--honey)] text-[var(--ink)] text-sm font-semibold hover:bg-[var(--honey-hover)] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? "Creating Clinician..." : "Register Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
