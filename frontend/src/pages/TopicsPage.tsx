import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Search, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClass } from "@/lib/input-classes";
import { format } from "date-fns";
import { useI18n } from "@/i18n/I18nContext";
import { PaginationControls } from "@/components/PaginationControls";
import { AiProgressBar } from "@/components/AiProgressBar";

const PAGE_SIZE = 20;

export function TopicsPage() {
  const t = useI18n();
  const qc = useQueryClient();
  const [websiteId, setWebsiteId] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "status" | "updated">("date");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualOpen, setManualOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [manual, setManual] = useState({
    websiteId: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    proposedTitle: "",
    primaryKeyword: "",
    secondaryKeywords: "",
    searchIntent: "informational",
    articleType: "guide",
    brief: "",
    recommendedPublishDate: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    setPage(1);
  }, [websiteId, status, source, q, sortBy, order]);

  const websites = useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const { data } = await api.get("/websites");
      return data as { items: { id: string; name: string }[] };
    },
  });

  const topics = useQuery({
    queryKey: ["topics", websiteId, status, source, q, sortBy, order, page],
    queryFn: async () => {
      const { data } = await api.get("/topics", {
        params: {
          websiteId: websiteId || undefined,
          status: status || undefined,
          source: source || undefined,
          q: q.trim() || undefined,
          sortBy,
          order,
          page,
          limit: PAGE_SIZE,
        },
      });
      return data as {
        items: {
          id: string;
          proposedTitle: string;
          recommendedPublishDate: string;
          status: string;
          source?: string;
        }[];
        total: number;
        page: number;
        limit: number;
      };
    },
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/topics/bulk-approve", { ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setSelected(new Set());
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/topics/bulk-delete", { ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setSelected(new Set());
    },
  });

  const bulkGenerate = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/articles/bulk-generate", { ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setSelected(new Set());
    },
  });

  const createManual = useMutation({
    mutationFn: async () => {
      const secondaryKeywords = manual.secondaryKeywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const iso = new Date(manual.recommendedPublishDate).toISOString();
      await api.post("/topics/manual", {
        websiteId: manual.websiteId,
        year: manual.year,
        month: manual.month,
        proposedTitle: manual.proposedTitle,
        primaryKeyword: manual.primaryKeyword,
        secondaryKeywords,
        searchIntent: manual.searchIntent,
        articleType: manual.articleType,
        brief: manual.brief,
        recommendedPublishDate: iso,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setManualOpen(false);
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const items = topics.data?.items ?? [];
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((t) => t.id)));
  };

  const ids = Array.from(selected);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("topics.title")}
        description={t("topics.desc")}
        actions={
          <Button type="button" className="gap-2" onClick={() => setManualOpen(true)}>
            <CopyPlus className="h-4 w-4" />
            {t("topics.customTopic")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Website</Label>
          <select className={nativeSelectClass + " min-w-[200px]"} value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
            <option value="">All websites</option>
            {websites.data?.items.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select className={nativeSelectClass + " min-w-[180px]"} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft_topic">Draft topic</option>
            <option value="approved_topic">Approved</option>
            <option value="article_draft">Article draft</option>
            <option value="ready_for_publish">Ready</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Source</Label>
          <select className={nativeSelectClass + " min-w-[140px]"} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="planner">Planner</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input className="w-[220px] pl-9" placeholder="Title, keyword, brief…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Sort</Label>
          <select
            className={nativeSelectClass + " min-w-[130px]"}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "title" | "status" | "updated")}
          >
            <option value="date">Publish date</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
            <option value="updated">Updated</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Order</Label>
          <select className={nativeSelectClass + " min-w-[100px]"} value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-zinc-50/80 px-4 py-3 text-sm">
          <span className="text-[var(--color-muted)]">{ids.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => bulkApprove.mutate(ids)} disabled={bulkApprove.isPending}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => bulkGenerate.mutate(ids)}
            disabled={bulkGenerate.isPending}
          >
            {bulkGenerate.isPending ? t("ai.progress.generating") : "Generate articles"}
          </Button>
          <Button size="sm" variant="destructive" className="gap-1" onClick={() => bulkDelete.mutate(ids)} disabled={bulkDelete.isPending}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <AiProgressBar
        active={bulkGenerate.isPending}
        estimatedSeconds={ids.length * 40}
        steps={[
          { label: t("ai.progress.article.thinking"), done: false },
          { label: t("ai.progress.article.writing"), done: false },
        ]}
      />

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>All topics</CardTitle>
          <CardDescription>{topics.data?.total ?? 0} results</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-0">
          {topics.isLoading && <p className="p-6 text-sm text-[var(--color-muted)]">Loading…</p>}
          {!topics.isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="rounded border-[var(--color-border)]"
                      checked={!!topics.data?.items.length && selected.size === topics.data.items.length}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Publish date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.data?.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded border-[var(--color-border)]"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.proposedTitle}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link to={`/topics/${row.id}/review`} className="font-medium text-violet-700 hover:underline">
                        {row.proposedTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[var(--color-muted)]">{format(new Date(row.recommendedPublishDate), "PPp")}</TableCell>
                    <TableCell className="capitalize text-[var(--color-muted)]">{row.source ?? "planner"}</TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {topics.data && (
            <PaginationControls
              page={topics.data.page}
              total={topics.data.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              disabled={topics.isFetching}
            />
          )}
        </CardContent>
      </Card>

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-0 shadow-xl ring-1 ring-zinc-200">
            <CardHeader>
              <CardTitle>Custom topic</CardTitle>
              <CardDescription>Creates a manual topic on the chosen month plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Website</Label>
                <select
                  className={nativeSelectClass + " w-full"}
                  value={manual.websiteId}
                  onChange={(e) => setManual((m) => ({ ...m, websiteId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {websites.data?.items.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input type="number" value={manual.year} onChange={(e) => setManual((m) => ({ ...m, year: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input type="number" min={1} max={12} value={manual.month} onChange={(e) => setManual((m) => ({ ...m, month: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={manual.proposedTitle} onChange={(e) => setManual((m) => ({ ...m, proposedTitle: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Primary keyword</Label>
                <Input value={manual.primaryKeyword} onChange={(e) => setManual((m) => ({ ...m, primaryKeyword: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Secondary keywords (comma-separated)</Label>
                <Input value={manual.secondaryKeywords} onChange={(e) => setManual((m) => ({ ...m, secondaryKeywords: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Intent</Label>
                  <Input value={manual.searchIntent} onChange={(e) => setManual((m) => ({ ...m, searchIntent: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Article type</Label>
                  <Input value={manual.articleType} onChange={(e) => setManual((m) => ({ ...m, articleType: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Brief</Label>
                <Textarea value={manual.brief} onChange={(e) => setManual((m) => ({ ...m, brief: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Publish date</Label>
                <Input
                  type="datetime-local"
                  value={manual.recommendedPublishDate}
                  onChange={(e) => setManual((m) => ({ ...m, recommendedPublishDate: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!manual.websiteId || !manual.proposedTitle || createManual.isPending}
                  onClick={() => createManual.mutate()}
                >
                  {createManual.isPending ? "Creating…" : "Create topic"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
