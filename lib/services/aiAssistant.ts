import { GoogleGenAI } from "@google/genai";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { getRosterWeek, cycleToday } from "@/lib/schedule-cycle";
import { toolDeclarations } from "@/lib/services/assistant/toolDeclarations";
import { toolHandlers } from "@/lib/services/assistant/toolHandlers";
import {
    buildDepartmentContext,
} from "@/lib/services/assistant/deptContext";
import { buildFallbackReply } from "@/lib/services/assistant/fallbackReply";

export interface AssistantMessage {
    role: "user" | "model";
    text: string;
}

export interface AssistantTurnResult {
    reply: string;
    actions: Array<{ tool: string; ok: boolean; summary: string }>;
}

const MODEL = "gemini-3-flash-preview";
const MAX_TOOL_ITERATIONS = 8;

function extractText(response: any): string {
    try {
        return response.text || "";
    } catch {
        const parts = response?.candidates?.[0]?.content?.parts || [];
        return parts.map((p: any) => p.text || "").join("");
    }
}

export async function runAssistantTurn(params: {
    user: AuthenticatedUser;
    history: AssistantMessage[];
    message: string;
}): Promise<AssistantTurnResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    const user = params.user;
    const contextSummary = await buildDepartmentContext();
    const { weekLabel, startDate, endDate } = getRosterWeek(0);

    // Fallback if no GEMINI_API_KEY is configured in the environment
    if (!apiKey) {
        const fallbackReply = await buildFallbackReply({
            user,
            contextSummary,
            weekLabel,
            startDate,
            endDate,
            message: params.message,
        });
        return { reply: fallbackReply, actions: [] };
    }

    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
            headers: {
                "User-Agent": "aistudio-build",
            },
        },
    });

    const adminPasswordNote = "";

    const systemInstruction = [
        `You are the on-call AI management assistant for the Patan Academy Emergency & Critical Care HRMS (DEPT-402).`,
        `Signed-in user: ${user.name} — role "${user.role}" (${user.title}). Their permissions: ${JSON.stringify(user.permissions)}.`,
        `Current roster cycle: ${weekLabel} (Mon ${startDate} → Sun ${endDate}; today is ${cycleToday()}). Use ISO dates YYYY-MM-DD. When the user says "today", "this week", "tomorrow" or similar, resolve it against these dates — never guess calendar dates from memory.`,
        `You can BOTH answer questions and actually operate the system using the tools: create/update/archive employees (and do it in BULK up to 20 per call), move staff between units in bulk, manage shift types, assign and remove shifts singly and in bulk, run the Smart Fill engine over a date range, record and decide leave singly and in bulk, schedule off-days in bulk for multiple staff/dates, adjust balances and update fatigue guardrails. You also have analyze_coverage for real per-day coverage and conflict numbers before you propose anything.`,
        `Every mutation runs through the app's enforced permission system — if a call fails with an authorization error, tell the user their account lacks that permission instead of retrying.`,
        `Rules of conduct:`,
        `- Prefer get_department_context first to resolve real IDs; never invent IDs.`,
        `- BULK work: for anything touching many records (archive several leavers, move a whole team to a new unit, approve this week's pending leave, clear conflicts on a date) use the matching bulk_ tool instead of repeating single calls. Hard cap: 20 records per action — if the user asks for more, say the cap and split it, and tell them how many are left.`,
        `- Before proposing bulk changes, run analyze_coverage on the affected dates and report WHICH days/shifts are short and who the candidates are; state what you are about to change and how many records, then do it. Summarize per-item failures honestly (name + reason) — never gloss over partial failures.`,
        `- assign_shift takes a shiftTypeShortCode like D/E/N/TR/PED — the server maps codes to real IDs for you. If the code is invalid the error lists all valid codes.`,
        `- If a shift assignment fails validation (rest interval, approved leave, overlapping shift, inactive staff), do NOT blindly retry with forceOverrideWarnings. Read the error, pick a better option (another date, another employee, or removing the conflicting assignment first) and explain your choice. Only force-override rest warnings when the user explicitly asks.`,
        `- Before assigning, sanity-check the target: not on approved leave that date, no existing assignment that date, weekly hours stay under the guardrails in LIVE DEPARTMENT CONTEXT.`,
        `- Employee fields: employeeId (code like NUR-204), fullName, designation (e.g. "Staff Critical Care RN"), unit, phone, email, dateJoined.`,
        `- For leave/date ranges include the reason. For destructive actions (archive) confirm the exact target list was resolved by code or name before executing — list the names you are about to archive in bulk.`,
        `- After performing actions, summarize briefly what you changed and flag any validation warnings.`,
        `- If the user asks something you can answer from the context, answer directly with real numbers.`,
        `LIVE DEPARTMENT CONTEXT (as of now):\n${JSON.stringify(contextSummary).slice(0, 12000)}`,
        adminPasswordNote,
    ]
        .filter(Boolean)
        .join("\n\n");

    const contents: Array<any> = [];
    for (const msg of params.history.slice(-12)) {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
    contents.push({ role: "user", parts: [{ text: params.message }] });

    const actions: AssistantTurnResult["actions"] = [];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations: toolDeclarations as any }],
                temperature: 0.3,
            },
        });

        const candidate = response?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const functionCalls = parts
            .filter((p: any) => p.functionCall)
            .map((p: any) => p.functionCall);

        // If no tool calls, this is the final natural language answer
        if (functionCalls.length === 0) {
            return {
                reply:
                    extractText(response) ||
                    "I've reviewed your request against the department records.",
                actions,
            };
        }

        // Push the model's function-calling turn to history
        if (candidate?.content) {
            contents.push(candidate.content);
        }

        // Execute every requested tool call
        const toolResponseParts: Array<any> = [];
        for (const call of functionCalls) {
            const handler = toolHandlers[call.name];
            let result: any;
            if (!handler) {
                result = { ok: false, error: `Unknown tool "${call.name}".` };
            } else {
                try {
                    result = await handler(call.args, user);
                } catch (err: any) {
                    result = {
                        ok: false,
                        error: err?.message || `Tool "${call.name}" failed.`,
                    };
                }
            }
            actions.push({
                tool: call.name,
                ok: result.ok !== false,
                summary: result.summary || JSON.stringify(result),
            });
            toolResponseParts.push({
                functionResponse: {
                    name: call.name,
                    response: { result },
                },
            });
        }

        // Add the tool execution results back to the conversation as user functionResponse parts
        contents.push({
            role: "user",
            parts: toolResponseParts,
        });

        // The loop continues so Gemini can see the tool results and generate the conversational reply
    }

    return {
        reply: "I completed the requested system operations. Please review the live roster and department status.",
        actions,
    };
}
