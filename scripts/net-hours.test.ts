import { describe, it, expect } from "bun:test";
import { computedNetHours } from "../lib/schedule-cycle";

describe("computedNetHours (paid hours)", () => {
  it("computes a plain day shift with a break", () => {
    // 08:00-16:00 with 30 min break → 7.5 h
    expect(computedNetHours("08:00", "16:00", 30)).toBe(7.5);
  });

  it("computes an overnight night shift correctly", () => {
    // 22:00-06:00 = 8 h raw, minus 30 min break → 7.5 h
    expect(computedNetHours("22:00", "06:00", 30)).toBe(7.5);
  });

  it("respects the crossesMidnight flag when times equal raw hours", () => {
    expect(computedNetHours("22:00", "06:30", 45, true)).toBe(7.75);
  });

  it("handles the seed Day shift 07:00-15:30 with 30 min break", () => {
    expect(computedNetHours("07:00", "15:30", 30)).toBe(8);
  });

  it("handles a clinic shift 09:00-17:00 with 30 min break", () => {
    expect(computedNetHours("09:00", "17:00", 30)).toBe(7.5);
  });

  it("returns 0 when the break exceeds the shift length", () => {
    expect(computedNetHours("09:00", "09:10", 30)).toBe(0);
  });
});
