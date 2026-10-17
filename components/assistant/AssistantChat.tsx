"use client";

// components/assistant/AssistantChat.tsx
// The Assistant as a full page (/assistant).
//
// Structure: page header (title + subtitle + Clear) → one solid --paper card.
// The card owns its height and clips; only the message list inside it scrolls,
// so the page itself never grows a second scrollbar and the card edge is never
// cut by one.
//
// Conversation state lives in sessionStorage for this browser tab only.
// Assistant replies render through ./markdown, which normalises the loose
// markdown the model emits (glued blocks, stray asterisks) before rendering.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Loader2,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { sendAssistantMessageAction } from "@/lib/actions/ai";
import {
  getAssistantSuggestionsAction,
  type AssistantSuggestion,
} from "@/lib/actions/assistant-suggestions";
import { Markdown, markdownToPlainText } from "./markdown";

interface ToolActivity {
  tool: string;
  ok: boolean;
  summary: string;
}

interface ProposalDiff {
  removed: string[];
  added: string[];
  warnings: string[];
}

interface ChatEntry {
  role: "user" | "model";
  text: string;
  at?: number;
  tools?: ToolActivity[];
  /** Present when the turn proposed a change the user must confirm. */
  proposal?: ProposalDiff;
  /** Set once the user chose, so the card collapses to a one-line result. */
  resolved?: { applied: boolean; note: string };
}

const STORAGE_KEY = "patanacademy-assistant-conversation";
const FALLBACK_CHIPS: AssistantSuggestion[] = [
  { label: "Who is on shift tomorrow?", prompt: "Who is on shift tomorrow?" },
  { label: "Check fatigue violations", prompt: "Are there any fatigue violations or shifts with under 11h rest?" },
  { label: "Show coverage gaps this week", prompt: "Show me the coverage gaps in this week's roster." },
  { label: "Who is on leave?", prompt: "Who is on leave right now?" },
];

