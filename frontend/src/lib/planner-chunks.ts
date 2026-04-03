/** How the monthly planner splits API calls (besides one-shot full month). */
export type PlannerGranularity = "full" | "day" | "three" | "week";

/** Inclusive day-of-month bounds (1…daysInMonth). */
export type PlannerDayRange = { minDay: number; maxDay: number };

/**
 * Build inclusive day ranges. `null` = single `POST` without `chunk` (entire calendar month only).
 * With `range`, only days within [minDay, maxDay] are planned.
 */
export function buildPlannerDayChunks(
  daysInMonth: number,
  g: PlannerGranularity,
  range?: PlannerDayRange | null
): { from: number; to: number }[] | null {
  const lo = Math.max(1, Math.min(range?.minDay ?? 1, daysInMonth));
  const hi = Math.max(lo, Math.min(range?.maxDay ?? daysInMonth, daysInMonth));

  if (g === "full") {
    if (lo === 1 && hi === daysInMonth) return null;
    return [{ from: lo, to: hi }];
  }

  if (g === "day") {
    const out: { from: number; to: number }[] = [];
    for (let d = lo; d <= hi; d++) out.push({ from: d, to: d });
    return out;
  }

  if (g === "three") {
    const out: { from: number; to: number }[] = [];
    let start = lo;
    while (start <= hi) {
      out.push({ from: start, to: Math.min(start + 2, hi) });
      start += 3;
    }
    return out;
  }

  if (g === "week") {
    const out: { from: number; to: number }[] = [];
    let start = lo;
    while (start <= hi) {
      out.push({ from: start, to: Math.min(start + 6, hi) });
      start += 7;
    }
    return out;
  }

  return null;
}
