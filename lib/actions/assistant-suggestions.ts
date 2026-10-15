"use server";

// lib/actions/assistant-suggestions.ts — suggestion chips generated from REAL
// data and the current context: no hardcoded names, no hardcoded ISO dates.
// Week boundaries come from lib/schedule-cycle; counts from the same db reads
// the roster itself uses.
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getRosterWeek } from "@/lib/schedule-cycle";
import { loadSchedulingContext } from "@/lib/scheduling/loader";
import { coverage } from "@/lib/scheduling/rules";
import { addDaysLocal } from "@/lib/scheduling/materialize";

export interface AssistantSuggestion {
  /** The message sent when the chip is clicked. */
  prompt: string;
  label: string;
}

export async function getAssistantSuggestionsAction(): Promise<AssistantSuggestion[]> {
  const user = await getCurrentUser();
  if (user.role === "viewer") return [];

  const suggestions: AssistantSuggestion[] = [];

  // 1. Pending leave count.
  let pendingLeave = 0;
  try {
    const leaves = await db.getLeaveRecords({ status: "pending" });
    pendingLeave = leaves.length;
  } catch {
    /* leave this chip out if the data isn't there — never fake one */
  }
  if (pendingLeave > 0) {
    suggestions.push({
      label: `${pendingLeave} pending leave request${pendingLeave === 1 ? "" : "s"}`,
      prompt: `There ${pendingLeave === 1 ? "is" : "are"} ${pendingLeave} pending leave request${pendingLeave === 1 ? "" : "s"}. Summarize them for me.`,
    });
  }

  // 2. This week's coverage gaps + tonight's shortage (one context load).
  try {
    const { startDate, endDate } = getRosterWeek(0);
    const ctx = await loadSchedulingContext({ from: startDate, to: endDate });
    const cells = coverage(ctx as never, { from: startDate, to: endDate });
    const gapDates = new Set(cells.filter((c) => c.short > 0).map((c) => c.date));
    const todayShort = cells.filter((c) => c.date === startDate && c.short > 0).length;
    if (gapDates.size > 0) {
      suggestions.push({
        label: `${gapDates.size} day${gapDates.size === 1 ? "" : "s"} with coverage gaps this week`,
        prompt: "Show me this week's coverage gaps and who could fill them.",
      });
    }
    if (todayShort > 0) {
      suggestions.push({
        label: `${todayShort} shortage slot${todayShort === 1 ? "" : "s"} today`,
        prompt: "Which shifts are short-staffed today and who is available?",
      });
    }
  } catch {
    /* skip coverage chips when the engine context can't load */
  }

  // 3. Who is on leave next week.
  try {
    const [, nextWeek] = getRosterWeekPair();
    const leaves = await db.getLeaveRecords({});
    const onLeaveNextWeek = leaves.filter(
      (l) => l.status !== "rejected" && l.status !== "cancelled" && l.startDate <= nextWeek && l.endDate >= nextWeek
    );
    if (onLeaveNextWeek.length > 0) {
      suggestions.push({
        label: `${onLeaveNextWeek.length} on leave next week`,
        prompt: "Who is on leave next week?",
      });
    }
  } catch {
    /* skip */
  }

  return suggestions.slice(0, 4);
}

/** AD ISO strings for next week's start. */
function getRosterWeekPair(): [string, string] {
  const w0 = getRosterWeek(0);
  const w1 = getRosterWeek(1);
  return [w0.startDate, w1.startDate];
}
