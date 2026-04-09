import { useEffect, useState } from "react";

interface Step {
  label: string;
  done?: boolean;
}

interface AiProgressBarProps {
  /** Show/hide the entire bar */
  active: boolean;
  /** Optional list of steps; highlights current (first not-done) */
  steps?: Step[];
  /** Single status message when steps are not used */
  message?: string;
  /** Estimated total seconds (affects fake progress speed). Default 30. */
  estimatedSeconds?: number;
}

export function AiProgressBar({ active, steps, message, estimatedSeconds = 30 }: AiProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    setProgress(2);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const remaining = 92 - p;
        const step = Math.max(0.15, remaining / (estimatedSeconds * 2));
        return Math.min(92, p + step);
      });
    }, 500);
    return () => clearInterval(interval);
  }, [active, estimatedSeconds]);

  if (!active) return null;

  const currentStepIdx = steps?.findIndex((s) => !s.done) ?? -1;

  return (
    <div className="w-full space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      {/* Bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-violet-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 animate-pulse rounded-full bg-white/30" />
      </div>

      {/* Steps or message */}
      {steps && steps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
          {steps.map((step, i) => {
            const isCurrent = i === currentStepIdx;
            const isDone = step.done;
            return (
              <span
                key={i}
                className={
                  isDone
                    ? "text-emerald-600"
                    : isCurrent
                      ? "text-violet-700 animate-pulse"
                      : "text-zinc-400"
                }
              >
                {isDone ? "\u2713 " : isCurrent ? "\u25B6 " : "\u25CB "}
                {step.label}
              </span>
            );
          })}
        </div>
      ) : message ? (
        <p className="text-xs font-medium text-violet-700 animate-pulse">{message}</p>
      ) : (
        <p className="text-xs font-medium text-violet-700 animate-pulse">AI is working...</p>
      )}
    </div>
  );
}
