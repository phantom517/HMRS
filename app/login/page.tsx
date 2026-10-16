"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Lock, Shield, AlertCircle, ArrowRight, Eye, Loader2 } from "lucide-react";
import { adminLoginAction, viewAsEmployeeAction } from "@/lib/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "admin">("choose");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeLogin(res: { success: boolean; user?: any }) {
    try {
      if (typeof document !== "undefined") {
        document.cookie = "hospital_hrms_logged_out=; path=/; max-age=0; SameSite=None; Secure";
        if (res.user?.id) {
          document.cookie = `hospital_hrms_session_user=${res.user.id}; path=/; max-age=604800; SameSite=None; Secure`;
          sessionStorage.setItem("hospital_hrms_session_user", res.user.id);
        }
      }
    } catch {
      // Non-blocking fallback
    }
    // Hard navigate to ensure fresh cookies and clean middleware evaluation
    window.location.href = "/";
  }

  async function handleAdminLogin(e?: React.FormEvent, pwdOverride?: string) {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);

    const targetPassword = pwdOverride ?? password;
    try {
      const res = await adminLoginAction(targetPassword);
      await completeLogin(res);
    } catch (err: any) {
      setError(err.message || "Incorrect admin password.");
      setIsLoading(false);
    }
  }

  async function handleEmployeeView() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await viewAsEmployeeAction();
      await completeLogin(res);
    } catch (err: any) {
      setError(err.message || "Could not start the read-only view.");
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--parchment)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="zelt-surface"
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Hospital Branding Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--linen)",
              border: "1px solid var(--ink-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HeartPulse style={{ width: 24, height: 24, strokeWidth: 1.5, color: "var(--ink)" }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: "var(--ink)",
                letterSpacing: "-0.17px",
                lineHeight: 1.24,
              }}
            >
              Patan Academy Health System
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 4 }}>
              Emergency &amp; Critical Care HRMS (DEPT-402)
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--critical-bg)",
              color: "var(--critical-text)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, strokeWidth: 1.5, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {mode === "choose" ? (
          <>
            {/* Two entry options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 12, color: "var(--ink-tertiary)", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>
                Choose how to enter
              </span>

              {/* Option 1: Admin */}
              <button
                type="button"
                onClick={() => {
                  setMode("admin");
                  setError(null);
                }}
                style={{
                  width: "100%",
                  padding: "18px 20px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "border-color 150ms ease, background-color 150ms ease",
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
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--paper)",
                    border: "1px solid var(--ink-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Shield style={{ width: 20, height: 20, strokeWidth: 1.5, color: "var(--ink)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>View as Admin</div>
                  <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 2 }}>
                    Full management access — sign in with the fixed admin password
                  </div>
                </div>
                <ArrowRight style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink-tertiary)", flexShrink: 0 }} />
              </button>

              {/* Option 2: Employee (read-only) */}
              <button
                type="button"
                onClick={handleEmployeeView}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "18px 20px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                  cursor: isLoading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "border-color 150ms ease, background-color 150ms ease",
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
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--paper)",
                    border: "1px solid var(--ink-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Eye style={{ width: 20, height: 20, strokeWidth: 1.5, color: "var(--ink)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>View as Employee</div>
                  <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 2 }}>
                    Read-only access — browse rosters, staff and reports (no editing)
                  </div>
                </div>
                {isLoading ? (
                  <Loader2 style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink-tertiary)", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                ) : (
                  <ArrowRight style={{ width: 16, height: 16, strokeWidth: 1.5, color: "var(--ink-tertiary)", flexShrink: 0 }} />
                )}
              </button>
            </div>
          </>
        ) : (
          /* Admin password sign-in */
          <form onSubmit={handleAdminLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="ztag ztag-neutral" style={{ gap: 6 }}>
                <Shield style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                <span>Admin Access</span>
              </div>
            </div>

            {/* Helper callout with demo credentials */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--linen)",
                border: "1px solid var(--ink-border)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>
                  Admin Password: <code style={{ background: "var(--paper)", padding: "2px 6px", borderRadius: 6, border: "1px solid var(--ink-border)" }}>Password123!</code>
                </span>
                <button
                  type="button"
                  onClick={() => setPassword("Password123!")}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--teal-primary, #00685f)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Auto-fill
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--ink-secondary)", margin: 0 }}>
                Default clinical director account: <strong>Dr. Sarah Jenkins</strong> (Full administrative access).
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                Admin Password
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock
                  style={{
                    position: "absolute",
                    left: 12,
                    width: 16,
                    height: 16,
                    strokeWidth: 1.5,
                    color: "var(--ink-tertiary)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password123!"
                  style={{
                    width: "100%",
                    height: 40,
                    padding: "0 12px 0 38px",
                    borderRadius: 12,
                    background: "var(--linen)",
                    border: "1px solid var(--ink-border)",
                    fontSize: 14,
                    color: "var(--ink)",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="zbtn zbtn-primary"
              style={{ width: "100%", marginTop: 4, height: 44 }}
            >
              <span>{isLoading ? "Verifying..." : "Sign in as Admin"}</span>
              <ArrowRight style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAdminLogin(undefined, "Password123!")}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 10,
                background: "var(--paper)",
                border: "1px solid var(--ink-border-strong)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ink)",
                cursor: isLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span>⚡ One-Click Instant Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setPassword("");
                setError(null);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--ink-tertiary)",
                textDecoration: "underline",
                fontFamily: "inherit",
                alignSelf: "center",
              }}
            >
              Back to options
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
