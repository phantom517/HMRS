"use client";

// components/settings/AuditTab.tsx — the audit log (B3). One <table>, sticky
// thead, table-layout fixed, no wrapping cells (truncate + title tooltip).
// Consecutive rows with the same actor + action + record type within 60 s
// collapse into one expandable display group (data stays individual on
// export). Sign-ins hidden by default, toggled in the filter row. Row click
// opens a detail drawer with the previous/new value diff.
import { memo, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { DEPARTMENT_TIMEZONE } from "@/lib/calendar/types";
import { formatDate } from "@/lib/calendar/format";
import type { CalendarLocale, CalendarSystem } from "@/lib/calendar/types";
import {
  auditActionLabel,
  groupAuditRows,
  recordTypeLabel,
} from "@/lib/audit/catalog";

export interface AuditLogRow {
  id: string;
  createdAt: string | Date;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  details?: string | null;
  previousValues?: unknown;
  newValues?: unknown;
}

const thCls =
  "h-11 px-4 text-left text-[13px] font-medium text-(--ink-secondary) whitespace-nowrap";
const tdCls = "px-4 py-3 text-[13px] whitespace-nowrap truncate";

/** Department-timezone, AD/BS-aware stamp: "Oct 14, 2026 · 6:38 PM". */
const AuditStamp = memo(function AuditStamp({
  createdAt,
  system,
  locale,
}: {
  createdAt: string | Date;
  system: CalendarSystem;
  locale: CalendarLocale;
}) {
  const dt = DateTime.fromJSDate(new Date(createdAt)).setZone(DEPARTMENT_TIMEZONE);
  const iso = dt.toFormat("yyyy-MM-dd");
  const date = formatDate(iso, { system, locale, style: "short" });
  const time = dt.toFormat("h:mm a");
  return (
    <span title={dt.toFormat("yyyy-MM-dd HH:mm")} className="[font-variant-numeric:tabular-nums]">
      {date} · {time}
    </span>
  );
});

const GroupRow = memo(function GroupRow({
  g,
  onOpen,
  system,
  locale,
}: {
  g: ReturnType<typeof groupAuditRows<AuditLogRow>>[number];
  onOpen: (rows: AuditLogRow[]) => void;
  system: CalendarSystem;
  locale: CalendarLocale;
}) {
  const [expanded, setExpanded] = useState(false);
  const head = g.rows[0];
  const chevron = (
    <button
      type="button"
      aria-label={expanded ? "Collapse" : "Expand"}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-(--ink-secondary) hover:bg-(--linen)"
    >
      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );

  return (
    <>
      <tr
        className="h-[52px] cursor-pointer border-b border-(--ink-border-row) hover:bg-(--linen)"
        onClick={() => onOpen(g.rows)}
      >
        <td className={`${tdCls} text-(--ink-secondary)`}>
          <AuditStamp createdAt={head.createdAt} system={system} locale={locale} />
        </td>
        <td className={`${tdCls} font-medium text-(--ink)`} title={head.actorName}>
          {head.actorName}
        </td>
        <td className={tdCls}>
          <span className="inline-flex items-center gap-2 text-(--ink)">
            {g.label}
            {g.viaAssistant && (
              <span className="rounded-md bg-(--linen) px-1.5 py-0.5 text-[11px] text-(--ink-secondary)">
                via assistant
              </span>
            )}
          </span>
        </td>
        <td className={`${tdCls} text-(--ink)`} title={head.entityLabel ?? head.entityId}>
          {g.count > 1
            ? `${g.rows.length} ${recordTypeLabel(head.entityType).toLowerCase() !== "employee" ? recordTypeLabel(head.entityType).toLowerCase() + "s" : "entries"}`
            : recordTypeLabel(head.entityType) === "Employee"
              ? head.entityLabel ?? head.entityId
              : recordTypeLabel(head.entityType)}
        </td>
        <td className={`${tdCls} text-(--ink-secondary)`} title={head.details ?? ""}>
          {head.details || "—"}
        </td>
        <td className="px-2 py-3 text-right">{chevron}</td>
      </tr>
      {expanded &&
        g.rows.map((row) => (
          <tr
            key={row.id}
            className="h-[52px] cursor-pointer border-b border-(--ink-border-row) bg-(--linen)/40 hover:bg-(--linen)"
            onClick={() => onOpen([row])}
          >
            <td className={`${tdCls} pl-10 text-(--ink-tertiary)`}>
              <AuditStamp createdAt={row.createdAt} system={system} locale={locale} />
            </td>
            <td className={`${tdCls} text-(--ink-secondary)`}>{row.actorName}</td>
            <td className={`${tdCls} text-(--ink)`}>{auditActionLabel(row.action)}</td>
            <td className={`${tdCls} text-(--ink)`} title={row.entityLabel ?? row.entityId}>
              {row.entityLabel ?? row.entityId}
            </td>
            <td className={`${tdCls} text-(--ink-secondary)`} title={row.details ?? ""}>
              {row.details || "—"}
            </td>
            <td className="px-2 py-3" />
          </tr>
        ))}
    </>
  );
});

export function AuditTab({
  rows,
  total,
  page,
  pageSize,
  system,
  locale,
  includeSignIns,
}: {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  system: CalendarSystem;
  locale: CalendarLocale;
  includeSignIns: boolean;
}) {
  const router = useRouter();
  const [detailRows, setDetailRows] = useState<AuditLogRow[] | null>(null);
  const openDetail = useCallback((r: AuditLogRow[]) => setDetailRows(r), []);

  const groups = useMemo(() => groupAuditRows(rows), [rows]);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pushPage = useCallback(
    (next: number) =>
      router.push(
        `/settings?tab=audit&page=${next}${includeSignIns ? "&include=signins" : ""}`
      ),
    [router, includeSignIns]
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-(--ink-secondary)">
          <input
            type="checkbox"
            className="size-4 accent-(--ink)"
            checked={includeSignIns}
            onChange={() =>
              router.push(
                `/settings?tab=audit${includeSignIns ? "" : "&include=signins"}`
              )
            }
          />
          Include sign-ins
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-(--ink-border) bg-(--paper)">
        {rows.length === 0 ? (
          <div className="p-10">
            <Empty>
              <EmptyHeader>
                <EmptyTitle className="text-[15px] font-medium">No audit entries</EmptyTitle>
                <EmptyDescription className="text-[13px] text-(--ink-secondary)">
                  Changes you make across the system will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <table
            className="w-full border-separate border-spacing-0"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: 168 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 200 }} />
              <col />
              <col />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-(--linen)">
                <th className={`${thCls} border-b border-(--ink-border)`}>When</th>
                <th className={`${thCls} border-b border-(--ink-border)`}>Who</th>
                <th className={`${thCls} border-b border-(--ink-border)`}>Action</th>
                <th className={`${thCls} border-b border-(--ink-border)`}>Record</th>
                <th className={`${thCls} border-b border-(--ink-border)`}>Details</th>
                <th className="border-b border-(--ink-border)" aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRow key={g.key} g={g} onOpen={openDetail} system={system} locale={locale} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-1 text-[13px] text-(--ink-secondary)">
          <span aria-live="polite">
            {from}–{to} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={page <= 1}
              onClick={() => pushPage(page - 1)}
              className="h-8 px-3 text-[13px] font-medium text-(--ink-secondary) hover:bg-(--linen) hover:text-(--ink) disabled:opacity-40"
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              disabled={to >= total}
              onClick={() => pushPage(page + 1)}
              className="h-8 px-3 text-[13px] font-medium text-(--ink-secondary) hover:bg-(--linen) hover:text-(--ink) disabled:opacity-40"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AuditDetailDrawer rows={detailRows} onClose={() => setDetailRows(null)} />
    </div>
  );
}

// ── Detail drawer: previous vs new values, two-column diff ─────────────────

function diffEntries(prev: unknown, next: unknown): Array<[string, string, string]> {
  const p = isRecord(prev) ? prev : {};
  const n = isRecord(next) ? next : {};
  const keys = Array.from(new Set([...Object.keys(p), ...Object.keys(n)])).filter((k) => {
    const a = p[k], b = n[k];
    return k !== "updatedAt" && k !== "updatedBy" && JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
  return keys.map((k) => [k, showValue(p[k]), showValue(n[k])]);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function showValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  return String(v);
}

function AuditDetailDrawer({
  rows,
  onClose,
}: {
  rows: AuditLogRow[] | null;
  onClose: () => void;
}) {
  const head = rows?.[0] ?? null;
  const entries = head ? diffEntries(head.previousValues, head.newValues) : [];
  return (
    <Sheet open={!!rows} onOpenChange={(o) => !o && onClose()}>
      {head && entries.length > 0 && (
        <SheetContent
          side="right"
          className="w-[460px] p-6 sm:max-w-[460px]"
        >
          <SheetHeader className="p-0">
            <SheetTitle>{auditActionLabel(head.action)}</SheetTitle>
            <SheetDescription className="text-[13px] text-(--ink-secondary)">
              {head.actorName} · {recordTypeLabel(head.entityType)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {head.details && (
              <p className="mb-3 text-[13px] text-(--ink-secondary)">{head.details}</p>
            )}
            <table className="w-full text-left text-[13px]" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="bg-(--linen)">
                  <th className="w-[120px] px-2 py-2 font-medium text-(--ink-secondary)">Field</th>
                  <th className="px-2 py-2 font-medium text-(--ink-secondary)">Was</th>
                  <th className="px-2 py-2 font-medium text-(--ink-secondary)">Now</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-(--ink-border-row)">
                  <td className="px-2 py-2" />
                  {rows!.length > 1 && (
                    <td colSpan={2} className="px-2 py-2 text-(--ink-secondary)">
                      Showing the newest of {rows!.length} entries
                    </td>
                  )}
                </tr>
                {entries.map(([key, was, now]) => (
                  <tr key={key} className="border-b border-(--ink-border-row)">
                    <td className="break-words px-2 py-2 font-medium text-(--ink)" title={key}>
                      {key}
                    </td>
                    <td className="break-words px-2 py-2 text-(--ink-secondary)" title={was}>{was}</td>
                    <td className="break-words px-2 py-2 text-(--ink)" title={now}>{now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
