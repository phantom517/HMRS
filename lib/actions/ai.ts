"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { runAssistantTurn, type AssistantMessage } from "@/lib/services/aiAssistant";

/**
 * One turn of the Gemini AI assistant. Runs server-side so the model can
 * execute real system actions (create/delete employees, assign shifts,
 * approve leave…) through the app's permission-checked server actions.
 *
 * Server-side role guard: the employee / view-only role has no access to the
 * AI assistant at all — the panel is hidden for them AND this action rejects
 * them, so a hand-crafted request can't reach the model either.
 */
export async function sendAssistantMessageAction(params: {
  history: Array<{ role: "user" | "model"; text: string }>;
  message: string;
}) {
  const user = await getCurrentUser();

  if (user.role === "viewer") {
    return {
      reply:
        "The AI assistant is not available for view-only (employee) accounts. Contact an administrator if you need roster assistance.",
      actions: [],
    };
  }

  const history: AssistantMessage[] = (params.history || [])
    .slice(-12)
    .filter((m) => m && typeof m.text === "string" && (m.role === "user" || m.role === "model"))
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));

  try {
    const result = await runAssistantTurn({ user, history, message: params.message.slice(0, 4000) });
    return result;
  } catch (err: any) {
    return {
      reply:
        err?.message?.includes("GEMINI_API_KEY")
          ? "AI assistant is not configured — add GEMINI_API_KEY to your environment."
          : err?.message || "The assistant ran into an unexpected error. Please try again.",
      actions: [],
    };
  }
}
