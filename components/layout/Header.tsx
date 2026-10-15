"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import * as assistantStore from "@/components/assistant/assistantStore";

interface HeaderProps {
  currentUser: AuthenticatedUser;
  employees?: Array<{
    id: string;
    employeeId: string;
    fullName: string;
    designation: string;
    unit: string;
  }>;
  shiftTypes?: Array<{
    id: string;
    shortCode: string;
    name: string;
    color: string;
    startTime: string;
    endTime: string;
  }>;
}

export function Header({ currentUser }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const roleLabel =
    currentUser.role === "superuser"
      ? "Admin"
      : currentUser.role === "assistant"
        ? "Assistant Manager"
        : "View Only";

  return (
    <header
      className="app-topbar"
      style={{
        height: 60,
        margin: "16px 32px 0 32px",
        background: "var(--paper)",
        border: "1px solid var(--ink-border)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      {/* Left: Department breadcrumb / identifier */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.1px",
          }}
        >
          Patan Academy Health System
        </span>
        <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>/</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "var(--ink-secondary)",
          }}
        >
          Emergency &amp; Critical Care
        </span>
      </div>

      {/* Right: Assistant + user button & menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => assistantStore.toggle()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 14px",
            borderRadius: 12,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            color: "var(--ink)",
            fontFamily: "inherit",
            fontWeight: 500,
            transition: "background-color 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--linen)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Sparkles style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
          <span>Assistant</span>
        </button>
        <div ref={menuRef} style={{ position: "relative" }}>
        {/* Role is shown once, inside the menu — never as a chip in the bar itself */}
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 36,
            padding: "0 14px",
            borderRadius: 12,
            background: "transparent",
            border: "1px solid var(--ink-border-strong)",
            cursor: "pointer",
            fontSize: 14,
            color: "var(--ink)",
            fontFamily: "inherit",
            fontWeight: 500,
            transition: "background-color 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--parchment)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span>{currentUser.name}</span>
        </button>

        {isUserMenuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 220,
              background: "var(--paper)",
              border: "1px solid var(--ink-border)",
              borderRadius: 12,
              padding: 6,
              zIndex: 50,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--ink-tertiary)",
                borderBottom: "1px solid var(--ink-border)",
                marginBottom: 4,
              }}
            >
              Signed in as {currentUser.name}
              <div style={{ marginTop: 2, fontWeight: 500, color: "var(--ink)" }}>
                {currentUser.title} · {roleLabel}
              </div>
            </div>
            {currentUser.role === "viewer" && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "var(--ink-secondary)",
                }}
              >
                Read-only session — you can browse everything but cannot add or change records.
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
