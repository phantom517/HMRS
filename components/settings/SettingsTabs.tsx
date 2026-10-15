"use client";

// components/settings/SettingsTabs.tsx — the URL-driven tab strip (B1):
// 40px tall, 16px horizontal padding, 4px gap, 15px text. Active = paper +
// hairline + weight 500. Counts are a separate span with an 8px gap in 13px
// tertiary ink — ONLY on "Assistants", and only when the count is > 0.
// Focus ring is a 2px ink outline with 2px offset, shown only on
// :focus-visible so it is never mistaken for the active state.

export interface TabDef {
  id: string;
  label: string;
  /** Only rendered when > 0, and ONLY honored on the Assistants tab. */
  count?: number;
}

export function SettingsTabs({
  tabs,
  activeId,
  onTabChange,
}: {
  tabs: TabDef[];
  activeId: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Settings sections" className="flex w-fit items-center gap-1 self-start">
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        // Count rule: only the Assistants tab may render one, hidden at 0.
        const count =
          tab.id === "assistants" && typeof tab.count === "number" && tab.count > 0
            ? tab.count
            : null;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`${tab.label}${count != null ? `, ${count} assistants` : ""}`}
            onClick={() => onTabChange(tab.id)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[15px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ink)"
            style={{
              background: selected ? "var(--paper)" : "transparent",
              color: selected ? "var(--ink)" : "var(--ink-secondary)",
              border: `1px solid ${selected ? "var(--ink-border)" : "transparent"}`,
              fontWeight: selected ? 500 : 400,
            }}
          >
            <span>{tab.label}</span>
            {count != null && (
              <span className="text-[13px] font-normal text-(--ink-tertiary)">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
