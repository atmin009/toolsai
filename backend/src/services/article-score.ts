import type { Article } from "@prisma/client";

export type ChecklistItem = { id: string; label: string; pass: boolean; weight: number };

/** Editorial + SEO readiness score (deterministic from stored fields). */
export function scoreArticleChecklist(article: Article): {
  items: ChecklistItem[];
  passed: number;
  total: number;
  weightedScore: number;
  maxWeight: number;
} {
  const items: ChecklistItem[] = [
    { id: "meta_title", label: "Meta title", pass: !!(article.metaTitle?.trim()), weight: 2 },
    { id: "meta_description", label: "Meta description", pass: !!(article.metaDescription?.trim()), weight: 2 },
    { id: "slug", label: "URL slug", pass: !!(article.slug?.trim()), weight: 1 },
    { id: "focus_keyword", label: "Focus keyword", pass: !!(article.focusKeyword?.trim()), weight: 1 },
    { id: "h1", label: "H1", pass: !!(article.h1?.trim()), weight: 1 },
    { id: "outline", label: "Outline (H2/H3)", pass: article.outline != null && JSON.stringify(article.outline) !== "[]", weight: 1 },
    { id: "body", label: "Article body", pass: !!(article.body?.trim()), weight: 3 },
    { id: "faq", label: "FAQ block", pass: article.faq != null && JSON.stringify(article.faq) !== "[]", weight: 1 },
    { id: "cta", label: "CTA suggestion", pass: !!(article.suggestedCta?.trim()), weight: 1 },
    { id: "internal_links", label: "Internal link ideas", pass: article.internalLinkIdeas != null && JSON.stringify(article.internalLinkIdeas) !== "[]", weight: 1 },
    { id: "schema", label: "Schema / structured data notes", pass: !!(article.schemaSuggestion?.trim()), weight: 1 },
    { id: "language", label: "Language set", pass: !!(article.language?.trim()), weight: 1 },
  ];

  const maxWeight = items.reduce((s, i) => s + i.weight, 0);
  const weightedScore = items.reduce((s, i) => s + (i.pass ? i.weight : 0), 0);
  const passed = items.filter((i) => i.pass).length;

  return { items, passed, total: items.length, weightedScore, maxWeight };
}
