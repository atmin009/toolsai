import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, LayoutList, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nativeSelectClass } from "@/lib/input-classes";
import { PlannerRangePicker } from "@/components/planner/PlannerRangePicker";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPlannerDayChunks, type PlannerGranularity } from "@/lib/planner-chunks";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { useI18n } from "@/i18n/I18nContext";

const PLANNER_LIST_PAGE_SIZE = 20;

export function PlannerPage() {
  const tr = useI18n();
  const qc = useQueryClient();
  const weekDayLabels = tr("planner.weekdays").split(",");
  const websites = useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const { data } = await api.get("/websites");
      return data as { items: { id: string; name: string }[] };
    },
  });

  const [websiteId, setWebsiteId] = useState("");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [granularity, setGranularity] = useState<PlannerGranularity>("week");
  const [limitRange, setLimitRange] = useState(false);
  const [rangeStartDay, setRangeStartDay] = useState<number | null>(null);
  const [rangeEndDay, setRangeEndDay] = useState<number | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [listPage, setListPage] = useState(1);
  /** Incremental planner: which day-range chunk is running */
  const [chunkProgress, setChunkProgress] = useState<{
    current: number;
    total: number;
    from: number;
    to: number;
  } | null>(null);

  const planQuery = useQuery({
    queryKey: ["planner", websiteId, year, month],
    enabled: !!websiteId,
    queryFn: async () => {
      const { data } = await api.get("/planner", { params: { websiteId, year, month } });
      return data as {
        plan: { id: string; postsPerDay: number } | null;
        topics: {
          id: string;
          proposedTitle: string;
          recommendedPublishDate: string;
          status: string;
        }[];
      };
    },
  });

  /** One-shot full month can be large; split modes use shorter per-request budget. */
  const PLANNER_FULL_MONTH_TIMEOUT_MS = 300_000;
  const PLANNER_CHUNK_TIMEOUT_MS = 150_000;

  const generateAbortRef = useRef<AbortController | null>(null);
  /** True when the last run used `POST` without `chunk` (full calendar month). */
  const noChunkSingleRequestRef = useRef(false);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const effectiveRange = useMemo((): { minDay: number; maxDay: number } | null => {
    if (!limitRange) return { minDay: 1, maxDay: daysInMonth };
    if (rangeStartDay == null || rangeEndDay == null) return null;
    const lo = Math.min(rangeStartDay, rangeEndDay);
    const hi = Math.max(rangeStartDay, rangeEndDay);
    return { minDay: Math.max(1, lo), maxDay: Math.min(hi, daysInMonth) };
  }, [limitRange, daysInMonth, rangeStartDay, rangeEndDay]);

  useEffect(() => {
    setRangeStartDay(null);
    setRangeEndDay(null);
  }, [year, month]);

  useEffect(() => {
    setListPage(1);
  }, [websiteId, year, month]);

  const canGenerate = !!websiteId && (!limitRange || (rangeStartDay != null && rangeEndDay != null));

  const generate = useMutation({
    mutationFn: async () => {
      generateAbortRef.current?.abort();
      const ac = new AbortController();
      generateAbortRef.current = ac;
      noChunkSingleRequestRef.current = false;

      const range = effectiveRange;
      if (!range) throw new Error("Invalid range");

      const chunks = buildPlannerDayChunks(daysInMonth, granularity, range);

      try {
        let last: unknown;

        if (chunks === null) {
          noChunkSingleRequestRef.current = true;
          setChunkProgress({ current: 1, total: 1, from: 1, to: daysInMonth });
          const { data } = await api.post(
            "/planner/generate",
            { websiteId, year, month, postsPerDay },
            { signal: ac.signal, timeout: PLANNER_FULL_MONTH_TIMEOUT_MS }
          );
          last = data;
          await qc.invalidateQueries({ queryKey: ["planner", websiteId, year, month] });
          return last;
        }

        const fullMonthFirstChunkClearsPlan =
          range.minDay === 1 && range.maxDay === daysInMonth && chunks.length > 0;

        for (let i = 0; i < chunks.length; i++) {
          const { from, to } = chunks[i];
          setChunkProgress({ current: i + 1, total: chunks.length, from, to });
          const resetMonth = i === 0 && fullMonthFirstChunkClearsPlan;
          const { data } = await api.post(
            "/planner/generate",
            {
              websiteId,
              year,
              month,
              postsPerDay,
              chunk: { fromDay: from, toDay: to, resetMonth },
            },
            { signal: ac.signal, timeout: PLANNER_CHUNK_TIMEOUT_MS }
          );
          last = data;
          await qc.invalidateQueries({ queryKey: ["planner", websiteId, year, month] });
        }
        return last;
      } finally {
        setChunkProgress(null);
        if (generateAbortRef.current === ac) generateAbortRef.current = null;
      }
    },
    onSuccess: () => {
      noChunkSingleRequestRef.current = false;
      qc.invalidateQueries({ queryKey: ["planner", websiteId, year, month] });
    },
  });

  const cancelGenerate = () => {
    generateAbortRef.current?.abort();
  };

  const generateErrorInfo = (
    err: unknown
  ): { tone: "error" | "muted"; text: string } => {
    if (axios.isAxiosError(err)) {
      if (err.code === "ERR_CANCELED") return { tone: "muted", text: tr("planner.cancelledDone") };
      const msg = (err.response?.data as { error?: string } | undefined)?.error;
      if (msg) return { tone: "error", text: msg };
      if (err.code === "ECONNABORTED")
        return {
          tone: "error",
          text: noChunkSingleRequestRef.current ? tr("planner.errorTimeoutFull") : tr("planner.errorTimeout"),
        };
      if (!err.response) return { tone: "error", text: tr("planner.errorNetwork") };
    }
    if (err instanceof Error && err.message) return { tone: "error", text: err.message };
    return { tone: "error", text: tr("planner.errorGeneric") };
  };

  const days = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    const ms = startOfMonth(d);
    const me = endOfMonth(d);
    return eachDayOfInterval({
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    });
  }, [year, month]);

  const topics = planQuery.data?.topics ?? [];

  const topicsListSlice = useMemo(() => {
    const start = (listPage - 1) * PLANNER_LIST_PAGE_SIZE;
    return topics.slice(start, start + PLANNER_LIST_PAGE_SIZE);
  }, [topics, listPage]);

  return (
    <div className="space-y-8">
      <PageHeader title={tr("route.planner.title")} description={tr("planner.desc")} />

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{tr("planner.settings")}</CardTitle>
          <CardDescription>{tr("planner.settingsWarn")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{tr("planner.website")}</Label>
            <select className={nativeSelectClass} value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
              <option value="">{tr("planner.selectWebsite")}</option>
              {websites.data?.items.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{tr("planner.year")}</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>{tr("planner.month")}</Label>
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>{tr("planner.postsPerDay")}</Label>
            <Input type="number" min={1} max={20} value={postsPerDay} onChange={(e) => setPostsPerDay(Number(e.target.value))} />
          </div>
          <div className="space-y-2 md:col-span-2 lg:col-span-4">
            <Label>{tr("planner.granularity")}</Label>
            <select
              className={nativeSelectClass}
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as PlannerGranularity)}
              disabled={generate.isPending}
            >
              <option value="full">{tr("planner.granularityFull")}</option>
              <option value="day">{tr("planner.granularityDay")}</option>
              <option value="three">{tr("planner.granularityThree")}</option>
              <option value="week">{tr("planner.granularityWeek")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--color-border)] text-violet-600 focus:ring-violet-500"
                checked={limitRange}
                disabled={generate.isPending}
                onChange={(e) => {
                  setLimitRange(e.target.checked);
                  if (!e.target.checked) {
                    setRangeStartDay(null);
                    setRangeEndDay(null);
                  }
                }}
              />
              {tr("planner.limitRange")}
            </label>
            {limitRange && (
              <>
                <PlannerRangePicker
                  year={year}
                  month={month}
                  startDay={rangeStartDay}
                  endDay={rangeEndDay}
                  disabled={generate.isPending}
                  weekdayLabels={weekDayLabels}
                  onChange={({ startDay, endDay }) => {
                    setRangeStartDay(startDay);
                    setRangeEndDay(endDay);
                  }}
                  labels={{
                    title: tr("planner.rangePickerTitle"),
                    hint: tr("planner.rangePickerHint"),
                    clear: tr("planner.rangeClear"),
                  }}
                />
                {effectiveRange && rangeStartDay != null && rangeEndDay != null && (
                  <p className="text-sm text-violet-800">
                    {tr("planner.rangeSelected")
                      .replace("{from}", String(effectiveRange.minDay))
                      .replace("{to}", String(effectiveRange.maxDay))}
                  </p>
                )}
                {limitRange && (rangeStartDay == null || rangeEndDay == null) && (
                  <p className="text-sm text-amber-800">{tr("planner.rangeIncomplete")}</p>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="lg" className="gap-2" onClick={() => generate.mutate()} disabled={!canGenerate || generate.isPending}>
                  <Sparkles className="h-4 w-4" />
                  {generate.isPending ? tr("planner.generating") : tr("planner.generate")}
                </Button>
                {generate.isPending && (
                  <Button type="button" variant="outline" size="lg" onClick={cancelGenerate}>
                    {tr("planner.cancelGenerate")}
                  </Button>
                )}
              </div>
              {generate.isPending && chunkProgress && (
                <p className="max-w-xl text-sm font-medium text-violet-700" role="status">
                  {tr("planner.chunkStatus")
                    .replace("{from}", String(chunkProgress.from))
                    .replace("{to}", String(chunkProgress.to))
                    .replace("{current}", String(chunkProgress.current))
                    .replace("{total}", String(chunkProgress.total))}
                </p>
              )}
              {generate.isError && (() => {
                const info = generateErrorInfo(generate.error);
                return (
                  <p
                    className={
                      info.tone === "error"
                        ? "max-w-xl text-sm text-red-600"
                        : "max-w-xl text-sm text-[var(--color-muted)]"
                    }
                    role="status"
                  >
                    {info.text}
                  </p>
                );
              })()}
              {websiteId && (
                <p className="max-w-xl text-xs text-[var(--color-muted)]">{tr("planner.generateSlowHint")}</p>
              )}
            </div>
            <div className="flex gap-2 rounded-xl border border-[var(--color-border)] bg-zinc-50/80 p-1">
              <Button
                type="button"
                variant={view === "calendar" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
                onClick={() => setView("calendar")}
              >
                <Calendar className="h-4 w-4" />
                {tr("planner.viewCalendar")}
              </Button>
              <Button
                type="button"
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
                onClick={() => setView("list")}
              >
                <LayoutList className="h-4 w-4" />
                {tr("planner.viewList")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!websiteId && <p className="text-sm text-[var(--color-muted)]">{tr("planner.selectHint")}</p>}

      {websiteId && planQuery.isLoading && <p className="text-sm text-[var(--color-muted)]">{tr("planner.loadingPlan")}</p>}

      {websiteId && planQuery.data && !planQuery.data.plan && (
        <p className="text-sm text-[var(--color-muted)]">{tr("planner.noPlan")}</p>
      )}

      {websiteId && planQuery.data?.plan && view === "list" && (
        <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
          <CardHeader>
            <CardTitle>{tr("planner.topicsTitle")}</CardTitle>
            <CardDescription>
              {topics.length} {tr("planner.items")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("planner.colTitle")}</TableHead>
                    <TableHead>{tr("planner.colDate")}</TableHead>
                    <TableHead className="text-right">{tr("planner.colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topicsListSlice.map((topic) => (
                    <TableRow key={topic.id}>
                      <TableCell className="min-w-[12rem] max-w-[min(100vw-6rem,28rem)]">
                        <Link className="break-words font-medium text-violet-700 hover:underline" to={`/topics/${topic.id}/review`}>
                          {topic.proposedTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[var(--color-muted)]">
                        {format(new Date(topic.recommendedPublishDate), "PPP")}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={topic.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {topics.length > 0 && (
              <PaginationControls
                page={listPage}
                total={topics.length}
                pageSize={PLANNER_LIST_PAGE_SIZE}
                onPageChange={setListPage}
              />
            )}
          </CardContent>
        </Card>
      )}

      {websiteId && planQuery.data?.plan && view === "calendar" && (
        <div className="w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <div className="grid min-w-[640px] grid-cols-7 gap-2 text-xs md:min-w-0 md:gap-3 md:text-sm">
            {weekDayLabels.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)] md:text-xs">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayTopics = topics.filter((topic) => isSameDay(new Date(topic.recommendedPublishDate), day));
              const inMonth = isSameMonth(day, new Date(year, month - 1, 1));
              return (
                <div
                  key={day.toISOString()}
                  className={`flex min-h-[96px] flex-col rounded-xl border border-[var(--color-border)] p-2 shadow-sm md:min-h-[128px] md:p-3 ${
                    inMonth ? "bg-[var(--color-surface)]" : "bg-zinc-100/50"
                  }`}
                >
                  <div className={`mb-1 shrink-0 text-xs font-semibold ${inMonth ? "text-zinc-600" : "text-zinc-300"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin] max-h-[min(220px,42vh)]">
                    <div className="flex flex-col gap-1.5 pb-0.5">
                      {dayTopics.map((topic) => (
                        <Link
                          key={topic.id}
                          to={`/topics/${topic.id}/review`}
                          className="block rounded-lg bg-violet-50 px-2 py-1.5 text-[10px] font-medium leading-snug text-violet-950 ring-1 ring-violet-100 transition-colors hover:bg-violet-100 md:text-[11px]"
                        >
                          <span className="block break-words">{topic.proposedTitle}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
