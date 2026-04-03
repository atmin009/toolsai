import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClass } from "@/lib/input-classes";
import { useI18n } from "@/i18n/I18nContext";

export function ArticlesPage() {
  const t = useI18n();
  const [websiteId, setWebsiteId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "updated" | "title">("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const websites = useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const { data } = await api.get("/websites");
      return data as { items: { id: string; name: string }[] };
    },
  });

  const articles = useQuery({
    queryKey: ["articles", websiteId, status, q, sortBy, order],
    queryFn: async () => {
      const { data } = await api.get("/articles", {
        params: {
          websiteId: websiteId || undefined,
          status: status || undefined,
          q: q.trim() || undefined,
          sortBy,
          order,
        },
      });
      return data as {
        items: {
          id: string;
          language: string;
          articleLength: string | null;
          metaTitle: string | null;
          plannedTopic: {
            id: string;
            proposedTitle: string;
            status: string;
            recommendedPublishDate: string;
            source: string;
          };
        }[];
      };
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader title={t("articles.title")} description={t("articles.desc")} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Website</Label>
          <select className={nativeSelectClass + " min-w-[200px]"} value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
            <option value="">All</option>
            {websites.data?.items.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Topic status</Label>
          <select className={nativeSelectClass + " min-w-[180px]"} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="draft_topic">Draft topic</option>
            <option value="approved_topic">Approved</option>
            <option value="generating_article">Generating</option>
            <option value="article_draft">Article draft</option>
            <option value="ready_for_publish">Ready</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Search</Label>
          <Input className="w-[220px]" placeholder="Title or keyword…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Sort</Label>
          <select
            className={nativeSelectClass + " min-w-[140px]"}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "updated" | "title")}
          >
            <option value="date">Publish date</option>
            <option value="updated">Updated</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Order</Label>
          <select className={nativeSelectClass + " min-w-[100px]"} value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>Library</CardTitle>
          <CardDescription>{articles.data?.items.length ?? 0} articles</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-0">
          {articles.isLoading && <p className="p-6 text-sm text-[var(--color-muted)]">Loading…</p>}
          {!articles.isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Lang / length</TableHead>
                  <TableHead>Topic status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.data?.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.metaTitle ?? a.plannedTopic.proposedTitle}</TableCell>
                    <TableCell className="text-[var(--color-muted)]">
                      {a.language}
                      {a.articleLength ? ` · ${a.articleLength}` : ""}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.plannedTopic.status} />
                    </TableCell>
                    <TableCell className="capitalize text-[var(--color-muted)]">{a.plannedTopic.source}</TableCell>
                    <TableCell className="text-right">
                      <Link className="text-violet-700 hover:underline" to={`/articles/${a.id}/edit`}>
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
