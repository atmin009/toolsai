import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, Globe } from "lucide-react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function WebsitesPage() {
  const t = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const { data } = await api.get("/websites");
      return data as {
        items: {
          id: string;
          name: string;
          domain: string;
          brandName: string;
          niche: string;
          _count: { monthlyPlans: number };
        }[];
      };
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    domain: "",
    brandName: "",
    niche: "",
    defaultLanguage: "th",
    targetAudience: "",
    toneOfVoice: "",
    seoRules: "",
    keywordBlacklist: "",
  });

  const createWebsite = useMutation({
    mutationFn: async () => {
      const keywordBlacklist = draft.keywordBlacklist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: draft.name.trim(),
        domain: draft.domain.trim(),
        brandName: draft.brandName.trim(),
        niche: draft.niche.trim(),
        defaultLanguage: draft.defaultLanguage.trim() || undefined,
        targetAudience: draft.targetAudience.trim(),
        toneOfVoice: draft.toneOfVoice.trim(),
        seoRules: draft.seoRules.trim() || null,
        keywordBlacklist: keywordBlacklist.length ? keywordBlacklist : undefined,
      };

      const { data } = await api.post("/websites", payload);
      return data as { website: { id: string } };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["websites"] });
      setCreateOpen(false);
      setDraft({
        name: "",
        domain: "",
        brandName: "",
        niche: "",
        defaultLanguage: "th",
        targetAudience: "",
        toneOfVoice: "",
        seoRules: "",
        keywordBlacklist: "",
      });
      window.location.href = `/websites/${data.website.id}`;
    },
  });

  const deleteWebsite = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/websites/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["websites"] }),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("nav.websites")}
        description={t("websites.desc")}
        actions={
          <Button
            type="button"
            variant={createOpen ? "secondary" : "default"}
            size="sm"
            onClick={() => setCreateOpen((o) => !o)}
            disabled={createWebsite.isPending}
          >
            {createOpen ? "ยกเลิก" : "เพิ่มเว็บไซต์"}
          </Button>
        }
      />

      {q.isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse border-0 ring-1 ring-zinc-200/80">
              <CardContent className="h-40 p-6" />
            </Card>
          ))}
        </div>
      )}

      {createOpen && (
        <Card className="border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80">
          <CardHeader>
            <CardTitle>สร้างเว็บไซต์ใหม่</CardTitle>
            <CardDescription>ข้อมูลขั้นต่ำสำหรับสร้างโปรไฟล์เพื่อใช้ในระบบวางแผน AI</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>ชื่อเว็บไซต์</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>โดเมน</Label>
              <Input value={draft.domain} onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Brand name</Label>
              <Input value={draft.brandName} onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Niche</Label>
              <Input value={draft.niche} onChange={(e) => setDraft((d) => ({ ...d, niche: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>ภาษาเริ่มต้น</Label>
              <select
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                value={draft.defaultLanguage}
                onChange={(e) => setDraft((d) => ({ ...d, defaultLanguage: e.target.value }))}
              >
                <option value="th">ไทย (TH)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>SEO rules (optional)</Label>
              <Input value={draft.seoRules} onChange={(e) => setDraft((d) => ({ ...d, seoRules: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Target audience</Label>
              <Textarea
                className="min-h-[96px]"
                value={draft.targetAudience}
                onChange={(e) => setDraft((d) => ({ ...d, targetAudience: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tone of voice</Label>
              <Textarea
                className="min-h-[96px]"
                value={draft.toneOfVoice}
                onChange={(e) => setDraft((d) => ({ ...d, toneOfVoice: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Keyword blacklist (comma-separated, optional)</Label>
              <Input
                placeholder="เช่น guaranteed, miracle cure"
                value={draft.keywordBlacklist}
                onChange={(e) => setDraft((d) => ({ ...d, keywordBlacklist: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <Button
                type="button"
                disabled={createWebsite.isPending}
                onClick={() => createWebsite.mutate()}
              >
                {createWebsite.isPending ? "กำลังสร้าง…" : "สร้างเว็บไซต์"}
              </Button>
              {createWebsite.isError && (
                <p className="text-sm text-red-600">สร้างไม่สำเร็จ</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {q.data?.items.map((w) => (
          <Link key={w.id} to={`/websites/${w.id}`} className="group block">
            <Card className="h-full border-0 shadow-[var(--shadow-soft)] ring-1 ring-zinc-200/80 transition-all hover:ring-violet-200 hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-violet-100 group-hover:text-violet-700">
                      <Globe className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-lg">{w.name}</CardTitle>
                      <CardDescription className="mt-1 font-mono text-xs">{w.domain}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!window.confirm("ต้องการลบเว็บไซต์นี้หรือไม่?")) return;
                        deleteWebsite.mutate(w.id);
                      }}
                      disabled={deleteWebsite.isPending}
                      aria-label="Delete website"
                    >
                      ลบ
                    </Button>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-normal">
                    {w.brandName}
                  </Badge>
                  <Badge variant="outline" className="border-violet-200 bg-violet-50/80 font-normal text-violet-900">
                    {w.niche}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {w._count.monthlyPlans} {t("websites.monthsSaved")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
