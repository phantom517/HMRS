import type { AuthenticatedUser } from "@/lib/auth/session";
import { cycleToday } from "@/lib/schedule-cycle";
import type { buildDepartmentContext } from "@/lib/services/assistant/deptContext";
type DeptContext = Awaited<ReturnType<typeof buildDepartmentContext>>;

// ---------------------------------------------------------------------------
// Offline fallback replies when no GEMINI_API_KEY is configured
// ---------------------------------------------------------------------------

export async function buildFallbackReply(params: {
    user: AuthenticatedUser;
    contextSummary: DeptContext;
    weekLabel: string;
    startDate: string;
    endDate: string;
    message: string;
}): Promise<string> {
    const { user, contextSummary, weekLabel, startDate, endDate } = params;
    const queryLower = params.message.toLowerCase();
    let fallbackReply = "";

        if (
            queryLower.includes("night") ||
            queryLower.includes("tonight") ||
            queryLower.includes("who is working")
        ) {
            const today = cycleToday();
            const todayShifts = contextSummary.currentWeekRoster.filter(
                (r) => r.date === today,
            );
            const nightShiftType = contextSummary.shiftTypes.find(
                (s) => s.code === "N" || s.name.toLowerCase().includes("night"),
            );
            const nightStaffIds = todayShifts
                .filter((s) => s.shiftTypeId === nightShiftType?.id)
                .map((s) => s.employeeId);
            const nightStaff = contextSummary.employees.filter((e) =>
                nightStaffIds.includes(e.id),
            );

            fallbackReply =
                `### Night Shift Coverage for Today (${today})\n\n` +
                (nightStaff.length > 0
                    ? `Currently **${nightStaff.length} staff member(s)** assigned to Night Shift (${nightShiftType?.time || "23:00 - 07:30"}):\n\n` +
                      nightStaff
                          .map(
                              (s) =>
                                  `- **${s.name}** (${s.code}) — *${s.designation}* [${s.unit}]`,
                          )
                          .join("\n")
                    : `No staff currently assigned to the Night shift for today (${today}). Minimum required RNs: ${nightShiftType?.minRN ?? 4}, MDs: ${nightShiftType?.minMD ?? 2}.`);
        } else if (
            queryLower.includes("gap") ||
            queryLower.includes("shortage") ||
            queryLower.includes("coverage")
        ) {
            fallbackReply =
                `### Clinical Roster Coverage Summary (${weekLabel})\n\n` +
                `- **Total Active Employees:** ${contextSummary.employees.length} clinicians\n` +
                `- **Active Shift Types:** ${contextSummary.shiftTypes.length} operational shifts (Day, Evening, Night, Trauma)\n` +
                `- **Weekly Hours Guardrail:** Max ${contextSummary.guardrails.weeklyHoursCap} hours/week\n` +
                `- **Fatigue Rest Interval:** Minimum ${contextSummary.guardrails.minRestHoursBetweenShifts}h rest required between shifts\n` +
                `- **Consecutive Shifts Cap:** Max ${contextSummary.guardrails.consecutiveShiftsCap} consecutive shifts\n\n` +
                `*Tip: Use the 'Smart Fill' engine or ask the Assistant to automatically resolve uncovered slots.*`;
        } else if (queryLower.includes("leave") || queryLower.includes("off")) {
            const leaves = contextSummary.leaves || [];
            fallbackReply =
                `### Department Leave & Off-Duty Status\n\n` +
                (leaves.length > 0
                    ? `There are **${leaves.length} leave record(s)** logged for this period:\n\n` +
                      leaves
                          .slice(0, 5)
                          .map((l) => {
                              const emp = contextSummary.employees.find(
                                  (e) => e.id === l.employeeId,
                              );
                              return `- **${emp?.name || l.employeeId}** (${emp?.code || ""}): ${l.from} → ${l.to} [Status: **${l.status.toUpperCase()}**]`;
                          })
                          .join("\n")
                    : `No active leave records registered for the current roster week.`);
        } else {
            fallbackReply =
                `### Patan Academy Clinical Assistant (DEPT-402)\n\n` +
                `Hello **${user.name}** (${user.title}). I am your context-aware hospital management assistant.\n\n` +
                `- **Roster Cycle:** ${weekLabel} (${startDate} to ${endDate})\n` +
                `- **Department Staff:** ${contextSummary.employees.length} active clinical personnel\n` +
                `- **Shifts Registered:** ${contextSummary.shiftTypes.map((s) => s.code).join(", ")}\n` +
                `- **Fatigue Rules:** 11h minimum rest, ${contextSummary.guardrails.weeklyHoursCap}h weekly cap\n\n` +
                `You can ask me about shift coverage, staff availability, fatigue warnings, and leave approvals.`;
        }

    return fallbackReply;
}
