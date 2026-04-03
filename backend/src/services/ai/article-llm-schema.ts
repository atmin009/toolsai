import { z } from "zod";
import type { GeneratedArticlePayload } from "./ai.types";

const outlineItem = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

export const generatedArticlePayloadJsonSchema = z
  .object({
    seoTitle: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    slug: z.string(),
    focusKeyword: z.string(),
    secondaryKeywords: z.array(z.string()),
    excerpt: z.string(),
    h1: z.string(),
    outline: z.array(outlineItem),
    bodyHtml: z.string(),
    faq: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    ),
    internalLinkIdeas: z.array(
      z.object({
        anchor: z.string(),
        note: z.string(),
      })
    ),
    suggestedCta: z.string(),
    schemaTypes: z.array(z.string()).optional(),
    schemaSuggestion: z.string(),
    imagePrompt: z.string(),
    tagsSuggestion: z.array(z.string()),
    categoriesSuggestion: z.array(z.string()),
    wpReadyPayload: z.record(z.string(), z.unknown()).optional(),
  })
  .transform(
    (d): GeneratedArticlePayload => ({
      ...d,
      schemaTypes: d.schemaTypes ?? ["Article", "FAQPage"],
      wpReadyPayload: (d.wpReadyPayload ?? {}) as Record<string, unknown>,
    })
  );

export function parseGeneratedArticlePayload(raw: unknown): GeneratedArticlePayload {
  return generatedArticlePayloadJsonSchema.parse(raw);
}
