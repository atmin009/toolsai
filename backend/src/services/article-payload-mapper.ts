import type { Prisma } from "@prisma/client";
import type { GeneratedArticlePayload } from "./ai/ai.types";

/** Persists schema.org type labels plus example JSON-LD in a single text field. */
export function formatSchemaSuggestionForStorage(payload: GeneratedArticlePayload): string {
  const types = payload.schemaTypes?.length ? payload.schemaTypes.join(", ") : "Article";
  return `Recommended schema.org types: ${types}\n\nExample JSON-LD:\n${payload.schemaSuggestion}`;
}

/** Maps AI output to Prisma Article scalar/JSON fields (shared create + update). */
export function articleDataFromPayload(payload: GeneratedArticlePayload): {
  seoTitle: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  secondaryKeywords: Prisma.InputJsonValue;
  excerpt: string;
  h1: string;
  outline: Prisma.InputJsonValue;
  body: string;
  faq: Prisma.InputJsonValue;
  internalLinkIdeas: Prisma.InputJsonValue;
  suggestedCta: string;
  schemaSuggestion: string;
  imagePrompt: string;
  tagsSuggestion: Prisma.InputJsonValue;
  categoriesSuggestion: Prisma.InputJsonValue;
  wpReadyPayload: Prisma.InputJsonValue;
  lastAutoSavedAt: Date;
} {
  return {
    seoTitle: payload.seoTitle,
    metaTitle: payload.metaTitle,
    metaDescription: payload.metaDescription,
    slug: payload.slug,
    focusKeyword: payload.focusKeyword,
    secondaryKeywords: payload.secondaryKeywords,
    excerpt: payload.excerpt,
    h1: payload.h1,
    outline: payload.outline,
    body: payload.bodyHtml,
    faq: payload.faq,
    internalLinkIdeas: payload.internalLinkIdeas,
    suggestedCta: payload.suggestedCta,
    schemaSuggestion: formatSchemaSuggestionForStorage(payload),
    imagePrompt: payload.imagePrompt,
    tagsSuggestion: payload.tagsSuggestion,
    categoriesSuggestion: payload.categoriesSuggestion,
    wpReadyPayload: {
      ...payload.wpReadyPayload,
      schemaTypes: payload.schemaTypes,
    },
    lastAutoSavedAt: new Date(),
  };
}
