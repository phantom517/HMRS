import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runAssistantTurn } from "@/lib/services/aiAssistant";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const cleanHistory = Array.isArray(history)
      ? history
          .slice(-12)
          .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
          .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }))
      : [];

    const result = await runAssistantTurn({
      user,
      history: cleanHistory,
      message: message.slice(0, 4000),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to process assistant request",
        reply: "The clinical assistant encountered an unexpected issue. Please retry.",
        actions: [],
      },
      { status: 500 }
    );
  }
}
