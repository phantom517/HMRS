/* Tints per shift family — kept in ONE place so legend and cells always match */
export const SHIFT_TINTS: Record<string, { bg: string; label: string }> = {
  day: { bg: "var(--linen)", label: "Day shifts" },
  night: { bg: "var(--apricot)", label: "Night shifts" },
  oncall: { bg: "var(--parchment)", label: "On-call / standby" },
};
