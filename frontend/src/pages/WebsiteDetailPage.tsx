import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy } from "lucide-react";
import { isAxiosError } from "axios";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { nativeSelectClass } from "@/lib/input-classes";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/I18nContext";
import { useMemo } from "react";

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] as const;
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"] as const;

type WebsitePayload = {
  name: string;
  domain: string;
  brandName: string;
  niche: string;
  defaultLanguage: string;
  targetAudience: string;
  toneOfVoice: string;
  seoRules: string | null;
  articleGoals: string[];
  keywordBlacklist: string[];
  forbiddenClaims: string | null;
  complianceNotes: string | null;
  defaultArticleLength: string;
  aiProvider: string;
  aiModel: string | null;
  aiTemperature: number | null;
  aiMaxTokens: number | null;
  aiFallbackProvider: string | null;
  hasOpenaiApiKey: boolean;
  hasGoogleApiKey: boolean;
  hasWpCredentials: boolean;
  hasWpPluginKey?: boolean;
  wpSiteUrl: string | null;
  wpUsername: string | null;
  wpDefaultStatus: string;
  keywordGroups: { type: string; label: string; keywords: string[] }[];
  categories: { name: string; description: string | null }[];
};

export function WebsiteDetailPage() {
  const t = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["website", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/websites/${id}`);
      return data as { website: WebsitePayload };
    },
  });

  const [policy, setPolicy] = useState({
    blacklist: "",
    forbiddenClaims: "",
    complianceNotes: "",
    defaultArticleLength: "standard",
  });

  const [ai, setAi] = useState({
    aiProvider: "mock",
    aiModel: "",
    aiTemperature: "",
    aiMaxTokens: "",
    aiFallbackProvider: "",
    siteOpenaiKey: "",
    siteGoogleKey: "",
  });

  const [wp, setWp] = useState({
    wpSiteUrl: "",
    wpUsername: "",
    wpAppPassword: "",
    wpPluginApiKey: "",
    wpDefaultStatus: "draft",
  });

  const allowedArticleGoals = useMemo(() => new Set(["traffic", "conversion", "education", "comparison", "branding"]), []);
  const [editBasicsOpen, setEditBasicsOpen] = useState(false);
  const [basic, setBasic] = useState({
    name: "",
    domain: "",
    brandName: "",
    niche: "",
    defaultLanguage: "th",
    targetAudience: "",
    toneOfVoice: "",
    seoRules: "",
    articleGoalsRaw: "",
  });

  useEffect(() => {
    if (!q.data?.website) return;
    const w = q.data.website;
    setPolicy({
      blacklist: (w.keywordBlacklist ?? []).join(", "),
      forbiddenClaims: w.forbiddenClaims ?? "",
      complianceNotes: w.complianceNotes ?? "",
      defaultArticleLength: w.defaultArticleLength ?? "standard",
    });
    setAi((prev) => ({
      ...prev,
      aiProvider: w.aiProvider ?? "mock",
      aiModel: w.aiModel ?? "",
      aiTemperature: w.aiTemperature != null ? String(w.aiTemperature) : "",
      aiMaxTokens: w.aiMaxTokens != null ? String(w.aiMaxTokens) : "",
      aiFallbackProvider: w.aiFallbackProvider ?? "",
      siteOpenaiKey: "",
      siteGoogleKey: "",
    }));
    setBasic({
      name: w.name ?? "",
      domain: w.domain ?? "",
      brandName: w.brandName ?? "",
      niche: w.niche ?? "",
      defaultLanguage: w.defaultLanguage ?? "th",
      targetAudience: w.targetAudience ?? "",
      toneOfVoice: w.toneOfVoice ?? "",
      seoRules: w.seoRules ?? "",
      articleGoalsRaw: (w.articleGoals ?? []).join(", "),
    });
    setWp({
      wpSiteUrl: w.wpSiteUrl ?? "",
      wpUsername: w.wpUsername ?? "",
      wpAppPassword: "",
      wpPluginApiKey: "",
      wpDefaultStatus: w.wpDefaultStatus ?? "draft",
    });
    setEditBasicsOpen(false);
  }, [q.data?.website]);

  const duplicate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/websites/${id}/duplicate`, {});
      return data as { website: { id: string } };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["websites"] });
      navigate(`/websites/${data.website.id}`);
    },
  });

  const savePolicy = useMutation({
    mutationFn: async () => {
      await api.patch(`/websites/${id}`, {
        keywordBlacklist: policy.blacklist
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        forbiddenClaims: policy.forbiddenClaims || null,
        complianceNotes: policy.complianceNotes || null,
        defaultArticleLength: policy.defaultArticleLength,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website", id] }),
  });

  const saveAi = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        aiProvider: ai.aiProvider,
        aiModel: ai.aiModel.trim() || null,
        aiTemperature: ai.aiTemperature.trim() === "" ? null : Number(ai.aiTemperature),
        aiMaxTokens: ai.aiMaxTokens.trim() === "" ? null : parseInt(ai.aiMaxTokens, 10),
        aiFallbackProvider: ai.aiFallbackProvider === "" ? null : ai.aiFallbackProvider,
      };
      if (ai.siteOpenaiKey.trim()) payload.openaiApiKey = ai.siteOpenaiKey.trim();
      if (ai.siteGoogleKey.trim()) payload.googleApiKey = ai.siteGoogleKey.trim();
      await api.patch(`/websites/${id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website", id] });
      setAi((a) => ({ ...a, siteOpenaiKey: "", siteGoogleKey: "" }));
    },
  });

  const updateBasic = useMutation({
    mutationFn: async () => {
      const articleGoals = basic.articleGoalsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((g) => allowedArticleGoals.has(g));

      await api.patch(`/websites/${id}`, {
        name: basic.name.trim(),
        domain: basic.domain.trim(),
        brandName: basic.brandName.trim(),
        niche: basic.niche.trim(),
        defaultLanguage: basic.defaultLanguage.trim() || "th",
        targetAudience: basic.targetAudience.trim(),
        toneOfVoice: basic.toneOfVoice.trim(),
        seoRules: basic.seoRules.trim() ? basic.seoRules.trim() : null,
        articleGoals,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website", id] });
      setEditBasicsOpen(false);
    },
  });

  const deleteWebsite = useMutation({
    mutationFn: async () => {
      await api.delete(`/websites/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["websites"] });
      navigate("/websites");
    },
  });

  const clearSiteOpenai = useMutation({
    mutationFn: async () => {
      await api.patch(`/websites/${id}`, { openaiApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website", id] }),
  });

  const clearSiteGoogle = useMutation({
    mutationFn: async () => {
      await api.patch(`/websites/${id}`, { googleApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website", id] }),
  });

  const testAi = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/websites/${id}/ai-test`);
      return data as { ok: boolean; message: string };
    },
  });

  const saveWp = useMutation({
    mutationFn: async () => {
      const appPassNoSpaces = wp.wpAppPassword.replace(/\s+/g, "");
      const payload: Record<string, unknown> = {
        wpSiteUrl: wp.wpSiteUrl.trim() || null,
        wpUsername: wp.wpUsername.trim() || null,
        wpDefaultStatus: wp.wpDefaultStatus,
      };
      if (appPassNoSpaces) payload.wpApplicationPassword = appPassNoSpaces;
      if (wp.wpPluginApiKey.trim()) payload.wpPluginApiKey = wp.wpPluginApiKey.trim();
      await api.patch(`/websites/${id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website", id] });
      setWp((p) => ({ ...p, wpAppPassword: "", wpPluginApiKey: "" }));
    },
  });

  const clearWpPassword = useMutation({
    mutationFn: async () => {
      await api.patch(`/websites/${id}`, { wpApplicationPassword: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website", id] }),
  });

  const clearWpPluginKey = useMutation({
    mutationFn: async () => {
      await api.patch(`/websites/${id}`, { wpPluginApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website", id] }),
  });

  const testWp = useMutation({
    mutationFn: async () => {
      const appPass = wp.wpAppPassword.replace(/\s+/g, "");
      const pluginKey = wp.wpPluginApiKey.trim();
      const { data } = await api.post(`/websites/${id}/wordpress/test`, {
        ...(wp.wpSiteUrl.trim() ? { wpSiteUrl: wp.wpSiteUrl.trim() } : {}),
        ...(pluginKey ? { wpPluginApiKey: pluginKey } : {}),
        ...(!pluginKey && wp.wpUsername.trim() ? { wpUsername: wp.wpUsername.trim() } : {}),
        ...(!pluginKey && appPass ? { wpApplicationPassword: appPass } : {}),
      });
      return data as { ok: boolean; message: string };
    },
  });

  if (!id) return null;
  if (q.isLoading) return <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-red-600">{t("common.notFound")}</p>;

  const w = q.data.website;

  return (
    <div className="space-y-8">
      <PageHeader
        title={w.name}
        description={w.domain}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1"
              disabled={deleteWebsite.isPending}
              onClick={() => {
                if (!window.confirm("ต้องการลบเว็บไซต์นี้ใช่หรือไม่?")) return;
                deleteWebsite.mutate();
              }}
            >
              ลบ
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={duplicate.isPending}
              onClick={() => duplicate.mutate()}
            >
              <Copy className="h-4 w-4" />
              {t("website.duplicate")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link to="/websites">
                <ChevronLeft className="h-4 w-4" />
                {t("website.allSites")}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
          <CardHeader>
            <CardTitle>{t("website.brandAudience")}</CardTitle>
            <CardDescription>{t("website.brandAudienceDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-[var(--color-muted)]">{t("website.brandLabel")}: </span>
              {w.brandName}
            </div>
            <div>
              <span className="text-[var(--color-muted)]">{t("website.nicheLabel")}: </span>
              {w.niche}
            </div>
            <div>
              <span className="text-[var(--color-muted)]">{t("website.langLabel")}: </span>
              {w.defaultLanguage}
            </div>
            <p className="leading-relaxed text-zinc-700">{w.targetAudience}</p>
            <p className="leading-relaxed text-zinc-700">{w.toneOfVoice}</p>
            {w.seoRules && <p className="rounded-lg bg-zinc-50 p-3 text-zinc-800">{w.seoRules}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {w.articleGoals.map((g) => (
                <Badge key={g} variant="outline">
                  {g}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {!editBasicsOpen ? (
          <div className="self-start">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditBasicsOpen(true)}>
              แก้ไขข้อมูลพื้นฐาน
            </Button>
          </div>
        ) : (
          <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80 lg:col-span-2">
            <CardHeader>
              <CardTitle>แก้ไขข้อมูลพื้นฐาน</CardTitle>
              <CardDescription>อัปเดตข้อมูลโปรไฟล์เว็บไซต์ที่ AI ใช้ในการวางแผน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ชื่อเว็บไซต์</Label>
                  <Input value={basic.name} onChange={(e) => setBasic((b) => ({ ...b, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>โดเมน</Label>
                  <Input value={basic.domain} onChange={(e) => setBasic((b) => ({ ...b, domain: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand name</Label>
                  <Input
                    value={basic.brandName}
                    onChange={(e) => setBasic((b) => ({ ...b, brandName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Niche</Label>
                  <Input value={basic.niche} onChange={(e) => setBasic((b) => ({ ...b, niche: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default language</Label>
                  <select
                    className={nativeSelectClass + " w-full max-w-[240px]"}
                    value={basic.defaultLanguage}
                    onChange={(e) => setBasic((b) => ({ ...b, defaultLanguage: e.target.value }))}
                  >
                    <option value="th">ไทย (TH)</option>
                    <option value="en">English (EN)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Article goals (คั่นด้วยจุลภาค)</Label>
                  <Input
                    value={basic.articleGoalsRaw}
                    onChange={(e) => setBasic((b) => ({ ...b, articleGoalsRaw: e.target.value }))}
                    placeholder="traffic, conversion, education"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target audience</Label>
                <Textarea
                  className="min-h-[90px]"
                  value={basic.targetAudience}
                  onChange={(e) => setBasic((b) => ({ ...b, targetAudience: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tone of voice</Label>
                <Textarea
                  className="min-h-[90px]"
                  value={basic.toneOfVoice}
                  onChange={(e) => setBasic((b) => ({ ...b, toneOfVoice: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>SEO rules (optional)</Label>
                <Textarea
                  className="min-h-[80px]"
                  value={basic.seoRules}
                  onChange={(e) => setBasic((b) => ({ ...b, seoRules: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" disabled={updateBasic.isPending} onClick={() => updateBasic.mutate()}>
                  {updateBasic.isPending ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
                <Button type="button" variant="outline" disabled={updateBasic.isPending} onClick={() => setEditBasicsOpen(false)}>
                  ยกเลิก
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
          <CardHeader>
            <CardTitle>{t("website.keywordThemes")}</CardTitle>
            <CardDescription>{t("website.keywordThemesDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {w.keywordGroups.map((kg) => (
              <div key={kg.label + kg.type}>
                <div className="mb-1 text-xs font-medium uppercase text-[var(--color-muted)]">
                  {kg.type} · {kg.label}
                </div>
                <div className="flex flex-wrap gap-1">
                  {kg.keywords.map((k) => (
                    <Badge key={k} variant="outline">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{t("website.categories")}</CardTitle>
          <CardDescription>{t("website.categoriesDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {w.categories.map((c) => (
              <li key={c.name} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-xs text-[var(--color-muted)]">{c.description}</div>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{t("website.aiProvider")}</CardTitle>
          <CardDescription>{t("website.aiEnvHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-zinc-50/80 p-4 text-sm">
            <p className="font-medium text-zinc-800">{t("website.siteApiKeys")}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{t("website.clearKeyHint")}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span>
                OpenAI: {w.hasOpenaiApiKey ? <Badge variant="secondary">{t("settings.hasKey")}</Badge> : <span className="text-[var(--color-muted)]">{t("settings.noKey")}</span>}
              </span>
              <span>
                Google: {w.hasGoogleApiKey ? <Badge variant="secondary">{t("settings.hasKey")}</Badge> : <span className="text-[var(--color-muted)]">{t("settings.noKey")}</span>}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label>{t("website.siteOpenaiKey")}</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={t("settings.keyPlaceholder")}
                  value={ai.siteOpenaiKey}
                  onChange={(e) => setAi((a) => ({ ...a, siteOpenaiKey: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
              {w.hasOpenaiApiKey && (
                <Button type="button" variant="outline" size="sm" disabled={clearSiteOpenai.isPending} onClick={() => clearSiteOpenai.mutate()}>
                  {t("settings.clearOpenai")}
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label>{t("website.siteGoogleKey")}</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={t("settings.keyPlaceholder")}
                  value={ai.siteGoogleKey}
                  onChange={(e) => setAi((a) => ({ ...a, siteGoogleKey: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
              {w.hasGoogleApiKey && (
                <Button type="button" variant="outline" size="sm" disabled={clearSiteGoogle.isPending} onClick={() => clearSiteGoogle.mutate()}>
                  {t("settings.clearGoogle")}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("website.provider")}</Label>
              <select
                className={nativeSelectClass + " w-full max-w-md"}
                value={ai.aiProvider}
                onChange={(e) => setAi((a) => ({ ...a, aiProvider: e.target.value }))}
              >
                <option value="mock">{t("website.ai.mock")}</option>
                <option value="openai">{t("website.ai.openai")}</option>
                <option value="google">{t("website.ai.google")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("website.model")}</Label>
              {ai.aiProvider === "mock" ? (
                <p className="text-sm text-[var(--color-muted)]">{t("website.mockNoModel")}</p>
              ) : (
                <>
                  <Input
                    id="website-ai-model"
                    list={ai.aiProvider === "openai" ? "openai-models" : "gemini-models"}
                    placeholder={ai.aiProvider === "openai" ? t("website.placeholderOpenai") : t("website.placeholderGemini")}
                    value={ai.aiModel}
                    onChange={(e) => setAi((a) => ({ ...a, aiModel: e.target.value }))}
                    className="max-w-md font-mono text-sm"
                  />
                  <datalist id="openai-models">
                    {OPENAI_MODELS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <datalist id="gemini-models">
                    {GEMINI_MODELS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <p className="text-xs text-[var(--color-muted)]">{t("website.modelHintShort")}</p>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("website.temperature")}</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={2}
                placeholder="0.7"
                value={ai.aiTemperature}
                onChange={(e) => setAi((a) => ({ ...a, aiTemperature: e.target.value }))}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("website.maxTokens")}</Label>
              <Input
                type="number"
                min={1}
                placeholder="8192"
                value={ai.aiMaxTokens}
                onChange={(e) => setAi((a) => ({ ...a, aiMaxTokens: e.target.value }))}
                className="max-w-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("website.fallback")}</Label>
            <select
              className={nativeSelectClass + " max-w-md"}
              value={ai.aiFallbackProvider}
              onChange={(e) => setAi((a) => ({ ...a, aiFallbackProvider: e.target.value }))}
            >
              <option value="">{t("website.fallback.none")}</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </select>
            <p className="text-xs text-[var(--color-muted)]">{t("website.fallbackHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => saveAi.mutate()} disabled={saveAi.isPending}>
              {saveAi.isPending ? t("common.saving") : t("website.saveAi")}
            </Button>
            <Button variant="secondary" type="button" disabled={testAi.isPending || ai.aiProvider === "mock"} onClick={() => testAi.mutate()}>
              {testAi.isPending ? t("website.testingAi") : t("website.testAi")}
            </Button>
            {testAi.isSuccess && <span className="text-sm text-emerald-700">{testAi.data.message}</span>}
            {testAi.isError && (
              <span className="text-sm text-red-600">
                {isAxiosError(testAi.error) && testAi.error.response?.data && typeof testAi.error.response.data === "object"
                  ? String((testAi.error.response.data as { error?: string }).error ?? testAi.error.message)
                  : (testAi.error as Error)?.message ?? t("common.error")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{t("website.wordpress.title")}</CardTitle>
          <CardDescription>{t("website.wordpress.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-[var(--color-border)] bg-zinc-50/80 p-4">
            <p className="text-xs text-[var(--color-muted)]">{t("website.wordpress.hint")}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span>
                {t("website.wordpress.statusLabel")}:{" "}
                {w.hasWpCredentials ? (
                  <Badge variant="secondary">{t("settings.hasKey")}</Badge>
                ) : (
                  <span className="text-[var(--color-muted)]">{t("website.wordpress.notConfigured")}</span>
                )}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("website.wordpress.siteUrl")}</Label>
            <Input
              placeholder="https://example.com"
              value={wp.wpSiteUrl}
              onChange={(e) => setWp((p) => ({ ...p, wpSiteUrl: e.target.value }))}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("website.wordpress.bridgeKey")}</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={w.hasWpCredentials ? t("website.wordpress.bridgePlaceholder") : ""}
              value={wp.wpPluginApiKey}
              onChange={(e) => setWp((p) => ({ ...p, wpPluginApiKey: e.target.value }))}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-[var(--color-muted)]">{t("website.wordpress.bridgeHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("website.wordpress.username")}</Label>
              <Input
                autoComplete="off"
                value={wp.wpUsername}
                onChange={(e) => setWp((p) => ({ ...p, wpUsername: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("website.wordpress.appPassword")}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={w.hasWpCredentials ? "••••••••" : ""}
                value={wp.wpAppPassword}
                onChange={(e) => setWp((p) => ({ ...p, wpAppPassword: e.target.value }))}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-[var(--color-muted)]">{t("website.wordpress.passwordHint")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("website.wordpress.defaultPostStatus")}</Label>
            <select
              className={nativeSelectClass + " max-w-md"}
              value={wp.wpDefaultStatus}
              onChange={(e) => setWp((p) => ({ ...p, wpDefaultStatus: e.target.value }))}
            >
              <option value="draft">{t("website.wordpress.status.draft")}</option>
              <option value="publish">{t("website.wordpress.status.publish")}</option>
              <option value="pending">{t("website.wordpress.status.pending")}</option>
              <option value="private">{t("website.wordpress.status.private")}</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => saveWp.mutate()} disabled={saveWp.isPending}>
              {saveWp.isPending ? t("common.saving") : t("website.wordpress.save")}
            </Button>
            <Button type="button" variant="secondary" disabled={testWp.isPending} onClick={() => testWp.mutate()}>
              {testWp.isPending ? t("website.wordpress.testing") : t("website.wordpress.test")}
            </Button>
            {w.hasWpCredentials && (
              <Button type="button" variant="outline" size="sm" disabled={clearWpPassword.isPending} onClick={() => clearWpPassword.mutate()}>
                {t("website.wordpress.clearPassword")}
              </Button>
            )}
            {w.hasWpPluginKey && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={clearWpPluginKey.isPending}
                onClick={() => {
                  if (!window.confirm(t("website.wordpress.clearBridgeConfirm"))) return;
                  clearWpPluginKey.mutate();
                }}
              >
                {t("website.wordpress.clearBridge")}
              </Button>
            )}
            {testWp.isSuccess && <span className="text-sm text-emerald-700">{testWp.data.message}</span>}
            {testWp.isError && (
              <span className="text-sm text-red-600">
                {isAxiosError(testWp.error) && testWp.error.response?.data && typeof testWp.error.response.data === "object"
                  ? [
                      String((testWp.error.response.data as { error?: string }).error ?? testWp.error.message),
                      (testWp.error.response.data as { message?: string }).message,
                    ]
                      .filter(Boolean)
                      .join(" — ")
                  : (testWp.error as Error)?.message ?? t("common.error")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{t("website.compliance")}</CardTitle>
          <CardDescription>{t("website.complianceDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("website.blacklist")}</Label>
            <Textarea
              className="min-h-[72px] font-mono text-sm"
              value={policy.blacklist}
              onChange={(e) => setPolicy((p) => ({ ...p, blacklist: e.target.value }))}
              placeholder="เช่น รับประกัน, รักษาหาย, อันดับ 1"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("website.forbidden")}</Label>
            <Textarea
              value={policy.forbiddenClaims}
              onChange={(e) => setPolicy((p) => ({ ...p, forbiddenClaims: e.target.value }))}
              placeholder="ข้อความที่แบรนด์นี้ห้ามใช้ในเนื้อหาที่สร้าง"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("website.complianceNotes")}</Label>
            <Textarea
              value={policy.complianceNotes}
              onChange={(e) => setPolicy((p) => ({ ...p, complianceNotes: e.target.value }))}
              placeholder="กฎระเบียบในพื้นที่, ข้อจำกัดการโฆษณา, กระบวนการอนุมัติ"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("website.defaultLength")}</Label>
            <select
              className={nativeSelectClass + " max-w-xs"}
              value={policy.defaultArticleLength}
              onChange={(e) => setPolicy((p) => ({ ...p, defaultArticleLength: e.target.value }))}
            >
              <option value="short">{t("website.length.short")}</option>
              <option value="standard">{t("website.length.standard")}</option>
              <option value="long">{t("website.length.long")}</option>
            </select>
          </div>
          <Button type="button" onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
            {savePolicy.isPending ? t("common.saving") : t("website.savePolicy")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
