import { Prisma, TopicStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { asStringArray } from "../lib/jsonArrays";
import {
  generateArticle as aiGenerateArticle,
  generateSEOFields as aiGenerateSEOFields,
  getAIServiceForWebsite,
  improveArticle as aiImproveArticle,
} from "./ai";
import { buildArticleExport, type ExportFormat } from "./article-export";
import { articleDataFromPayload } from "./article-payload-mapper";
import { scoreArticleChecklist } from "./article-score";
import { articleSnapshot, saveArticleVersion } from "./article-versioning";
import { loadWebsiteContext, toAIWebsiteContext } from "./website-context";
import type { z } from "zod";
import type { Article, MonthlyPlan, PlannedTopic, Website } from "@prisma/client";
import { articleUpdateSchema } from "../validation/article.schema";

type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

export type ArticleWithSite = Article & {
  plannedTopic: PlannedTopic & {
    monthlyPlan: MonthlyPlan & { website: Website };
  };
};

/** Hides `wpApplicationPassword` and exposes `hasWpCredentials` on nested website. */
export function sanitizeArticleForClient(article: ArticleWithSite) {
  const w = article.plannedTopic.monthlyPlan.website;
  const hasWpPluginKey = !!w.wpPluginApiKey?.trim();
  const hasWpCredentials = !!(
    (w.wpSiteUrl?.trim() && hasWpPluginKey) ||
    (w.wpSiteUrl?.trim() && w.wpUsername?.trim() && w.wpApplicationPassword?.trim())
  );
  const { wpApplicationPassword: _omit, wpPluginApiKey: _omit2, ...safeW } = w;
  return {
    ...article,
    plannedTopic: {
      ...article.plannedTopic,
      monthlyPlan: {
        ...article.plannedTopic.monthlyPlan,
        website: {
          ...safeW,
          hasWpCredentials,
          hasWpPluginKey,
        },
      },
    },
  };
}

function assertApprovedTopicCanGenerateArticle(topic: {
  status: TopicStatus;
  article: { id: string } | null;
}): void {
  if (topic.status === TopicStatus.generating_article) {
    throw new AppError(409, "Article generation is already in progress for this topic.");
  }
  const hasArticle = topic.article != null;
  if (!hasArticle) {
    if (topic.status !== TopicStatus.approved_topic) {
      throw new AppError(400, "Only approved topics can generate articles. Approve the topic first.");
    }
    return;
  }
  if (topic.status !== TopicStatus.article_draft && topic.status !== TopicStatus.approved_topic) {
    throw new AppError(400, "Cannot regenerate the article for this topic in its current state.");
  }
}

export async function generateArticleForTopic(topicId: string, userId?: string | null) {
  const topic = await prisma.plannedTopic.findUnique({
    where: { id: topicId },
    include: { monthlyPlan: true, article: true },
  });
  if (!topic) throw new AppError(404, "Topic not found");

  assertApprovedTopicCanGenerateArticle(topic);

  const previousStatus = topic.status;
  const loaded = await loadWebsiteContext(topic.monthlyPlan.websiteId);
  const ai = await getAIServiceForWebsite(loaded.website, userId);
  const website = toAIWebsiteContext(loaded);

  await prisma.plannedTopic.update({
    where: { id: topicId },
    data: { status: TopicStatus.generating_article },
  });

  try {
    const lenRaw = topic.article?.articleLength ?? loaded.website.defaultArticleLength;
    const articleLength =
      lenRaw === "short" || lenRaw === "long" || lenRaw === "standard" ? lenRaw : "standard";
    const language = topic.article?.language ?? loaded.website.defaultLanguage;

    const productMentions = Array.isArray(topic.productMentions)
      ? (topic.productMentions as { name: string; url?: string; highlights?: string; price?: string; note?: string }[])
      : [];

    const payload = await aiGenerateArticle(
      ai,
      website,
      {
        proposedTitle: topic.proposedTitle,
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords: asStringArray(topic.secondaryKeywords),
        searchIntent: topic.searchIntent,
        articleType: topic.articleType,
        brief: topic.brief,
        ...(productMentions.length > 0 ? { productMentions } : {}),
      },
      { language, articleLength }
    );

    const fields = articleDataFromPayload(payload);
    const row = { ...fields, language, articleLength };

    const article = await prisma.$transaction(async (tx) => {
      const art =
        topic.article?.id != null
          ? await tx.article.update({
              where: { id: topic.article!.id },
              data: {
                ...row,
                currentVersion: { increment: 1 },
              },
            })
          : await tx.article.create({
              data: {
                plannedTopicId: topic.id,
                ...row,
                currentVersion: 1,
              },
            });

      await tx.plannedTopic.update({
        where: { id: topicId },
        data: { status: TopicStatus.article_draft },
      });

      await tx.articleVersion.create({
        data: {
          articleId: art.id,
          version: art.currentVersion,
          snapshot: articleSnapshot(art) as object,
        },
      });

      return art;
    });

    return article;
  } catch (e) {
    await prisma.plannedTopic.update({
      where: { id: topicId },
      data: { status: previousStatus },
    });
    throw e;
  }
}

export async function getArticleById(id: string): Promise<ArticleWithSite> {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { plannedTopic: { include: { monthlyPlan: { include: { website: true } } } } },
  });
  if (!article) throw new AppError(404, "Article not found");
  return article;
}

