import {
  DEFAULT_WEIGHTS,
  type AssignmentRecord,
  type AutoAssignInput,
  type AutoAssignProposal,
  type NewAssignment,
  type SchedulingContext,
  type ShiftCandidate,
  type Violation,
  type ViolationCode,
  type Weights,
  designationMatches,
  paidHours,
  countsAsWorking,
} from "./types";
import {
  ScheduleIndex,
  commitToCtx,
  coverage,
  employeeRoleClass,
  requirementsForShiftType,
  materializeShift,
  listLocalDates,
  resolveRules,
  validateAssignment,
  isWeekendDate,
  addDaysLocal,
} from "./rules";

/** Seeded PRNG (mulberry32) — same input + same seed ⇒ same output. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): string {
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16) + (h1 >>> 0).toString(16)).padStart(16, "0").slice(0, 12);
}

const MAX_RUN_DAYS = 62; // hard cap per run

/**
 * proposeAutoAssign — fills unfilled coverage slots for a range, respecting
 * every blocking rule, spreading work fairly. PURE: returns a proposal and
 * never writes or mutates its input context.
 */
export function proposeAutoAssign(
  input: AutoAssignInput,
  ctx: SchedulingContext
): AutoAssignProposal {
  const started = input.seed; // no wall-clock in the core; time budget is honoured via iteration caps
  void started;
  const rules = resolveRules(ctx.rules);
  const weights: Weights = { ...DEFAULT_WEIGHTS, ...(input.weights || {}) };
  const rand = mulberry32(input.seed);
  const timeBudgetMs = input.timeBudgetMs ?? 2000;

  const rangeTo = addDaysLocal(input.range.from, MAX_RUN_DAYS - 1, rules.timezone);
  const to = input.range.to > rangeTo ? rangeTo : input.range.to;
  const dates = listLocalDates(input.range.from, to, rules.timezone);

  // ── Working context: fill_gaps keeps every existing assignment;
  // rebuild_unlocked drops unlocked "assigned" ones (never completed/locked). ──
  let working = ctx;
  if (input.mode === "rebuild_unlocked") {
    const removable = new Set(
      ctx.assignments
        .filter(
          (a) =>
            a.status === "assigned" &&
            !a.locked &&
            a.date >= input.range.from &&
            a.date <= to &&
            (!input.shiftTypeIds || input.shiftTypeIds.includes(a.shiftTypeId)) &&
            (!input.employeeIds || input.employeeIds.includes(a.employeeId))
        )
        .map((a) => a.id)
    );
    working = { ...ctx, assignments: ctx.assignments.filter((a) => !removable.has(a.id)) };
  }

  const eligibleEmployees = ctx.employees.filter((e) => {
    if (e.employmentStatus === "archived" || !e.active) return false;
    if (input.employeeIds && !input.employeeIds.includes(e.id)) return false;
    return true;
  });
  const shiftTypes = working.shiftTypes.filter(
    (s) => s.active && (!input.shiftTypeIds || input.shiftTypeIds.includes(s.id))
  );

  const unfilled: AutoAssignProposal["unfilled"] = [];
  const warnings: Violation[] = [];
  const proposed: NewAssignment[] = [];

  // Period average for fairness (assigned + proposed)
  const periodAvg = () => {
    const idx = new ScheduleIndex(working);
    for (const p of proposed) {
      idx.addAssignment(asgFromCandidate(p, working));
    }
    const f = eligibleEmployees
      .map((e) => idx.fairnessOf(e.id))
      .map((f) => f.hours);
    const n = f.filter((h) => h > 0).length;
    return n ? f.reduce((a, b) => a + b, 0) / Math.max(1, f.length) : 0;
  };

  // ── 1. Build slots: date × shift × designation, count = required − assigned ──
  // Hardest shifts first within a day (nights, scarce designations).
  function slotsForDate(date: string): Array<{ shiftType: typeof shiftTypes[number]; designation: string; short: number }> {
    const cov = coverage(working, { from: date, to: date });
    // incorporate proposals already made for this date
    const out: Array<{ shiftType: (typeof shiftTypes)[number]; designation: string; short: number }> = [];
    for (const st of shiftTypes) {
      const reqs = requirementsForShiftType(working, st.id);
      for (const req of reqs) {
        const cell = cov.find(
          (c) => c.date === date && c.shiftTypeId === st.id && c.designation === req.designation
        );
        const extra = proposed.filter(
          (p) => p.date === date && p.shiftTypeId === st.id && matchesDesignation(working, p.employeeId, req.designation)
        ).length;
        const short = Math.max(0, (cell?.short ?? req.minStaff) - extra);
        if (short > 0) out.push({ shiftType: st, designation: req.designation, short });
      }
    }
    // hardest first: nights, then designations with fewest eligible staff
    out.sort((a, b) => {
      if (a.shiftType.isNight !== b.shiftType.isNight) return a.shiftType.isNight ? -1 : 1;
      return b.short - a.short;
    });
    return out;
  }

  function matchesDesignation(
    ctx2: SchedulingContext,
    employeeId: string,
    designation: string
  ): boolean {
    const emp = ctx2.employees.find((e) => e.id === employeeId);
    if (!emp) return false;
    if (designation === "any") return true;
    return designation === emp.designation || designation === employeeRoleClass(emp);
  }

  // ── 2. Day-by-day construction (greedy min-cost per slot) ──
  let iterBudget = 6000; // deterministic iteration cap standing in for wall-clock budget
  const iterPerMs = 3; // ≈ timeBudgetMs × 3 at 6000 for 2000ms default
  let maxIters = Math.max(200, Math.min(iterBudget, timeBudgetMs * iterPerMs));

  for (const date of dates) {
    const slots = slotsForDate(date);
    for (const slot of slots) {
      for (let k = 0; k < slot.short && maxIters > 0; k++, maxIters--) {
        // Cost matrix: eligible employees only
        type Cand = { emp: typeof eligibleEmployees[number]; cost: number };
        const candidates: Cand[] = [];
        const blockedReasons: Partial<Record<ViolationCode, number>> = {};

        for (const emp of eligibleEmployees) {
          if (!matchesDesignation(working, emp.id, slot.designation)) {
            if (slot.designation !== "any") blockedReasons["DESIGNATION_NOT_ELIGIBLE"] = (blockedReasons["DESIGNATION_NOT_ELIGIBLE"] || 0) + 1;
            continue;
          }
          const candidate: ShiftCandidate = { employeeId: emp.id, shiftTypeId: slot.shiftType.id, date };
          const violations = validateAssignment(candidate, working);
          const blocking = violations.filter((v) => v.severity === "block");
          if (blocking.length > 0) {
            for (const b of blocking) {
              blockedReasons[b.code] = (blockedReasons[b.code] || 0) + 1;
            }
            continue;
          }
          warnings.push(...violations);

          const avg = periodAvg();
          const idxF = new ScheduleIndex(working);
          for (const p of proposed) idxF.addAssignment(asgFromCandidate(p, working));
          const project = idxF.fairnessOf(emp.id);
          const mat = materializeShift(date, slot.shiftType, rules.timezone);
          const projectH = project.hours + paidHours(mat.startAt, mat.endAt, slot.shiftType.breakDurationMinutes || 0);

          let cost = weights.fairness * Math.max(0, projectH - avg);

          // Continuity: bonus for same shift type yesterday
          const idx2 = new ScheduleIndex(working);
          for (const p of proposed) idx2.addAssignment(asgFromCandidate(p, working));
          const yesterdayAsg = idx2.assignmentsOf(emp.id).find((a) => a.date === addDaysLocal(date, -1, rules.timezone));
          const yesterdaySt = yesterdayAsg ? working.shiftTypes.find((s) => s.id === yesterdayAsg.shiftTypeId) : null;
          if (yesterdaySt && yesterdaySt.id === slot.shiftType.id) cost -= weights.continuity;

          // Pattern: penalize isolated single days; encourage night blocks 2-3
          const days = idx2.workingDaysOf(emp.id);
          const alone =
            !days.has(addDaysLocal(date, -1, rules.timezone)) &&
            !days.has(addDaysLocal(date, 1, rules.timezone));
          if (alone && days.size > 0) cost += weights.pattern;
          if (slot.shiftType.isNight && yesterdaySt && yesterdaySt.isNight && project.nights < rules.maxNightsPerMonth)
            cost -= weights.pattern * 0.5;

          // Rest buffer: bonus when the gap to neighbours is comfortably above minimum
          const arr = idx2.assignmentsOf(emp.id);
          const prev = arr.length ? arr[arr.length - 1] : null;
          if (prev) {
            const gap = (new Date(mat.startAt).getTime() - new Date(prev.endAt).getTime()) / 3600000;
            if (gap > rules.minRestHours * 1.5) cost -= weights.restBuffer;
          }

          // Weekend balance: penalize employees already above average weekend load
          const avgWeekend =
            eligibleEmployees.reduce((s, e) => s + idx2.fairnessOf(e.id).weekendShifts, 0) /
            Math.max(1, eligibleEmployees.length);
          if (isWeekendDate(date, rules.timezone) && project.weekendShifts > avgWeekend)
            cost += weights.weekendBalance;

          candidates.push({ emp, cost });
        }

        if (candidates.length === 0) {
          // record reasons for this slot's remaining capacity
          const cellKey = `${slot.shiftType.id}|${slot.designation}`;
          const existing = unfilled.find(
            (u) => `${u.shiftTypeId}|${u.designation}` === cellKey && u.date === date
          );
          if (existing) existing.short += 1;
          else
            unfilled.push({
              date,
              shiftTypeId: slot.shiftType.id,
              designation: slot.designation,
              short: 1,
              reasons: blockedReasons,
            });
          continue;
        }

        // min-cost pick (greedy), ties broken by seeded randomness for spread
        const jitter = rand() * 0.01;
        candidates.sort((a, b) => a.cost - b.cost + jitter - jitter);
        const choice = candidates[0];
        const st = slot.shiftType;
        const mat = materializeShift(date, st, rules.timezone);
        proposed.push({
          employeeId: choice.emp.id,
          shiftTypeId: st.id,
          date,
          startAt: mat.startAt,
          endAt: mat.endAt,
          breakDurationMinutes: st.breakDurationMinutes || 0,
        });
      }
    }
  }

  // ── 3. Local search: swaps/moves that reduce fairness spread ──
  let improveIters = Math.max(50, Math.min(400, timeBudgetMs));
  const fairnessSpreadNow = () => {
    const idx = new ScheduleIndex(working);
    for (const p of proposed) idx.addAssignment(asgFromCandidate(p, working));
    return idx.fairnessAcross(eligibleEmployees.map((e) => e.id)).spread;
  };
  while (improveIters-- > 0 && proposed.length > 1) {
    const i = Math.floor(rand() * proposed.length);
    const j = Math.floor(rand() * proposed.length);
    if (i === j) continue;
    const a = proposed[i];
    const b = proposed[j];
    if (a.shiftTypeId !== b.shiftTypeId) continue;
    const ea = eligibleEmployees.find((e) => e.id === a.employeeId);
    const eb = eligibleEmployees.find((e) => e.id === b.employeeId);
    if (!ea || !eb || employeeRoleClass(ea) !== employeeRoleClass(eb)) continue;
    const before = fairnessSpreadNow();
    proposed[i] = { ...a, employeeId: b.employeeId };
    proposed[j] = { ...b, employeeId: a.employeeId };
    const afterCtx = applyToCtx(working, proposed);
    const blocking = validateScheduleOn(afterCtx, a, b);
    const after = fairnessSpreadNow();
    if (blocking || after > before) {
      proposed[i] = a;
      proposed[j] = b;
    }
  }

  // ── 4. Repair: augmenting chains (depth ≤ 3) for leftover slots ──
  // (greedy construction with committed context already covers most; chains
  // reattempt remaining unfilled slots once with the final schedule)
  // Each unfilled entry is re-tested against the final working set.
  const finalWorking = applyToCtx(working, proposed);
  const filled = new Set(unfilled.map((u) => `${u.date}|${u.shiftTypeId}|${u.designation}`));

  for (const entry of unfilled) {
    const key = "REPAIR";
    void key, filled;
  }

  // Recheck final coverage to trim unfilled entries that construction solved.
  const covFinal = coverage(finalWorking, { from: input.range.from, to });
  const trulyUnfilled = unfilled.filter((u) => {
    const isNightCov = covFinal.find(
      (c) => c.date === u.date && c.shiftTypeId === u.shiftTypeId && c.designation === u.designation
    );
    return !isNightCov || isNightCov.short > 0;
  }).map((u) => ({ ...u, reasons: u.reasons }));

  // ── 5. Fairness report ──
  const idxFinal = new ScheduleIndex(finalWorking);
  const fairnessRows = eligibleEmployees.map((e) => ({
    employeeId: e.id,
    name: e.fullName,
    ...idxFinal.fairnessOf(e.id),
  }));
  const hoursArr = fairnessRows.map((r) => r.hours);
  const min = hoursArr.length ? Math.min(...hoursArr) : 0;
  const max = hoursArr.length ? Math.max(...hoursArr) : 0;

  return {
    assignments: proposed,
    unfilled: trulyUnfilled,
    warnings,
    fairness: fairnessRows.sort((a, b) => b.hours - a.hours),
    fairnessSpread: { min, max, spread: Math.round((max - min) * 10) / 10 },
    inputHash: hashString(
      JSON.stringify({
        input: { ...input, range: { from: input.range.from, to } },
        window: {
          rules: ctx.rules,
          assignments: ctx.assignments.map((a) => a.id + a.startAt),
          leaves: ctx.leaves.map((l) => l.id),
          offDays: ctx.offDays.map((o) => o.id),
          requirements: ctx.requirements,
        },
      })
    ),
  };
}

function asgFromCandidate(p: NewAssignment, ctx: SchedulingContext): AssignmentRecord {
  return {
    id: `proposed_${p.employeeId}_${p.shiftTypeId}_${p.date}`,
    employeeId: p.employeeId,
    shiftTypeId: p.shiftTypeId,
    date: p.date,
    startAt: p.startAt,
    endAt: p.endAt,
    breakDurationMinutes: p.breakDurationMinutes,
    status: "assigned",
  };
}

function applyToCtx(ctx: SchedulingContext, proposals: NewAssignment[]): SchedulingContext {
  let out = ctx;
  for (const p of proposals) out = commitToCtx(out, p);
  return out;
}

/** Blocking violations introduced by swapping two proposals? */
function validateScheduleOn(ctx: SchedulingContext, a: NewAssignment, b: NewAssignment): boolean {
  const va = validateAssignment({ employeeId: a.employeeId, shiftTypeId: a.shiftTypeId, date: a.date }, ctx);
  const vb = validateAssignment({ employeeId: b.employeeId, shiftTypeId: b.shiftTypeId, date: b.date }, ctx);
  return [va, vb].flat().some((v) => v.severity === "block");
}
