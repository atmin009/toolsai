import { clsx } from "clsx";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

type Props = {
  year: number;
  month: number;
  startDay: number | null;
  endDay: number | null;
  onChange: (next: { startDay: number | null; endDay: number | null }) => void;
  disabled?: boolean;
  weekdayLabels: string[];
  labels: {
    title: string;
    hint: string;
    clear: string;
  };
};

/**
 * Month grid: first click = start, second click = end (inclusive). Third click restarts.
 */
export function PlannerRangePicker({ year, month, startDay, endDay, onChange, disabled, weekdayLabels, labels }: Props) {
  const monthStart = new Date(year, month - 1, 1);
  const ms = startOfMonth(monthStart);
  const me = endOfMonth(monthStart);
  const days = eachDayOfInterval({
    start: startOfWeek(ms, { weekStartsOn: 1 }),
    end: endOfWeek(me, { weekStartsOn: 1 }),
  });

  const lo = startDay != null && endDay != null ? Math.min(startDay, endDay) : null;
  const hi = startDay != null && endDay != null ? Math.max(startDay, endDay) : null;

  const handleDayClick = (dayOfMonth: number) => {
    if (disabled) return;
    if (startDay == null || (startDay != null && endDay != null)) {
      onChange({ startDay: dayOfMonth, endDay: null });
      return;
    }
    if (startDay != null && endDay == null) {
      onChange({ startDay, endDay: dayOfMonth });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-800">{labels.title}</p>
        <button
          type="button"
          disabled={disabled || (startDay == null && endDay == null)}
          className="text-xs font-medium text-violet-700 underline-offset-2 hover:underline disabled:opacity-40"
          onClick={() => onChange({ startDay: null, endDay: null })}
        >
          {labels.clear}
        </button>
      </div>
      <p className="text-xs text-[var(--color-muted)]">{labels.hint}</p>
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-sm">
        <p className="mb-2 text-center text-xs font-semibold text-zinc-700">
          {format(monthStart, "MMMM yyyy")}
        </p>
        <div className="grid grid-cols-7 gap-1 text-[10px] md:gap-1.5 md:text-xs">
          {weekdayLabels.map((d) => (
            <div key={d} className="py-1 text-center font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const inMonth = isSameMonth(day, monthStart);
            const n = inMonth ? day.getDate() : null;
            const inRange = inMonth && n != null && lo != null && hi != null && n >= lo && n <= hi;
            const pickingStartOnly = startDay != null && endDay == null;
            const isAnchor = inMonth && n != null && pickingStartOnly && n === startDay;
            const isEdge =
              inMonth && n != null && lo != null && hi != null && endDay != null && (n === lo || n === hi);

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled || !inMonth || n == null}
                onClick={() => n != null && handleDayClick(n)}
                className={clsx(
                  "flex aspect-square min-h-[2rem] items-center justify-center rounded-lg text-xs font-medium transition-colors md:min-h-[2.25rem]",
                  !inMonth && "invisible pointer-events-none",
                  inMonth && !inRange && !isAnchor && "text-zinc-700 hover:bg-violet-50",
                  inRange && !isEdge && "bg-violet-200/90 text-violet-950",
                  isEdge && "bg-violet-600 text-white",
                  isAnchor && "bg-violet-500 text-white ring-2 ring-violet-300"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
