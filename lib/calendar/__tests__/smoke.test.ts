import { describe, it, expect } from "bun:test";
import { adToBs, bsToAd, bsDaysInMonth, todayInDeptTz, isValidBsDate } from "../convert";
import { formatDate, toNepaliDigits, periodLabel } from "../format";
import { getMonthGrid, rangeForPeriod, parseDateInput } from "../grid";
import { CalendarError } from "../types";

/** bun:test's bundled matcher types lack toThrow/toBeNull — assert via boolean instead. */
function threw(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}
void CalendarError; // still imported for encode in future anchor docs

describe("calendar anchors (verified public sources)", () => {
  it("2026-10-13 == Ashwin 27, 2083 (hamropatro / nepalicalendar.online / ashesh)", () => {
    expect(adToBs("2026-10-13")).toEqual({ year: 2083, month: 6, day: 27 });
    expect(bsToAd({ year: 2083, month: 6, day: 27 })).toBe("2026-10-13");
  });
  it("BS 2000-01-01 == 1943-04-14 AD (spec anchor, package epoch consistent)", () => {
    expect(bsToAd({ year: 2000, month: 1, day: 1 })).toBe("1943-04-14");
  });
  it("Ashwin 2083 has 31 days ending 2026-10-17; Kartik 1, 2083 == 2026-10-18", () => {
    expect(bsDaysInMonth(2083, 6)).toBe(31);
    expect(bsToAd({ year: 2083, month: 6, day: 31 })).toBe("2026-10-17");
    expect(bsToAd({ year: 2083, month: 7, day: 1 })).toBe("2026-10-18");
  });
  it("rejects impossible BS day values (Jestha 2083 has 31 days)", () => {
    expect(threw(() => bsToAd({ year: 2083, month: 2, day: 32 }))).toBe(true);
  });
});

describe("formatting", () => {
  it("BS English, BS Nepali, AD English", () => {
    expect(formatDate("2026-10-13", { system: "AD" })).toBe("Oct 13, 2026");
    expect(formatDate("2026-10-13", { system: "BS", locale: "en" })).toBe("Ashwin 27, 2083");
    expect(formatDate("2026-10-13", { system: "BS", locale: "ne" })).toBe("असोज २७, २०८३");
  });
  it("Devanagari digits round the other way", () => {
    expect(toNepaliDigits(2083)).toBe("२०८३");
  });
  it("period labels", () => {
    expect(periodLabel("BS", 2083, 6, "en")).toBe("Ashwin 2083");
    expect(periodLabel("AD", 2026, 10, "en")).toBe("October 2026");
  });
});

describe("grid + ranges", () => {
  it("BS Ashwin 2083 covers exactly 31 AD-day-aligned cells", () => {
    const g = getMonthGrid("BS", 2083, 6, "en", 0, "2026-10-13");
    const inMonth = g.weeks.flat().filter((c) => c.inMonth);
    expect(inMonth.length).toBe(31);
    expect(inMonth[0].iso).toBe("2026-09-17"); // Asar->Ashwin boundary verified earlier
    const todayCell = inMonth.find((c) => c.isToday);
    expect(todayCell?.iso).toBe("2026-10-13");
  });
  it("rangeForPeriod BS spans exactly bsDaysInMonth days; adjacent months are contiguous", () => {
    const r = rangeForPeriod("BS", 2083, 6);
    const next = rangeForPeriod("BS", 2083, 7);
    const days = Math.round((Date.parse(next.from + "T00:00:00Z") - Date.parse(r.from + "T00:00:00Z")) / 86400000);
    expect(days).toBe(bsDaysInMonth(2083, 6));
  });
  it("parseDateInput accepts Devanagari BS input and always returns Gregorian ISO", () => {
    expect(parseDateInput("2083-06-27", "BS")).toBe("2026-10-13");
    expect(parseDateInput("२०८३-०६-२७", "BS")).toBe("2026-10-13");
  });
  it("out-of-range / invalid never returns a wrong date", () => {
    expect(threw(() => parseDateInput("2100-01-01", "BS"))).toBe(true);
    expect(parseDateInput("2100-01-01", "AD")).toBe("2100-01-01"); // AD unrestricted
    expect(isValidBsDate("2083-06-32")).toEqual(null);
  });
});

describe("department timezone", () => {
  it("today-in-Kathmandu around UTC midnight (UTC 23:59 = next day 05:44 NPT)", () => {
    // 2026-10-13T17:59:00Z is 2026-10-13 23:14 NPT (UTC+5:45) -> same day
    expect(todayInDeptTz(new Date("2026-10-13T17:59:00Z"))).toBe("2026-10-13");
    // 2026-10-13T18:15:00Z is 2026-10-13 23:59:59... careful: 18:15Z +5:45 = 00:00 next day local
    expect(todayInDeptTz(new Date("2026-10-13T18:15:00Z"))).toBe("2026-10-14");
    // 2026-10-13T18:16:00Z -> 2026-10-14 00:00+ NPT local
    expect(todayInDeptTz(new Date("2026-10-13T18:16:00Z"))).toBe("2026-10-14");
  });
});