export async function updateArticle(id: string, input: ArticleUpdateInput) {
  const { createVersion, ...fields } = input;

  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Article not found");

  const article = await prisma.article.update({
    where: { id },
    data: {
      seoTitle: fields.seoTitle ?? undefined,
      metaTitle: fields.metaTitle ?? undefined,
      metaDescription: fields.metaDescription ?? undefined,
      slug: fields.slug ?? undefined,
      focusKeyword: fields.focusKeyword ?? undefined,
      secondaryKeywords: fields.secondaryKeywords ?? undefined,
      excerpt: fields.excerpt ?? undefined,
      h1: fields.h1 ?? undefined,
      outline: fields.outline === null ? Prisma.JsonNull : fields.outline ?? undefined,
      body: fields.body ?? undefined,
      faq: fields.faq === null ? Prisma.JsonNull : fields.faq ?? undefined,
      internalLinkIdeas:
        fields.internalLinkIdeas === null ? Prisma.JsonNull : fields.internalLinkIdeas ?? undefined,
      suggestedCta: fields.suggestedCta ?? undefined,
      schemaSuggestion: fields.schemaSuggestion ?? undefined,
      imagePrompt: fields.imagePrompt ?? undefined,
      coverImageUrl: fields.coverImageUrl !== undefined ? fields.coverImageUrl : undefined,
      tagsSuggestion: fields.tagsSuggestion ?? undefined,
      categoriesSuggestion: fields.categoriesSuggestion ?? undefined,
      wpReadyPayload:
        fields.wpReadyPayload === null
          ? Prisma.JsonNull
          : (fields.wpReadyPayload as Prisma.InputJsonValue | undefined),
      wpCategoryIds:
        fields.wpCategoryIds !== undefined ? (fields.wpCategoryIds as Prisma.InputJsonValue) : undefined,
      wpTagIds: fields.wpTagIds !== undefined ? (fields.wpTagIds as Prisma.InputJsonValue) : undefined,
      language: fields.language ?? undefined,
      articleLength: fields.articleLength ?? undefined,
      lastAutoSavedAt: new Date(),
    },
  });

  if (createVersion) {
    const bumped = await prisma.article.update({
      where: { id },
      data: { currentVersion: { increment: 1 } },
    });
    await saveArticleVersion(bumped.id, bumped);
    return bumped;
  }

  return article;
}

export async function listArticleVersions(articleId: string) {
  return prisma.articleVersion.findMany({
    where: { articleId },
    orderBy: { version: "desc" },
  });
}

export async function improveArticleBody(id: string, instruction: string, userId?: string | null) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { plannedTopic: { include: { monthlyPlan: true } } },
  });
  if (!article) throw new AppError(404, "Article not found");

  const loaded = await loadWebsiteContext(article.plannedTopic.monthlyPlan.websiteId);
  const ai = await getAIServiceForWebsite(loaded.website, userId);
  const result = await aiImproveArticle(ai, article.body ?? "", instruction, toAIWebsiteContext(loaded));

  return prisma.article.update({
    where: { id },
    data: { body: result.bodyHtml, lastAutoSavedAt: new Date() },
  });
}

export async function generateArticleSEOFields(id: string, userId?: string | null) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { plannedTopic: { include: { monthlyPlan: true } } },
  });
  if (!article) throw new AppError(404, "Article not found");

  const loaded = await loadWebsiteContext(article.plannedTopic.monthlyPlan.websiteId);
  const ai = await getAIServiceForWebsite(loaded.website, userId);
  return aiGenerateSEOFields(ai, {
    website: toAIWebsiteContext(loaded),
    bodyHtml: article.body ?? "",
    title: article.plannedTopic.proposedTitle,
    primaryKeyword: article.focusKeyword ?? article.plannedTopic.primaryKeyword,
  });
}

export async function listArticles(filters: {
  websiteId?: string;
  q?: string;
  topicStatus?: TopicStatus;
  sortBy?: "date" | "updated" | "title";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  const q = filters.q?.trim();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.ArticleWhereInput = {
    plannedTopic: {
      ...(filters.websiteId ? { monthlyPlan: { websiteId: filters.websiteId } } : {}),
      ...(filters.topicStatus ? { status: filters.topicStatus } : {}),
      ...(q
        ? {
            OR: [
              { proposedTitle: { contains: q } },
              { primaryKeyword: { contains: q } },
              { brief: { contains: q } },
            ],
          }
        : {}),
    },
  };
  const sortBy = filters.sortBy ?? "date";
  const order = filters.order === "desc" ? "desc" : "asc";
  const orderBy: Prisma.ArticleOrderByWithRelationInput =
    sortBy === "title"
      ? { plannedTopic: { proposedTitle: order } }
      : sortBy === "updated"
        ? { updatedAt: order }
        : { plannedTopic: { recommendedPublishDate: order } };

  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        plannedTopic: {
          select: {
            id: true,
            proposedTitle: true,
            status: true,
            recommendedPublishDate: true,
            source: true,
            monthlyPlan: { select: { websiteId: true, year: true, month: true } },
          },
        },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function exportArticleDocument(id: string, format: ExportFormat) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { plannedTopic: true },
  });
  if (!article) throw new AppError(404, "Article not found");
  return buildArticleExport(article, format);
}

export async function getArticleScoreChecklist(id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw new AppError(404, "Article not found");
  return scoreArticleChecklist(article);
}
