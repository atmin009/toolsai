import { z } from "zod";

const articleLengthEnum = z.enum(["short", "standard", "long"]);

export const articleUpdateSchema = z.object({
  language: z.string().min(2).optional(),
  articleLength: articleLengthEnum.optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  focusKeyword: z.string().optional().nullable(),
  secondaryKeywords: z.array(z.string()).optional(),
  excerpt: z.string().optional().nullable(),
  h1: z.string().optional().nullable(),
  outline: z
    .array(z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string() }))
    .optional()
    .nullable(),
  body: z.string().optional().nullable(),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .optional()
    .nullable(),
  internalLinkIdeas: z
    .array(z.object({ anchor: z.string(), note: z.string() }))
    .optional()
    .nullable(),
  suggestedCta: z.string().optional().nullable(),
  schemaSuggestion: z.string().optional().nullable(),
  imagePrompt: z.string().optional().nullable(),
  coverImageUrl: z.string().max(2048).optional().nullable(),
  tagsSuggestion: z.array(z.string()).optional(),
  categoriesSuggestion: z.array(z.string()).optional(),
  wpReadyPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  wpCategoryIds: z.array(z.number().int().positive()).optional(),
  wpTagIds: z.array(z.number().int().positive()).optional(),
  createVersion: z.boolean().optional(),
});

export const improveArticleSchema = z.object({
  instruction: z.string().min(1),
});

export const wordpressPublishSchema = z.object({
  status: z.enum(["draft", "publish", "pending", "private"]).optional(),
  /** Optional override; if omitted, uses values stored on the article. */
  wpCategoryIds: z.array(z.number().int().positive()).optional(),
  wpTagIds: z.array(z.number().int().positive()).optional(),
});

export const coverBatchSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});
