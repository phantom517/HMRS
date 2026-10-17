"use client";

import type { WeekDate } from "@/lib/schedule-cycle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/* ─── Mobile Day Selector (visible on small screens) ────────────────────── */

export function MobileDaySelector({
  dates,
  selectedDayMobile,
  onSelect,
}: {
  dates: WeekDate[];
  selectedDayMobile: string;
  onSelect: (day: string) => void;
}) {
  return (
    <ToggleGroup
      className="mobile-day-selector hidden flex-wrap items-center gap-1.5 py-1"
      value={[selectedDayMobile]}
      onValueChange={(value) => {
        const next = value[0];
        if (next) onSelect(next);
      }}
      spacing={6}
    >
      <ToggleGroupItem value="all" className="rounded-lg px-3.5 py-1.5 text-[13px]">
        All 7 Days
      </ToggleGroupItem>
      {dates.map((d) => (
        <ToggleGroupItem
          key={d.date}
          value={d.date}
          aria-label={d.fullLabel}
          className="rounded-lg px-3 py-1.5 gap-1 text-[12.5px]"
        >
          <span>{d.weekday}</span>
          <span className="opacity-65">{d.dayNumber}</span>
          {d.isToday && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