export function AssistantChat({ currentUser }: { currentUser: AuthenticatedUser }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<null | { requestId: number }>(null);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const lastRequestId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      if (entries.length > 0) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-80)));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage full or unavailable — in-memory chat still works */
    }
  }, [entries]);

  useEffect(() => {
    let cancelled = false;
    void getAssistantSuggestionsAction()
      .then((s) => !cancelled && setSuggestions(s))
      .catch(() => !cancelled && setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-grow the composer up to six lines.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 156)}px`;
  }, [input]);

  // Follow new messages only when the reader is already at the bottom;
  // otherwise leave their place alone and offer "Jump to latest".
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !nearBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, pending, nearBottom]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setNearBottom(distance < 64);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setNearBottom(true);
  }, []);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || pending != null) return;
      const history = entries.map((e) => ({ role: e.role, text: e.text }));
      const requestId = ++lastRequestId.current;
      setEntries((prev) => [...prev, { role: "user", text, at: Date.now() }]);
      setInput("");
      setError(null);
      setPending({ requestId });
      setNearBottom(true);

      try {
        const res = await sendAssistantMessageAction({ history, message: text });
        if (lastRequestId.current !== requestId) return; // stopped by the user
        setEntries((prev) => [
          ...prev,
          {
            role: "model",
            text: res.reply,
            at: Date.now(),
            tools: res.actions ?? [],
            proposal: extractProposal(res.reply, res.actions ?? []),
          },
        ]);
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

  const resolveProposal = useCallback(
    (index: number, applied: boolean) => {
      setEntries((prev) =>
        prev.map((entry, i) => {
          if (i !== index) return entry;
          const removed = entry.proposal?.removed.length ?? 0;
          const added = entry.proposal?.added.length ?? 0;
          return {
            ...entry,
            resolved: {
              applied,
              note: applied
                ? `Applied · ${[
                    removed > 0 ? `${removed} removed` : null,
                    added > 0 ? `${added} added` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "confirmed"}`
                : "Discarded — nothing was changed",
            },
          };
        })
      );
      // Applying goes through the same assistant turn; no new API path.
      if (applied) void send("Yes — apply the proposed changes.");
    },
    [send]
  );

  const chips =
    suggestions && suggestions.length > 0 ? suggestions.slice(0, 4) : FALLBACK_CHIPS;
  const isEmpty = entries.length === 0 && pending == null;
  const pendingProposalIndex = entries.findIndex((e) => e.proposal && !e.resolved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Page header: title + subtitle left, Clear right, on the title baseline ── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.38px",
              lineHeight: 1.2,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Assistant
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-secondary)",
              lineHeight: 1.5,
              margin: "8px 0 0 0",
            }}
          >
            Ask about the roster, leave, or staff. Any change is shown to you first and
            saved only after you confirm.
          </p>
        </div>
        <button
          type="button"
          className="zbtn zbtn-secondary"
          onClick={() => {
            setEntries([]);
            setError(null);
          }}
          disabled={entries.length === 0}
          style={{ flexShrink: 0, opacity: entries.length === 0 ? 0.45 : 1 }}
        >
          <Trash2 style={{ width: 15, height: 15, strokeWidth: 1.6 }} />
          <span>Clear conversation</span>
        </button>
      </div>

      {/* ── Conversation card ── */}
      <div className="zchat-card">
        <div className="zchat-fade" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
          <div
            ref={scrollRef}
            className="zchat-scroll"
            role="log"
            aria-live="polite"
            aria-label="Conversation with the assistant"
            onScroll={onScroll}
          >
            <div className="zchat-column zchat-log">
              {isEmpty ? (
                <EmptyState chips={chips} onPick={(p) => void send(p)} />
              ) : (
                entries.map((entry, i) => (
                  <MessageRow
                    key={i}
                    entry={entry}
                    onResolve={
                      entry.proposal && !entry.resolved
                        ? (applied) => resolveProposal(i, applied)
                        : undefined
                    }
                    hidePrimary={pendingProposalIndex >= 0}
                  />
                ))
              )}

              {/* Streaming: typing indicator while the turn is in flight. */}
              {pending && (
                <div className="zchat-row" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <SparkleAvatar />
                  <div
                    className="zchat-typing"
                    aria-label="Assistant is working"
                    style={{ paddingTop: 4 }}
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              {/* Error: inline banner + retry */}
              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    background: "var(--critical-bg)",
                    color: "var(--critical-text)",
                    borderRadius: 12,
                    padding: "12px 16px",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>{error}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const lastUser = [...entries].reverse().find((e) => e.role === "user");
                      setError(null);
                      if (lastUser) void send(lastUser.text);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--critical-text)",
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: 500,
                      textDecoration: "underline",
                      flexShrink: 0,
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Jump to latest: only when the reader has scrolled away. */}
          {!nearBottom && (
            <button
              type="button"
              className="zbtn zbtn-secondary"
              onClick={jumpToLatest}
              style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 3,
                background: "var(--paper)",
                fontSize: 13,
                padding: "8px 14px",
              }}
            >
              <ArrowDown style={{ width: 14, height: 14, strokeWidth: 1.75 }} />
              <span>Jump to latest</span>
            </button>
          )}
        </div>

        {/* ── Composer: pinned, separated by a hairline ── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          style={{
            flexShrink: 0,
            borderTop: "1px solid var(--ink-border-row)",
            padding: 16,
            paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              maxWidth: 760,
              margin: "0 auto",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask about roster, shifts, leaves, fatigue…"
              aria-label="Message the assistant"
              disabled={pending != null}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 156,
                resize: "none",
                borderRadius: 12,
                border: "1px solid var(--ink-border)",
                background: "var(--linen)",
                color: "var(--ink)",
                padding: "11px 14px",
                fontSize: 15,
                lineHeight: 1.45,
                fontFamily: "inherit",
                overflowY: "auto",
              }}
            />
            {pending != null ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                title="Stop"
                className="zbtn"
                style={{
                  width: 44,
                  height: 44,
                  padding: 0,
                  flexShrink: 0,
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                }}
              >
                <Square style={{ width: 14, height: 14 }} />
              </button>
            ) : (
              /* The ONE honey element on this page. While a proposed change is
                 awaiting confirmation the honey moves to that card's Apply
                 button, so this one drops back to a neutral disabled state. */
              <button
                type="submit"
                disabled={!input.trim() || pendingProposalIndex >= 0}
                aria-label="Send message"
                title={pendingProposalIndex >= 0 ? "Respond to the proposed change first" : "Send"}
                className={input.trim() ? "zbtn zbtn-primary" : "zbtn"}
                style={{
                  width: 44,
                  height: 44,
                  padding: 0,
                  flexShrink: 0,
                  borderRadius: 12,
                  border: "none",
                  background: input.trim() && pendingProposalIndex < 0 ? "var(--honey)" : "var(--linen)",
                  color:
                    input.trim() && pendingProposalIndex < 0
                      ? "var(--ink)"
                      : "var(--ink-tertiary)",
                  cursor: input.trim() && pendingProposalIndex < 0 ? "pointer" : "default",
                }}
              >
                <ArrowUp style={{ width: 17, height: 17, strokeWidth: 2 }} />
              </button>
            )}
          </div>
          <p
            style={{
              maxWidth: 760,
              margin: "8px auto 0 auto",
              fontSize: 12,
              color: "var(--ink-tertiary)",
              paddingLeft: 2,
            }}
          >
            Enter to send · Shift + Enter for a new line
            {currentUser.role === "viewer" && " · read-only session"}
          </p>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────── messages ────────────────────────── */

function SparkleAvatar() {
  return (
    <span className="zavatar zavatar-lg" aria-hidden="true">
      <Sparkles style={{ width: 13, height: 13, strokeWidth: 1.75 }} />
    </span>
  );
}

function MessageRow({
  entry,
  onResolve,
  hidePrimary,
}: {
  entry: ChatEntry;
  onResolve?: (applied: boolean) => void;
  hidePrimary: boolean;
}) {
  if (entry.role === "user") {
    return (
      <div
        className="zchat-row"
        style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 10 }}
      >
        <time className="zchat-stamp" dateTime={entry.at ? new Date(entry.at).toISOString() : undefined}>
          {formatTime(entry.at)}
        </time>
        <div
          style={{
            background: "var(--linen)",
            borderRadius: 12,
            padding: "11px 15px",
            fontSize: 15,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "var(--ink)",
            maxWidth: "80%",
          }}
        >
          {entry.text}
        </div>
      </div>
    );
  }

  return (
    <div className="zchat-row" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <SparkleAvatar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <time className="zchat-stamp" dateTime={entry.at ? new Date(entry.at).toISOString() : undefined}>
            {formatTime(entry.at)}
          </time>
        </div>

        {/* Tool / analysis activity — one row per action the turn ran. */}
        {entry.tools && entry.tools.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entry.tools.map((t, i) => (
              <ToolRow key={i} activity={t} />
            ))}
          </div>
        )}

        <Markdown text={entry.text} />

        {entry.proposal && (
          <ProposalCard
            proposal={entry.proposal}
            resolved={entry.resolved}
            onResolve={onResolve}
            hidePrimary={hidePrimary}
          />
        )}
      </div>
    </div>
  );
}

function ToolRow({ activity }: { activity: ToolActivity }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--linen)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
          padding: "4px 10px",
          cursor: "pointer",
          color: "var(--ink-secondary)",
          fontFamily: "inherit",
          fontSize: 12,
        }}
      >
        <ChevronRight
          style={{
            width: 13,
            height: 13,
            strokeWidth: 1.75,
            transition: "transform 150ms ease",
            transform: open ? "rotate(90deg)" : "none",
          }}
        />
        <span>
          Ran <code style={{ fontFamily: "ui-monospace, monospace" }}>{activity.tool}</code>
        </span>
      </button>
      {open && (
        <div
          style={{
            background: "var(--linen)",
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--ink-secondary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {activity.summary || (activity.ok ? "Completed." : "Failed.")}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  resolved,
  onResolve,
  hidePrimary,
}: {
  proposal: ProposalDiff;
  resolved?: { applied: boolean; note: string };
  onResolve?: (applied: boolean) => void;
  hidePrimary: boolean;
}) {
  // After the choice the card collapses to one quiet line.
  if (resolved) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--ink-secondary)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: resolved.applied ? "var(--honey)" : "var(--ink-tertiary)",
            flexShrink: 0,
          }}
        />
        <span>{resolved.note}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--ink-border-strong)",
        borderRadius: 12,
        background: "var(--paper)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--ink-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
          Proposed change
        </span>
        <span className="ztag ztag-warning" style={{ fontSize: 12 }}>
          Needs confirmation
        </span>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {proposal.removed.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>Removing</span>
            {proposal.removed.map((line, i) => (
              <div key={i} className="zchat-diff-row zchat-diff-removed">
                <span aria-hidden="true">−</span>
                <s>{line}</s>
              </div>
            ))}
          </div>
        )}

        {proposal.added.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>Adding</span>
            {proposal.added.map((line, i) => (
              <div key={i} className="zchat-diff-row zchat-diff-added">
                <span aria-hidden="true">+</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        )}

        {proposal.warnings.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 2 }}>
            {proposal.warnings.map((w, i) => (
              <span key={i} className="ztag ztag-warning">
                <AlertTriangle style={{ width: 12, height: 12, strokeWidth: 2, marginRight: 4 }} />
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          padding: "12px 16px",
          borderTop: "1px solid var(--ink-border)",
          background: "var(--linen)",
        }}
      >
        <button type="button" className="zbtn zbtn-secondary" onClick={() => onResolve?.(false)}>
          Discard
        </button>
        <button
          type="button"
          /* The honey element while a proposal is pending. */
          className={hidePrimary ? "zbtn zbtn-primary" : "zbtn zbtn-primary"}
          onClick={() => onResolve?.(true)}
          style={{ fontSize: 15, padding: "10px 20px" }}
        >
          Apply changes
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  chips,
  onPick,
}: {
  chips: AssistantSuggestion[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "48px 0 24px 0",
        textAlign: "center",
      }}
    >
      <span
        className="zavatar"
        style={{ width: 40, height: 40, borderRadius: 12 }}
        aria-hidden="true"
      >
        <Sparkles style={{ width: 18, height: 18, strokeWidth: 1.6 }} />
      </span>
      <div>
        <p style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", margin: 0 }}>
          Ask about the roster, leave, or staff
        </p>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-secondary)",
            margin: "6px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          Answers come from live department data. Nothing is saved without your confirmation.
        </p>
      </div>
      <div
        className="zchat-chips"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}
      >
        {chips.map((s) => (
          <button
            key={s.label}
            type="button"
            className="ztag ztag-neutral"
            onClick={() => onPick(s.prompt)}
            style={{
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              padding: "8px 14px",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--apricot)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--linen)";
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── helpers ────────────────────────── */

function formatTime(at?: number): string {
  if (!at) return "";
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Detect a proposed change in an assistant reply and pull out the diff rows.
 * The assistant applies changes through its tools, so this only reads the
 * reply text — it never invents data.
 */
function extractProposal(reply: string, actions: ToolActivity[]): ProposalDiff | undefined {
  const text = reply ?? "";
  const proposes =
    /proposed change/i.test(text) ||
    /confirm before|awaiting (your )?(confirmation|approval)|apply (these|the) changes/i.test(text);
  if (!proposes) return undefined;

  const removed: string[] = [];
  const added: string[] = [];
  const warnings: string[] = [];

  const strip = (s: string) =>
    s
      .replace(/^\s*[-*•]\s+/, "")
      .replace(/^\s*\d+[.)]\s+/, "")
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .replace(/\*\*/g, "")
      .trim();

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    // Table row: prefer the first non-empty cell as the description.
    if (line.startsWith("|")) {
      const first = strip(line.split("|").filter(Boolean)[0] ?? "");
      if (/^:?-{2,}/.test(first)) continue;
      classify(first, line);
      continue;
    }
    classify(strip(line), line);
  }

  function classify(desc: string, rawLine: string) {
    if (!desc) return;
    if (/^(remove|removing|delete|deleting|unassign)\b/i.test(desc) || /^\s*-\s/.test(rawLine)) {
      if (/^(remove|delete|unassign|drop)\b/i.test(desc)) {
        removed.push(desc.replace(/^[a-z]+\s*[:\-]?\s*/i, ""));
        return;
      }
    }
    if (/^(add|adding|assign|assigning|create|creating|reassign)\b/i.test(desc)) {
      added.push(desc.replace(/^[a-z]+\s*[:\-]?\s*/i, ""));
      return;
    }
    if (
      /guardrail|warning|violat|conflict|exceeds|under 11h|fatigue|over ?cap/i.test(desc) &&
      desc.length <= 90
    ) {
      warnings.push(desc);
    }
  }

  // Guardrail lines the model wrote as its own bullet, not a diff row.
  if (warnings.length === 0 && actions.some((a) => !a.ok)) {
    for (const a of actions.filter((a) => !a.ok)) {
      warnings.push(markdownToPlainText(a.summary || a.tool, 80));
    }
  }

  if (removed.length === 0 && added.length === 0) return undefined;
  return {
    removed: removed.slice(0, 12),
    added: added.slice(0, 12),
    warnings: [...new Set(warnings)].slice(0, 4),
  };
}
