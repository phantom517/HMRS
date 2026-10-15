// Ambient types for @sbmdkl/nepali-date-converter@2.0.5.
// Its package.json "exports" map does not surface its bundled types/index.d.ts,
// so declare the narrow surface lib/calendar actually uses (MIT, engine pinned exact).
declare module "@sbmdkl/nepali-date-converter" {
  /** Convert Gregorian 'YYYY-MM-DD' (AD 1921-2040) to BS 'YYYY-MM-DD' (western digits). Throws on out-of-range. */
  export function adToBs(adDate: string): string; // e.g. '2083-06-27'
  /** Convert BS 'YYYY-MM-DD' (BS 1978-2099) to Gregorian 'YYYY-MM-DD'. Throws on out-of-range. */
  export function bsToAd(bsDate: string): string;
  /** Age from a BS 'YYYY-MM-DD' (not used by lib/calendar). */
  export function calculateAge(bsDate: string): { year: number; month: number; day: number };
}
