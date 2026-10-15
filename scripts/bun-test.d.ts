// Minimal ambient types for bun:test (Bun runs the tests natively; we only type-check them).
declare module "bun:test" {
  export function describe(name: string, fn: (this: any) => void): void;
  export function it(name: string, fn: (this: any) => void | Promise<void>): void;
  export function expect(actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: unknown): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toHaveLength(n: number): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
  };
}
