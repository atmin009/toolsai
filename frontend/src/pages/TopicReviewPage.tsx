import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FilePenLine, Package, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { useI18n } from "@/i18n/I18nContext";
import { AiProgressBar } from "@/components/AiProgressBar";

interface ProductMention {
  name: string;
  url?: string;
  highlights?: string;
  price?: string;
  note?: string;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : value ? [value] : [];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

export function TopicReviewPage() {
  const tr = useI18n();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["topic", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/topics/${id}`);
      return data as {
        topic: {
          id: string;
          proposedTitle: string;
          primaryKeyword: string;
          secondaryKeywords: unknown;
          searchIntent: string;
          articleType: string;
          brief: string;
          productMentions: ProductMention[];
          recommendedPublishDate: string;
          status: string;
          article: { id: string } | null;
        };
      };
    },
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/topics/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", id] }),
  });

  const reject = useMutation({
    mutationFn: () => api.delete(`/topics/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      window.location.href = "/topics";
    },
  });

  const regenerate = useMutation({
    mutationFn: () => api.post(`/topics/${id}/regenerate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", id] }),
  });

  const markReady = useMutation({
    mutationFn: () => api.patch(`/topics/${id}`, { status: "ready_for_publish" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", id] }),
  });

  const generateArticle = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/articles/generate/${id}`);
      return data as { article: { id: string } };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["topic", id] });
      window.location.href = `/articles/${data.article.id}/edit`;
    },
  });

  if (!id) return null;
  if (q.isLoading) return <p className="text-sm text-[var(--color-muted)]">{tr("common.loading")}</p>;
  if (!q.data) return <p className="text-sm text-red-600">{tr("common.notFound")}</p>;

  const topic = q.data.topic;
  const secondaryKeywords = asStringArray(topic.secondaryKeywords);

  return (
    <div className="space-y-8">
      <PageHeader
        title={tr("topicReview.title")}
        description={format(new Date(topic.recommendedPublishDate), "PPP")}
        actions={<StatusBadge status={topic.status} />}
      />

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle className="text-lg leading-snug">{topic.proposedTitle}</CardTitle>
          <CardDescription>{tr("topicReview.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">Primary keyword</span>
            <p className="mt-1 font-medium text-zinc-900">{topic.primaryKeyword}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">Search intent</span>
            <p className="mt-1 font-medium text-zinc-900">{topic.searchIntent}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">Article type</span>
            <p className="mt-1 font-medium text-zinc-900">{topic.articleType}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">Secondary keywords</span>
            <p className="mt-1 text-zinc-700">{secondaryKeywords.length ? secondaryKeywords.join(", ") : "—"}</p>
          </div>
          <div className="md:col-span-2 rounded-xl border border-[var(--color-border)] bg-zinc-50/80 p-4 leading-relaxed text-zinc-800">
            {topic.brief}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <Button variant="secondary" className="gap-2" onClick={() => approve.mutate()} disabled={approve.isPending}>
          <Check className="h-4 w-4" />
          {tr("topicReview.accept")}
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
          <RefreshCw className="h-4 w-4" />
          {tr("topicReview.regenerate")}
        </Button>
        <Button variant="destructive" className="gap-2" onClick={() => reject.mutate()} disabled={reject.isPending}>
          <Trash2 className="h-4 w-4" />
          {tr("topicReview.delete")}
        </Button>
        <div className="mx-1 hidden h-8 w-px bg-[var(--color-border)] sm:block" aria-hidden />
        <Button
          className="gap-2"
          onClick={() => generateArticle.mutate()}
          disabled={(topic.status !== "approved_topic" && topic.status !== "article_draft") || generateArticle.isPending}
        >
          <FilePenLine className="h-4 w-4" />
          {topic.article ? tr("topicReview.regenerateArticle") : tr("topicReview.generateArticle")}
        </Button>
        {topic.article && (
          <Button variant="outline" className="gap-2" asChild>
            <Link to={`/articles/${topic.article.id}/edit`}>{tr("topicReview.openEditor")}</Link>
          </Button>
        )}
        {topic.status === "article_draft" && (
          <Button variant="outline" onClick={() => markReady.mutate()} disabled={markReady.isPending}>
            {tr("topicReview.markReady")}
          </Button>
        )}
      </div>

      <AiProgressBar
        active={regenerate.isPending}
        estimatedSeconds={20}
        message={tr("ai.progress.topic.regenerating")}
      />
      <AiProgressBar
        active={generateArticle.isPending}
        estimatedSeconds={60}
        steps={[
          { label: tr("ai.progress.article.thinking"), done: false },
          { label: tr("ai.progress.article.writing"), done: false },
          { label: tr("ai.progress.article.seo"), done: false },
        ]}
      />

      <ProductMentionsCard
        key={`pm-${topic.id}`}
        topicId={topic.id}
        initial={Array.isArray(topic.productMentions) ? topic.productMentions : []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["topic", id] })}
      />

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle className="text-base">{tr("topicReview.quickEdit")}</CardTitle>
          <CardDescription>{tr("topicReview.quickEditDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <QuickEditForm
            key={topic.id}
            topicId={topic.id}
            defaults={topic}
            onSaved={() => qc.invalidateQueries({ queryKey: ["topic", id] })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ProductMentionsCard({
  topicId,
  initial,
  onSaved,
}: {
  topicId: string;
  initial: ProductMention[];
  onSaved: () => void;
}) {
  const t = useI18n();
  const [items, setItems] = useState<ProductMention[]>(initial);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = items.filter((p) => p.name.trim());
      await api.patch(`/topics/${topicId}`, { productMentions: cleaned });
    },
    onSuccess: onSaved,
  });

  const add = () => setItems((prev) => [...prev, { name: "", url: "", highlights: "", price: "", note: "" }]);
  const remove = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof ProductMention, value: string) =>
    setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  return (
    <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-violet-600" />
          <CardTitle className="text-base">{t("product.sectionTitle")}</CardTitle>
        </div>
        <CardDescription>{t("product.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">{t("product.empty")}</p>
        )}
        {items.map((p, i) => (
          <div key={i} className="relative space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-3 top-3 rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("product.name")} *</Label>
                <Input value={p.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="iPhone 16 Pro" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("product.url")}</Label>
                <Input value={p.url ?? ""} onChange={(e) => update(i, "url", e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("product.price")}</Label>
                <Input value={p.price ?? ""} onChange={(e) => update(i, "price", e.target.value)} placeholder="฿1,290" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("product.highlights")}</Label>
                <Input value={p.highlights ?? ""} onChange={(e) => update(i, "highlights", e.target.value)} placeholder="A18 Pro chip, 48MP camera" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("product.note")}</Label>
              <Input value={p.note ?? ""} onChange={(e) => update(i, "note", e.target.value)} placeholder="เน้นเปรียบเทียบกับรุ่นก่อน" />
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add}>
            <Plus className="h-4 w-4" /> {t("product.addProduct")}
          </Button>
          {items.length > 0 && (
            <Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          )}
          {save.isSuccess && <span className="text-sm text-emerald-700">{t("product.saved")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickEditForm({
  topicId,
  defaults,
  onSaved,
}: {
  topicId: string;
  defaults: {
    proposedTitle: string;
    brief: string;
    primaryKeyword: string;
  };
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(defaults.proposedTitle);
  const [brief, setBrief] = useState(defaults.brief);
  const [kw, setKw] = useState(defaults.primaryKeyword);

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/topics/${topicId}`, { proposedTitle: title, brief, primaryKeyword: kw });
    },
    onSuccess: onSaved,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Primary keyword</Label>
        <Input value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Brief</Label>
        <Textarea className="min-h-[120px]" value={brief} onChange={(e) => setBrief(e.target.value)} />
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        Save changes
      </Button>
    </div>
  );
}
