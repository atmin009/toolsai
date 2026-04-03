import { z } from "zod";

const articleLengthEnum = z.enum(["short", "standard", "long"]);
const aiProviderEnum = z.enum(["mock", "openai", "google", "claude"]);

export const websiteCreateSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  brandName: z.string().min(1),
  niche: z.string().min(1),
  defaultLanguage: z.string().min(2).optional(),
  targetAudience: z.string().min(1),
  toneOfVoice: z.string().min(1),
  seoRules: z.string().optional().nullable(),
  keywordBlacklist: z.array(z.string()).optional(),
  forbiddenClaims: z.string().optional().nullable(),
  complianceNotes: z.string().optional().nullable(),
  defaultArticleLength: articleLengthEnum.optional(),
  aiProvider: aiProviderEnum.optional(),
  aiModel: z.string().optional().nullable(),
  aiTemperature: z.number().min(0).max(2).optional().nullable(),
  aiMaxTokens: z.number().int().positive().max(128_000).optional().nullable(),
  aiFallbackProvider: z.enum(["openai", "google", "claude"]).optional().nullable(),
  openaiApiKey: z.string().optional().nullable(),
  googleApiKey: z.string().optional().nullable(),
  claudeApiKey: z.string().optional().nullable(),
  wpSiteUrl: z.string().max(2048).optional().nullable(),
  wpUsername: z.string().max(191).optional().nullable(),
  wpApplicationPassword: z.string().optional().nullable(),
  wpDefaultStatus: z.enum(["draft", "publish", "pending", "private"]).optional(),
  articleGoals: z.array(z.enum(["traffic", "conversion", "education", "comparison", "branding"])).default([]),
  keywordGroups: z
    .array(
      z.object({
        type: z.enum(["primary", "secondary"]),
        label: z.string().min(1),
        keywords: z.array(z.string()).min(1),
      })
    )
    .optional(),
  categories: z.array(z.object({ name: z.string().min(1), description: z.string().optional() })).optional(),
});

export const websiteUpdateSchema = websiteCreateSchema.partial();

export const websiteDuplicateSchema = z.object({
  name: z.string().min(1).optional(),
});

/** Optional overrides for POST /wordpress/test — tests current form without requiring save first. */
export const wordpressTestSchema = z.object({
  wpSiteUrl: z.string().max(2048).optional(),
  wpUsername: z.string().max(191).optional(),
  wpApplicationPassword: z.string().optional(),
});
