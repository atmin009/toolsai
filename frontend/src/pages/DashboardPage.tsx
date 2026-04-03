import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { format } from "date-fns";
import { useI18n } from "@/i18n/I18nContext";

export function DashboardPage() {
  const t = useI18n();
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/summary");
      return data as {
        totalWebsites: number;
        plannedTopicsThisMonth: number;
        approvedTopics: number;
        articleDrafts: number;
        readyToPublish: number;
        upcomingSchedule: { id: string; title: string; date: string; status: string; websiteName: string }[];
      };
    },
  });

  if (q.isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("dashboard.title")} description={t("common.loading")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse border-0 ring-1 ring-zinc-200/80">
              <CardContent className="h-24 p-6" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div>
        <PageHeader title={t("dashboard.title")} />
        <p className="text-sm text-red-600">{t("dashboard.loadError")}</p>
      </div>
    );
  }

  const d = q.data!;
  const stats = [
    { label: t("dashboard.stat.websites"), value: d.totalWebsites, hint: t("dashboard.stat.websitesHint") },
    { label: t("dashboard.stat.planned"), value: d.plannedTopicsThisMonth, hint: t("dashboard.stat.plannedHint") },
    { label: t("dashboard.stat.approved"), value: d.approvedTopics, hint: t("dashboard.stat.approvedHint") },
    { label: t("dashboard.stat.drafts"), value: d.articleDrafts, hint: t("dashboard.stat.draftsHint") },
    { label: t("dashboard.stat.ready"), value: d.readyToPublish, hint: t("dashboard.stat.readyHint") },
  ];

  return (
    <div className="space-y-10">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.desc")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums text-zinc-900">{s.value}</div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t("dashboard.upcoming7")}</CardTitle>
            <p className="text-sm text-[var(--color-muted)]">{t("dashboard.upcomingSub")}</p>
          </div>
          <TrendingUp className="h-5 w-5 text-violet-500" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="divide-y divide-[var(--color-border)]">
            {d.upcomingSchedule.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-[var(--color-muted)]">{t("dashboard.noUpcoming")}</p>
            )}
            {d.upcomingSchedule.map((row) => (
              <Link
                key={row.id}
                to={`/topics/${row.id}/review`}
                className="group flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium text-zinc-900 group-hover:text-violet-700">
                    {row.title}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">{row.websiteName}</div>
                </div>
                <div className="text-xs tabular-nums text-[var(--color-muted)]">{format(new Date(row.date), "MMM d · HH:mm")}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
