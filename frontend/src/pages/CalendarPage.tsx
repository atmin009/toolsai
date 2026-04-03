import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useI18n } from "@/i18n/I18nContext";

export function CalendarPage() {
  const tr = useI18n();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);

  const topics = useQuery({
    queryKey: ["topics-calendar", year, month],
    queryFn: async () => {
      const { data } = await api.get("/topics");
      return data as {
        items: {
          id: string;
          proposedTitle: string;
          recommendedPublishDate: string;
          status: string;
          monthlyPlan: { websiteId: string; year: number; month: number };
        }[];
      };
    },
  });

  const days = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    const ms = startOfMonth(d);
    const me = endOfMonth(d);
    return eachDayOfInterval({
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    });
  }, [year, month]);

  const filtered =
    topics.data?.items.filter((t) => t.monthlyPlan.year === year && t.monthlyPlan.month === month) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title={tr("calendar.title")} description={tr("calendar.desc")} />

      <div className="flex flex-wrap gap-6">
        <div className="space-y-2">
          <Label htmlFor="cal-year">Year</Label>
          <Input id="cal-year" className="w-[120px]" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cal-month">Month</Label>
          <Input
            id="cal-month"
            className="w-[100px]"
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs md:gap-3 md:text-sm">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)] md:text-xs"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dayTopics = filtered.filter((t) => isSameDay(new Date(t.recommendedPublishDate), day));
          const inMonth = isSameMonth(day, new Date(year, month - 1, 1));
          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-[100px] flex-col rounded-xl border border-[var(--color-border)] p-2 shadow-sm md:min-h-[120px] md:p-3 ${
                inMonth ? "bg-[var(--color-surface)]" : "bg-zinc-100/50"
              }`}
            >
              <div className={`mb-2 text-xs font-semibold ${inMonth ? "text-zinc-600" : "text-zinc-300"}`}>{format(day, "d")}</div>
              <div className="flex flex-1 flex-col gap-1.5">
                {dayTopics.map((t) => (
                  <Link
                    key={t.id}
                    to={`/topics/${t.id}/review`}
                    className="rounded-lg bg-violet-50 px-2 py-1.5 text-[10px] leading-snug text-violet-950 ring-1 ring-violet-100 transition-colors hover:bg-violet-100 md:text-[11px]"
                  >
                    <span className="line-clamp-2 block font-medium">{t.proposedTitle}</span>
                    <div className="mt-1">
                      <StatusBadge status={t.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>This month</CardTitle>
          <CardDescription>{filtered.length} topics scheduled</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link className="font-medium text-violet-700 hover:underline" to={`/topics/${t.id}/review`}>
                      {t.proposedTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={t.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
