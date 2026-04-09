import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import { Download, Eye, ImagePlus, PencilLine, Send } from "lucide-react";
import { isAxiosError } from "axios";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nContext";
import { createArticleEditorExtensions } from "@/components/article-editor/article-editor-extensions";
import { ArticleEditorToolbar } from "@/components/article-editor/ArticleEditorToolbar";
import { AiProgressBar } from "@/components/AiProgressBar";

function wpIdsFromJson(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0);
}

export function ArticleEditorPage() {
  const tr = useI18n();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editTab, setEditTab] = useState("edit");
  const hydrated = useRef(false);

  const articleQuery = useQuery({
    queryKey: ["article", id],
    enabled: !!id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get(`/articles/${id}`);
      return data as {
        article: {
          id: string;
          language: string;
          articleLength: string | null;
          metaTitle: string | null;
          metaDescription: string | null;
          slug: string | null;
          focusKeyword: string | null;
          body: string | null;
          suggestedCta: string | null;
          schemaSuggestion: string | null;
          imagePrompt: string | null;
          coverImageUrl: string | null;
          tagsSuggestion: string[];
          wpPostId: number | null;
          wpPostUrl: string | null;
          wpLastPushedAt: string | null;
          wpCategoryIds: unknown;
          wpTagIds: unknown;
          plannedTopic: {
            id: string;
            proposedTitle: string;
            monthlyPlan: {
              websiteId: string;
              website: {
                hasWpCredentials: boolean;
                wpDefaultStatus: string;
              };
            };
          };
        };
      };
    },
  });

  const versionsQuery = useQuery({
    queryKey: ["article-versions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/articles/${id}/versions`);
      return data as { items: { id: string; version: number; createdAt: string }[] };
    },
  });

  const scoreQuery = useQuery({
    queryKey: ["article-score", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/articles/${id}/score`);
      return data as {
        items: { id: string; label: string; pass: boolean; weight: number }[];
        passed: number;
        total: number;
        weightedScore: number;
        maxWeight: number;
      };
    },
  });

  const websiteId = articleQuery.data?.article.plannedTopic.monthlyPlan.websiteId;
  const wpConfigured = articleQuery.data?.article.plannedTopic.monthlyPlan.website.hasWpCredentials;

  const wpCategoriesQuery = useQuery({
    queryKey: ["wp-categories", websiteId],
    enabled: !!id && !!websiteId && wpConfigured,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await api.get(`/websites/${websiteId}/wordpress/categories`);
      return data as { items: { id: number; name: string; slug: string }[] };
    },
  });

  const wpTagsQuery = useQuery({
    queryKey: ["wp-tags", websiteId],
    enabled: !!id && !!websiteId && wpConfigured,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await api.get(`/websites/${websiteId}/wordpress/tags`);
      return data as { items: { id: number; name: string; slug: string }[] };
    },
  });

  const extensions = useMemo(
    () => createArticleEditorExtensions(tr("articleEditor.bodyPlaceholder")),
    [tr]
  );

  const editor = useEditor(
    {
      extensions,
      content: "<p></p>",
      editable: true,
    },
    [extensions]
  );

  useEffect(() => {
    hydrated.current = false;
  }, [id]);

  useEffect(() => {
    if (!editor || !articleQuery.isSuccess || hydrated.current) return;
    const html = articleQuery.data.article.body ?? "<p></p>";
    editor.commands.setContent(html);
    hydrated.current = true;
  }, [editor, articleQuery.isSuccess, articleQuery.data?.article.body, id]);

  useEffect(() => {
    if (editor) editor.setEditable(editTab === "edit");
  }, [editor, editTab]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.patch(`/articles/${id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["article", id] });
      qc.invalidateQueries({ queryKey: ["article-score", id] });
    },
  });

  const generateCover = useMutation({
    mutationFn: async (force: boolean) => {
      const { data } = await api.post<{
        coverImageUrl: string;
        skipped?: boolean;
        reason?: string;
        illustration?: "generated" | "off" | "no_key" | "failed";
        imageError?: string;
      }>(`/articles/${id}/cover`, {}, { params: force ? { force: "true" } : {} });
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["article", id] });
      if (data.coverImageUrl) setCoverUrl(data.coverImageUrl);
    },
  });

  const [wpPublishStatus, setWpPublishStatus] = useState("draft");
  useEffect(() => {
    const d = articleQuery.data?.article.plannedTopic.monthlyPlan?.website?.wpDefaultStatus;
    if (d) setWpPublishStatus(d);
  }, [articleQuery.data?.article.plannedTopic.monthlyPlan?.website?.wpDefaultStatus, id]);

  const publishWp = useMutation({
    mutationFn: async () => {
      await api.post(`/articles/${id}/publish-wordpress`, {
        status: wpPublishStatus,
        wpCategoryIds: localWpCatIds,
        wpTagIds: localWpTagIds,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["article", id] });
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        save.mutate({ body: editor.getHTML() });
      }, 2000);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, save]);

  const meta = articleQuery.data?.article;

  const seoForm = useMemo(
    () => ({
      metaTitle: meta?.metaTitle ?? "",
      metaDescription: meta?.metaDescription ?? "",
      slug: meta?.slug ?? "",
      focusKeyword: meta?.focusKeyword ?? "",
    }),
    [meta]
  );

  const [seo, setSeo] = useState(seoForm);
  useEffect(() => {
    setSeo(seoForm);
  }, [seoForm]);

  const [coverUrl, setCoverUrl] = useState("");
  useEffect(() => {
    setCoverUrl(meta?.coverImageUrl ?? "");
  }, [meta?.coverImageUrl, id]);

  const [localWpCatIds, setLocalWpCatIds] = useState<number[]>([]);
  const [localWpTagIds, setLocalWpTagIds] = useState<number[]>([]);
  useEffect(() => {
    const art = articleQuery.data?.article;
    if (!art) return;
    setLocalWpCatIds(wpIdsFromJson(art.wpCategoryIds));
    setLocalWpTagIds(wpIdsFromJson(art.wpTagIds));
  }, [articleQuery.data?.article, id]);

  const previewHtml = editor?.getHTML() ?? "";

  async function downloadExport(format: "html" | "markdown" | "json") {
    if (!id) return;
    const res = await api.get(`/articles/${id}/export`, { params: { format }, responseType: "blob" });
    const blob = res.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `article.${format === "markdown" ? "md" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!id) return null;
  if (articleQuery.isLoading) return <p className="text-sm text-[var(--color-muted)]">{tr("common.loading")}</p>;
  if (!articleQuery.data) return <p className="text-sm text-red-600">{tr("common.notFound")}</p>;

  const a = articleQuery.data.article;

  return (
    <div className="space-y-8">
      <PageHeader
        title={tr("articleEditor.title")}
        description={a.plannedTopic.proposedTitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => downloadExport("html")}>
              <Download className="h-3.5 w-3.5" />
              HTML
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadExport("markdown")}>
              MD
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadExport("json")}>
              JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                save.mutate({
                  ...seo,
                  body: editor?.getHTML(),
                  coverImageUrl: coverUrl.trim() || null,
                  wpCategoryIds: localWpCatIds,
                  wpTagIds: localWpTagIds,
                  createVersion: true,
                })
              }
            >
              Save version
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/topics/${a.plannedTopic.id}/review`}>Back to topic</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <Tabs value={editTab} onValueChange={setEditTab} className="w-full">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">Content</CardTitle>
                  <CardDescription>{tr("articleEditor.contentHelp")}</CardDescription>
                </div>
                <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
                  <TabsTrigger value="edit" className="gap-2">
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="edit" className="mt-0">
                  {editor && (
                    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-inner">
                      <ArticleEditorToolbar editor={editor} />
                      <EditorContent
                        editor={editor}
                        className="prose prose-zinc max-w-none border-t border-[var(--color-border)] bg-white p-5"
                      />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <div className="prose prose-zinc max-w-none min-h-[320px] rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-inner">
                    {coverUrl.trim() ? (
                      <img
                        src={coverUrl.trim()}
                        alt=""
                        className="mb-6 w-full max-h-72 rounded-xl object-cover ring-1 ring-zinc-200/80"
                      />
                    ) : null}
                    <div dangerouslySetInnerHTML={{ __html: previewHtml || "<p></p>" }} />
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">{tr("articleEditor.coverTitle")}</CardTitle>
              <CardDescription>{tr("articleEditor.coverDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {coverUrl.trim() ? (
                <div className="overflow-hidden rounded-lg ring-1 ring-zinc-200/80">
                  <img
                    src={coverUrl.trim()}
                    alt=""
                    className="max-h-48 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="cover-url">{tr("articleEditor.coverUrl")}</Label>
                <Input
                  id="cover-url"
                  value={coverUrl}
                  placeholder="https://..."
                  onChange={(e) => setCoverUrl(e.target.value)}
                  onBlur={() => save.mutate({ coverImageUrl: coverUrl.trim() || null })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  disabled={generateCover.isPending || save.isPending}
                  onClick={() => {
                    const hasCover = !!coverUrl.trim();
                    if (hasCover && !window.confirm(tr("articleEditor.coverRegenerateConfirm"))) return;
                    generateCover.mutate(hasCover);
                  }}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {generateCover.isPending ? tr("articleEditor.generatingCover") : tr("articleEditor.generateCover")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => save.mutate({ coverImageUrl: coverUrl.trim() || null })}
                  disabled={save.isPending}
                >
                  {tr("articleEditor.saveCover")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCoverUrl("");
                    save.mutate({ coverImageUrl: null });
                  }}
                  disabled={save.isPending || !coverUrl.trim()}
                >
                  {tr("articleEditor.clearCover")}
                </Button>
              </div>
              <AiProgressBar
                active={generateCover.isPending}
                estimatedSeconds={45}
                steps={[
                  { label: tr("ai.progress.cover.prompt"), done: false },
                  { label: tr("ai.progress.cover.image"), done: false },
                  { label: tr("ai.progress.cover.render"), done: false },
                ]}
              />
              {generateCover.isSuccess && generateCover.data?.skipped && generateCover.data.reason ? (
                <p className="text-xs text-amber-800">{generateCover.data.reason}</p>
              ) : null}
              {generateCover.isSuccess &&
              generateCover.data &&
              !generateCover.data.skipped &&
              generateCover.data.illustration === "no_key" ? (
                <p className="text-xs text-amber-800">{tr("articleEditor.coverNoApiKey")}</p>
              ) : null}
              {generateCover.isSuccess &&
              generateCover.data &&
              !generateCover.data.skipped &&
              generateCover.data.illustration === "failed" ? (
                <p className="text-xs text-red-600">
                  {tr("articleEditor.coverImageFailed")}
                  {generateCover.data.imageError ? `: ${generateCover.data.imageError}` : ""}
                </p>
              ) : null}
              {generateCover.isSuccess &&
              generateCover.data &&
              !generateCover.data.skipped &&
              generateCover.data.illustration !== "failed" &&
              generateCover.data.illustration !== "no_key" ? (
                <p className="text-xs text-emerald-700">{tr("articleEditor.coverGenerateOk")}</p>
              ) : null}
              {generateCover.isError && (
                <p className="text-xs text-red-600">
                  {tr("articleEditor.coverGenerateFail")}
                  {isAxiosError(generateCover.error) && generateCover.error.response?.data
                    ? `: ${String((generateCover.error.response.data as { error?: string }).error ?? generateCover.error.message)}`
                    : generateCover.error
                      ? `: ${(generateCover.error as Error).message}`
                      : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">{tr("articleEditor.wp.title")}</CardTitle>
              <CardDescription>{tr("articleEditor.wp.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {a.plannedTopic.monthlyPlan.website.hasWpCredentials ? (
                <>
                  {a.wpPostUrl ? (
                    <a
                      href={a.wpPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-violet-700 underline underline-offset-2 hover:text-violet-900"
                    >
                      {tr("articleEditor.wp.openInWp")}
                    </a>
                  ) : null}
                  {a.wpLastPushedAt ? (
                    <p className="text-xs text-[var(--color-muted)]">
                      {tr("articleEditor.wp.lastPush")}: {new Date(a.wpLastPushedAt).toLocaleString()}
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <Label>{tr("articleEditor.wp.categories")}</Label>
                    {wpCategoriesQuery.isLoading ? (
                      <p className="text-xs text-[var(--color-muted)]">{tr("articleEditor.wp.loadingTerms")}</p>
                    ) : wpCategoriesQuery.data?.items.length ? (
                      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-zinc-50/80 p-2">
                        {wpCategoriesQuery.data.items.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="rounded border-zinc-300"
                              checked={localWpCatIds.includes(c.id)}
                              onChange={() => {
                                setLocalWpCatIds((prev) =>
                                  prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                                );
                              }}
                            />
                            <span className="text-zinc-800">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">{tr("articleEditor.wp.emptyCategories")}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{tr("articleEditor.wp.tags")}</Label>
                    {wpTagsQuery.isLoading ? (
                      <p className="text-xs text-[var(--color-muted)]">{tr("articleEditor.wp.loadingTerms")}</p>
                    ) : wpTagsQuery.data?.items.length ? (
                      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-zinc-50/80 p-2">
                        {wpTagsQuery.data.items.map((tag) => (
                          <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="rounded border-zinc-300"
                              checked={localWpTagIds.includes(tag.id)}
                              onChange={() => {
                                setLocalWpTagIds((prev) =>
                                  prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                                );
                              }}
                            />
                            <span className="text-zinc-800">{tag.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">{tr("articleEditor.wp.emptyTags")}</p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({ wpCategoryIds: localWpCatIds, wpTagIds: localWpTagIds })
                    }
                  >
                    {tr("articleEditor.wp.saveTaxonomy")}
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="wp-status">{tr("articleEditor.wp.postStatus")}</Label>
                    <select
                      id="wp-status"
                      className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm shadow-sm"
                      value={wpPublishStatus}
                      onChange={(e) => setWpPublishStatus(e.target.value)}
                    >
                      <option value="draft">{tr("website.wordpress.status.draft")}</option>
                      <option value="publish">{tr("website.wordpress.status.publish")}</option>
                      <option value="pending">{tr("website.wordpress.status.pending")}</option>
                      <option value="private">{tr("website.wordpress.status.private")}</option>
                    </select>
                  </div>
                  <p className="text-[11px] leading-snug text-[var(--color-muted)]">{tr("articleEditor.wp.publishHint")}</p>
                  <Button
                    type="button"
                    className="w-full gap-2"
                    disabled={publishWp.isPending}
                    onClick={() => publishWp.mutate()}
                  >
                    <Send className="h-4 w-4" />
                    {publishWp.isPending ? tr("articleEditor.wp.publishing") : tr("articleEditor.wp.publish")}
                  </Button>
                  {publishWp.isError && (
                    <p className="text-xs text-red-600">
                      {isAxiosError(publishWp.error) && publishWp.error.response?.data
                        ? String(
                            (publishWp.error.response.data as { error?: string }).error ?? publishWp.error.message
                          )
                        : (publishWp.error as Error)?.message}
                    </p>
                  )}
                  {publishWp.isSuccess && (
                    <p className="text-xs text-emerald-700">{tr("articleEditor.wp.publishOk")}</p>
                  )}
                </>
              ) : (
                <p className="text-[var(--color-muted)]">
                  {tr("articleEditor.wp.configureFirst")}{" "}
                  <Link
                    className="font-medium text-violet-700 underline underline-offset-2"
                    to={`/websites/${a.plannedTopic.monthlyPlan.websiteId}`}
                  >
                    {tr("articleEditor.wp.goToWebsite")}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">Locale & length</CardTitle>
              <CardDescription>Language and target length for this article.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Language (ISO)</Label>
                <Input
                  defaultValue={a.language}
                  key={a.language + id}
                  onBlur={(e) => save.mutate({ language: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Article length</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm shadow-sm"
                  defaultValue={a.articleLength ?? "standard"}
                  onChange={(e) => {
                    const v = e.target.value;
                    save.mutate({ articleLength: v === "" ? null : v });
                  }}
                >
                  <option value="">Default (site)</option>
                  <option value="short">Short</option>
                  <option value="standard">Standard</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
              <CardDescription>How this page should appear in search and URLs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Meta title</Label>
                <Input value={seo.metaTitle} onChange={(e) => setSeo((s) => ({ ...s, metaTitle: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Meta description</Label>
                <Textarea
                  className="min-h-[88px]"
                  value={seo.metaDescription}
                  onChange={(e) => setSeo((s) => ({ ...s, metaDescription: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={seo.slug} onChange={(e) => setSeo((s) => ({ ...s, slug: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Focus keyword</Label>
                <Input value={seo.focusKeyword} onChange={(e) => setSeo((s) => ({ ...s, focusKeyword: e.target.value }))} />
              </div>
              <Button className="w-full" variant="secondary" onClick={() => save.mutate({ ...seo })} disabled={save.isPending}>
                Save SEO fields
              </Button>
              <p className="text-xs text-[var(--color-muted)]">Body auto-saves a few seconds after you stop typing.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">Quality checklist</CardTitle>
              <CardDescription>
                {scoreQuery.data
                  ? `${scoreQuery.data.passed}/${scoreQuery.data.total} checks · ${scoreQuery.data.weightedScore}/${scoreQuery.data.maxWeight} weighted`
                  : "Loading…"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {scoreQuery.data?.items.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <span className={row.pass ? "text-emerald-800" : "text-zinc-600"}>{row.label}</span>
                  <span className="text-xs font-medium">{row.pass ? "✓" : "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">AI suggestions</CardTitle>
              <CardDescription>Hints from generation — use or refine in the editor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-700">
              <div>
                <span className="font-medium text-zinc-900">CTA: </span>
                {a.suggestedCta ?? "—"}
              </div>
              <div>
                <span className="font-medium text-zinc-900">Schema: </span>
                {a.schemaSuggestion ?? "—"}
              </div>
              <div>
                <span className="font-medium text-zinc-900">Image prompt: </span>
                {a.imagePrompt ?? "—"}
              </div>
              <div>
                <span className="font-medium text-zinc-900">Tags: </span>
                {a.tagsSuggestion?.length ? a.tagsSuggestion.join(", ") : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">Version history</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versionsQuery.data?.items.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">v{v.version}</TableCell>
                      <TableCell className="text-right text-[var(--color-muted)]">
                        {new Date(v.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
