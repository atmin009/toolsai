import { z } from "zod";

const productMentionSchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  highlights: z.string().optional(),
  price: z.string().optional(),
  note: z.string().optional(),
});

export const topicUpdateSchema = z.object({
  proposedTitle: z.string().min(1).optional(),
  primaryKeyword: z.string().min(1).optional(),
  secondaryKeywords: z.array(z.string()).optional(),
  searchIntent: z.string().min(1).optional(),
  articleType: z.string().min(1).optional(),
  brief: z.string().min(1).optional(),
  recommendedPublishDate: z.string().datetime().optional(),
  productMentions: z.array(productMentionSchema).optional(),
  status: z
    .enum([
      "draft_topic",
      "approved_topic",
      "generating_article",
      "article_draft",
      "ready_for_publish",
      "published_later",
    ])
    .optional(),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const manualTopicCreateSchema = z.object({
  websiteId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  proposedTitle: z.string().min(1),
  primaryKeyword: z.string().min(1),
  secondaryKeywords: z.array(z.string()).default([]),
  searchIntent: z.string().min(1),
  articleType: z.string().min(1),
  brief: z.string().min(1),
  productMentions: z.array(productMentionSchema).default([]),
  recommendedPublishDate: z.string().datetime(),
});
