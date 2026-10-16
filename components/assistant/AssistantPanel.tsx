"use client";

// components/assistant/AssistantPanel.tsx — B4 rewrite.
// - Opened from the top-bar "Assistant" ghost button (no floating pill).
// - ≥1280px: DOCKS as a fixed 400px right panel and pushes page content
//   (body.assistant-open + globals.css @media rule). The table stays readable.
// - Below 1280px: full-height sheet.
// - Esc closes. Open state persists across navigation (assistantStore).
// - Header: "Assistant" + signed-in user. No provider branding.
// - Intro is one line; suggestion chips (max 4) come from real server data.
// - Messages: user = right-aligned linen bubble; assistant = plain left text
//   with basic markdown tables. Composer: auto-growing textarea (1–5 lines),
//   Enter sends, Shift+Enter newline; 40px ink send/stop icon button.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Sparkles, Square, X } from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { sendAssistantMessageAction } from "@/lib/actions/ai";
import {
  getAssistantSuggestionsAction,
  type AssistantSuggestion,
} from "@/lib/actions/assistant-suggestions";
import * as assistantStore from "@/components/assistant/assistantStore";

interface ChatEntry {
  role: "user" | "model";
  text: string;
}

const STORAGE_KEY = "patanacademy-assistant-conversation";
const INTRO = "Ask about the roster, leave, or staff. I'll show you any change and ask before saving.";

