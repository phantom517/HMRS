"use client";

import { formatHours } from "@/lib/schedule-cycle";
import { Badge } from "@/components/ui/badge";
import { SHIFT_TINTS } from "@/components/roster/rosterStyles";

/* ─── Quiet summary line + legend, above the grid ───────────────────────── */

export function RosterSummaryLine({
  scheduledHours,
  budgetHours,
  shortfallHours,
}: {
  scheduledHours: number;
  budgetHours: number;
  shortfallHours: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      <span className="text-sm text-muted-foreground tabular-nums">
        Scheduled{" "}
        <strong className="font-medium text-foreground">{formatHours(scheduledHours)}</strong>
        {" "}of{" "}
        <strong className="font-medium text-foreground">{formatHours(budgetHours)}</strong>
        {shortfallHours > 0 && (
          <Badge variant="destructive" className="ml-2 align-middle">
            {formatHours(shortfallHours)} short
          </Badge>
        )}
      </span>
      <div className="ml-auto flex items-center gap-4">
        {Object.entries(SHIFT_TINTS).map(([key, tint]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-sm border"
              style={{ background: tint.bg }}
              aria-hidden="true"
            />
            {tint.label}
          </span>
        ))}
      </div>
    </div>
  );
}
