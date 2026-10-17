"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  CalendarRange,
  CalendarDays,
  Users,
  Plane,
  Clock4,
  BarChart3,
  Settings,
  Sparkles,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";

interface SidebarProps {
  currentUser: AuthenticatedUser;
  activeConflictsCount?: number;
  totalEmployeesCount?: number;
  pendingLeavesCount?: number;
}

export function Sidebar({
  activeConflictsCount = 2,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: "Staffing", href: "/", icon: Gauge },
    { label: "Roster", href: "/duty-roster", icon: CalendarRange, badge: activeConflictsCount > 0 ? activeConflictsCount : null },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Leave", href: "/leave-off-days", icon: Plane },
    { label: "Shift types", href: "/shift-types", icon: Clock4 },
    { label: "Reports", href: "/reports-statistics", icon: BarChart3 },
    { label: "Assistant", href: "/assistant", icon: Sparkles },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <>
      {/* Mobile: floating menu button. Sits in the page's bottom gutter so it
          floats over padding rather than over content. */}
      <button
        className="sidebar-toggle"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          width: 48,
          height: 48,
          borderRadius: 24,
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--ink)",
          zIndex: 45,
        }}
      >
        <Menu style={{ width: 20, height: 20, strokeWidth: 1.75 }} />
      </button>

      {/* Mobile: scrim behind the drawer */}
      <div
        className={`sidebar-scrim${mobileOpen ? " is-open" : ""}`}
        onClick={closeMobile}
      />

      <nav
        className={`app-sidebar${mobileOpen ? " is-open" : ""}`}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          zIndex: mobileOpen ? 60 : 30,
          padding: "20px 16px 16px 16px",
          overflowY: "auto",
        }}
      >
        {/* Brand row */}
        <div
          style={{
            padding: "8px 12px 28px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "var(--linen)",
              border: "1px solid var(--ink-border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Gauge style={{ width: 16, height: 16, strokeWidth: 1.75, color: "var(--ink)" }} />
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--ink)",
              letterSpacing: "-0.2px",
            }}
          >
            Patan Academy ED
          </span>
          {/* Mobile close button */}
          <button
            onClick={closeMobile}
            aria-label="Close navigation"
            className="sidebar-toggle"
            style={{
              marginLeft: "auto",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--ink-border)",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--ink-secondary)",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Nav items: 40px tall, icon + label, badge right after the label */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
          }}
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: active ? 500 : 400,
                  color: "var(--ink)",
                  background: active ? "var(--paper)" : "transparent",
                  border: active ? "1px solid var(--ink-border)" : "1px solid transparent",
                  textDecoration: "none",
                  transition: "background-color 150ms ease, border-color 150ms ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--linen)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <item.icon
                  style={{
                    width: 17,
                    height: 17,
                    strokeWidth: active ? 1.9 : 1.6,
                    color: "var(--ink)",
                    flexShrink: 0,
                  }}
                />
                <span>{item.label}</span>
                {item.badge != null && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                      background: "var(--apricot)",
                      padding: "1px 8px",
                      borderRadius: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer Nav: Settings & Sign out */}
        <div
          style={{
            paddingTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <Link
            href="/settings"
            onClick={closeMobile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 40,
              padding: "0 12px",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: pathname.startsWith("/settings") ? 500 : 400,
              color: "var(--ink)",
              background: pathname.startsWith("/settings") ? "var(--paper)" : "transparent",
              border: pathname.startsWith("/settings")
                ? "1px solid var(--ink-border)"
                : "1px solid transparent",
              textDecoration: "none",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/settings")) e.currentTarget.style.background = "var(--linen)";
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/settings")) e.currentTarget.style.background = "transparent";
            }}
          >
            <Settings style={{ width: 17, height: 17, strokeWidth: 1.6, color: "var(--ink)", flexShrink: 0 }} />
            <span>Settings</span>
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 40,
                padding: "0 12px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 400,
                color: "var(--ink-secondary)",
                background: "transparent",
                border: "1px solid transparent",
                cursor: "pointer",
                textAlign: "left" as const,
                transition: "background-color 150ms ease, color 150ms ease",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--linen)";
                e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-secondary)";
              }}
            >
              <LogOut style={{ width: 17, height: 17, strokeWidth: 1.6, flexShrink: 0 }} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