export function AssistantPanel({ currentUser }: { currentUser: AuthenticatedUser }) {
  const router = useRouter();
  const open = useSyncExternalStore(assistantStore.subscribe, assistantStore.getSnapshot, () => false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<null | { requestId: number; promptHint: string }>(null);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRequestId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewer = currentUser.role === "viewer";

  // Persistence of the conversation itself (sessionStorage, this browser only).
  // Lazy init instead of a restore effect: sessionStorage is only touched on
  // the client, and the panel renders null while closed, so SSR/hydration
  // never sees the restored messages.
  const [entries, setEntries] = useState<ChatEntry[]>(() => {
    try {
      if (typeof window === "undefined") return [];
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ChatEntry[]) : [];
    } catch {
      return []; // corrupted storage — start clean
    }
  });
  useEffect(() => {
    try {
      if (entries.length > 0) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-80)));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage full or unavailable — in-memory chat still works */
    }
  }, [entries]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") assistantStore.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Docked mode pushes the page content instead of covering it: at ≥1280px
  // the app shell gains a 400px right padding (globals.css).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => document.body.classList.toggle("assistant-open", open && mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      apply();
    };
  }, [open]);

  // Fetch chips once per open, from real data (never hardcoded names/dates).
  useEffect(() => {
    if (!open || suggestions != null) return;
    let cancelled = false;
    void getAssistantSuggestionsAction()
      .then((s) => !cancelled && setSuggestions(s))
      .catch(() => !cancelled && setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, [open, suggestions]);

  // Keep the newest message in view.
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries, pending, open]);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || pending != null) return;
      const history = entries.map((e) => ({ role: e.role, text: e.text }));
      const requestId = ++lastRequestId.current;
      setEntries((prev) => [...prev, { role: "user", text }]);
      setInput("");
      setError(null);
      setPending({ requestId, promptHint: text });

      try {
        const res = await sendAssistantMessageAction({ history, message: text });
        if (lastRequestId.current !== requestId) return; // stopped by the user
        setEntries((prev) => [...prev, { role: "model", text: res.reply }]);
        if (res.actions?.some((a: { ok: boolean }) => a.ok)) router.refresh();
      } catch (err) {
        if (lastRequestId.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      } finally {
        if (lastRequestId.current === requestId) setPending(null);
      }
    },
    [entries, pending, router]
  );

  const stop = useCallback(() => {
    lastRequestId.current++;
    setPending(null);
  }, []);

  if (!open) return null;

  return (
    <aside
      className="zelt-surface"
      role="dialog"
      aria-label="Assistant"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: 400,
        background: "var(--paper)",
        borderLeft: "1px solid var(--ink-border)",
        borderRadius: 0,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderBottom: "1px solid var(--ink-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "relative" }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--linen)",
              border: "1px solid var(--ink-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--teal-primary, #00685f)" }} />
          </span>
          <span
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#10b981",
              border: "2px solid var(--paper)",
            }}
            title="Live Context Active"
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Gemini Clinical Assistant</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 999,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                color: "var(--teal-primary, #00685f)",
                letterSpacing: "0.2px",
              }}
            >
              3.8 Flash
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-tertiary)", marginTop: 1 }}>
            Context Aware (DEPT-402) · {currentUser.name}
          </div>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => setEntries([])}
            className="rounded-lg p-1.5 text-[12px] font-medium"
            style={{ border: "none", cursor: "pointer", color: "var(--ink-tertiary)", display: "flex" }}
            title="Clear this session's conversation"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => assistantStore.setOpen(false)}
          className="rounded-lg p-1.5"
          style={{ border: "none", cursor: "pointer", color: "var(--ink-secondary)", display: "flex" }}
          title="Close assistant (Esc)"
          aria-label="Close assistant"
        >
          <X style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
          {/* Context status card */}
          <div
            style={{
              background: "var(--linen)",
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid var(--ink-border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--teal-primary, #00685f)" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              <span>LIVE CLINICAL CONTEXT CONNECTED</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-secondary)", lineHeight: 1.5, margin: 0 }}>
              Real-time synchronization with active duty rosters, staffing levels across 4 units, 6 shift types, fatigue guardrails (11h rest rule), and leave records.
            </p>
          </div>

          {entries.map((entry, i) =>
            entry.role === "user" ? (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    background: "var(--linen)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "var(--ink)",
                    maxWidth: "85%",
                  }}
                >
                  {entry.text}
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Markdownish text={entry.text} />
              </div>
            )
          )}

          {pending && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-secondary)" }}>
              <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              <span>Working on it — may run a few system actions…</span>
            </div>
          )}

          {error && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                role="alert"
                style={{
                  background: "var(--critical-bg)",
                  color: "var(--critical-text)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
              <button
                type="button"
                onClick={() => {
                  const lastUser = [...entries].reverse().find((e) => e.role === "user");
                  setError(null);
                  if (lastUser) void send(lastUser.text);
                }}
                className="h-8 rounded-lg px-3 text-[13px] font-medium"
                style={{ background: "var(--paper)", border: "1px solid var(--ink-border-strong)", cursor: "pointer", color: "var(--ink)" }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Suggestion chips */}
          {entries.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Contextual Quick Prompts
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(suggestions && suggestions.length > 0
                  ? suggestions.slice(0, 4)
                  : [
                      { label: "Night shift coverage tonight", prompt: "Who is working the Night shift in Trauma and Critical Care tonight?" },
                      { label: "Check fatigue & rest conflicts", prompt: "Are there any staff with fatigue warnings, back-to-back shifts, or under 11h rest?" },
                      { label: "Today's staffing summary", prompt: "Give me a breakdown of clinical staffing coverage across Day, Evening, and Night shifts today." },
                      { label: "Upcoming doctor & nurse leaves", prompt: "Which doctors and nurses have approved or pending leaves this week?" },
                    ]
                ).map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => void send(s.prompt)}
                    className="rounded-[10px] px-3 py-2 text-left text-[12.5px] font-normal"
                    style={{
                      background: "var(--linen)",
                      border: "1px solid var(--ink-border)",
                      cursor: "pointer",
                      color: "var(--ink)",
                      transition: "background 150ms ease, border-color 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--paper)";
                      e.currentTarget.style.borderColor = "var(--ink)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--linen)";
                      e.currentTarget.style.borderColor = "var(--ink-border)";
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          padding: "12px 16px",
          borderTop: "1px solid var(--ink-border)",
          flexShrink: 0,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder="Ask Gemini about roster, shifts, leaves, fatigue..."
          disabled={pending != null}
          style={{
            flex: 1,
            minHeight: 40,
            maxHeight: 140, // ~5 lines
            resize: "none",
            borderRadius: 12,
            border: "1px solid var(--ink-border)",
            background: "var(--paper)",
            color: "var(--ink)",
            padding: "10px 12px",
            fontSize: 13.5,
            lineHeight: 1.45,
            fontFamily: "inherit",
          }}
        />
        {pending != null ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop generating"
            title="Stop"
            style={{ height: 40, width: 40, flexShrink: 0, borderRadius: 12, background: "var(--ink)", color: "var(--paper)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Square style={{ width: 14, height: 14 }} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            title="Send"
            style={{ height: 40, width: 40, flexShrink: 0, borderRadius: 12, background: "var(--ink)", color: "var(--paper)", border: "none", cursor: input.trim() ? "pointer" : "default", opacity: input.trim() ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ArrowUp style={{ width: 16, height: 16 }} />
          </button>
        )}
      </form>
    </aside>
  );
}

/**
 * Enhanced markdown rendering for headings, bullet lists, bold text, code, and pipe tables.
 */
function Markdownish({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, color: "var(--ink)" }}>
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        // Pipe table
        const tableLines = trimmed.split("\n").filter((l) => l.trim().startsWith("|"));
        if (tableLines.length >= 2) return <PipeTable key={bi} lines={tableLines} />;

        // Heading
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={bi} style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", margin: "4px 0 0 0" }}>
              {formatInlineText(trimmed.replace(/^###\s+/, ""))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={bi} style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)", margin: "6px 0 0 0" }}>
              {formatInlineText(trimmed.replace(/^##\s+/, ""))}
            </h3>
          );
        }

        // Bullet lists
        const lines = trimmed.split("\n");
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} style={{ margin: "2px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              {lines.map((l, li) => (
                <li key={li} style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)" }}>
                  {formatInlineText(l.replace(/^\s*[-*•]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi} style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {formatInlineText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function formatInlineText(text: string): React.ReactNode {
  // Split on bold tokens (**bold**), code tokens (`code`), and italics (*italic*)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} style={{ background: "var(--linen)", padding: "1px 5px", borderRadius: 4, fontSize: "0.9em", border: "1px solid var(--ink-border)" }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function PipeTable({ lines }: { lines: string[] }) {
  const cells = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = cells(lines[0]);
  const bodyRows = lines
    .slice(1)
    .filter((l) => !/^\|?\s*:?-{2,}/.test(l.trim()))
    .map(cells);
  return (
    <div style={{ overflowX: "auto", margin: "4px 0" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
        <thead>
          <tr style={{ background: "var(--linen)" }}>
            {header.map((h, i) => (
              <th key={i} style={{ border: "1px solid var(--ink-border)", padding: "5px 10px", textAlign: "left", fontWeight: 600 }}>
                {formatInlineText(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "var(--parchment)" }}>
              {row.map((c, ci) => (
                <td key={ci} style={{ border: "1px solid var(--ink-border)", padding: "5px 10px" }}>
                  {formatInlineText(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
