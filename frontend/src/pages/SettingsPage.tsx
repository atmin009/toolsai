import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";

type SettingsResponse = {
  appName: string;
  features: Record<string, boolean>;
  hasOpenaiApiKey: boolean;
  hasGoogleApiKey: boolean;
  hasClaudeApiKey: boolean;
  hasDeepseekApiKey: boolean;
};

export function SettingsPage() {
  const t = useI18n();
  const qc = useQueryClient();
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");

  const q = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await api.get("/settings");
      return data as SettingsResponse;
    },
  });

  useEffect(() => {
    setOpenaiKey("");
    setGoogleKey("");
    setClaudeKey("");
    setDeepseekKey("");
  }, [q.data?.hasOpenaiApiKey, q.data?.hasGoogleApiKey, q.data?.hasClaudeApiKey, q.data?.hasDeepseekApiKey]);

  const saveKeys = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | null> = {};
      if (openaiKey.trim()) payload.openaiApiKey = openaiKey.trim();
      if (googleKey.trim()) payload.googleApiKey = googleKey.trim();
      if (claudeKey.trim()) payload.claudeApiKey = claudeKey.trim();
      if (deepseekKey.trim()) payload.deepseekApiKey = deepseekKey.trim();
      await api.patch("/settings", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setOpenaiKey("");
      setGoogleKey("");
      setClaudeKey("");
      setDeepseekKey("");
    },
  });

  const clearOpenai = useMutation({
    mutationFn: async () => {
      await api.patch("/settings", { openaiApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const clearGoogle = useMutation({
    mutationFn: async () => {
      await api.patch("/settings", { googleApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const clearClaude = useMutation({
    mutationFn: async () => {
      await api.patch("/settings", { claudeApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const clearDeepseek = useMutation({
    mutationFn: async () => {
      await api.patch("/settings", { deepseekApiKey: null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="space-y-8">
      <PageHeader title={t("settings.title")} description={t("settings.desc")} />

      <Card className="max-w-2xl border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{t("settings.appSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {q.isLoading && <p className="text-[var(--color-muted)]">{t("common.loading")}</p>}
          {q.data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--color-muted)]">{t("settings.name")}</span>
                <span className="font-medium text-zinc-900">{q.data.appName}</span>
              </div>
              {Object.keys(q.data.features).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{t("settings.features")}</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(q.data.features).map(([k, on]) => (
                      <Badge key={k} variant={on ? "default" : "outline"}>
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <p className="rounded-xl border border-[var(--color-border)] bg-zinc-50/80 p-4 text-xs leading-relaxed text-zinc-600">
                {t("settings.wpNote")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
        <CardHeader>
          <CardTitle>{t("settings.apiSection")}</CardTitle>
          <CardDescription>{t("settings.apiSectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              OpenAI: {q.data?.hasOpenaiApiKey ? <Badge>{t("settings.hasKey")}</Badge> : <span className="text-[var(--color-muted)]">{t("settings.noKey")}</span>}
            </span>
            <span>
              Google: {q.data?.hasGoogleApiKey ? <Badge>{t("settings.hasKey")}</Badge> : <span className="text-[var(--color-muted)]">{t("settings.noKey")}</span>}
            </span>
            <span>
              Claude: {q.data?.hasClaudeApiKey ? <Badge>{t("settings.hasKey")}</Badge> : <span className="text-[var(--color-muted)]">{t("settings.noKey")}</span>}
            </span>
            <span>
              DeepSeek: {q.data?.hasDeepseekApiKey ? <Badge>{t("settings.hasKey")}</Badge> : <span className="text-[var(--color-muted)]">{t("settings.noKey")}</span>}
            </span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-key">{t("settings.openaiKey")}</Label>
            <Input
              id="openai-key"
              type="password"
              autoComplete="off"
              placeholder={t("settings.keyPlaceholder")}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            {q.data?.hasOpenaiApiKey && (
              <Button type="button" variant="outline" size="sm" disabled={clearOpenai.isPending} onClick={() => clearOpenai.mutate()}>
                {t("settings.clearOpenai")}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-key">{t("settings.googleKey")}</Label>
            <Input
              id="google-key"
              type="password"
              autoComplete="off"
              placeholder={t("settings.keyPlaceholder")}
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
            />
            {q.data?.hasGoogleApiKey && (
              <Button type="button" variant="outline" size="sm" disabled={clearGoogle.isPending} onClick={() => clearGoogle.mutate()}>
                {t("settings.clearGoogle")}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="claude-key">{t("settings.claudeKey")}</Label>
            <Input
              id="claude-key"
              type="password"
              autoComplete="off"
              placeholder={t("settings.keyPlaceholder")}
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
            />
            {q.data?.hasClaudeApiKey && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={clearClaude.isPending}
                onClick={() => clearClaude.mutate()}
              >
                {t("settings.clearClaude")}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deepseek-key">{t("settings.deepseekKey")}</Label>
            <Input
              id="deepseek-key"
              type="password"
              autoComplete="off"
              placeholder={t("settings.keyPlaceholder")}
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
            />
            {q.data?.hasDeepseekApiKey && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={clearDeepseek.isPending}
                onClick={() => clearDeepseek.mutate()}
              >
                {t("settings.clearDeepseek")}
              </Button>
            )}
          </div>
          <Button
            type="button"
            onClick={() => saveKeys.mutate()}
            disabled={saveKeys.isPending || (!openaiKey.trim() && !googleKey.trim() && !claudeKey.trim() && !deepseekKey.trim())}
          >
            {saveKeys.isPending ? t("settings.savingKeys") : t("settings.saveKeys")}
          </Button>
          {saveKeys.isSuccess && <p className="text-sm text-emerald-700">{t("settings.keysSaved")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
