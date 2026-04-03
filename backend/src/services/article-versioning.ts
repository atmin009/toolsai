import type { Article } from "@prisma/client";
import { prisma } from "../lib/prisma";

export function articleSnapshot(article: Article) {
  return {
    language: article.language,
    articleLength: article.articleLength,
    seoTitle: article.seoTitle,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    slug: article.slug,
    focusKeyword: article.focusKeyword,
    secondaryKeywords: article.secondaryKeywords,
    excerpt: article.excerpt,
    h1: article.h1,
    outline: article.outline,
    body: article.body,
    faq: article.faq,
    internalLinkIdeas: article.internalLinkIdeas,
    suggestedCta: article.suggestedCta,
    schemaSuggestion: article.schemaSuggestion,
    imagePrompt: article.imagePrompt,
    coverImageUrl: article.coverImageUrl,
    tagsSuggestion: article.tagsSuggestion,
    categoriesSuggestion: article.categoriesSuggestion,
    wpReadyPayload: article.wpReadyPayload,
    wpPostId: article.wpPostId,
    wpPostUrl: article.wpPostUrl,
    wpLastPushedAt: article.wpLastPushedAt,
    wpCategoryIds: article.wpCategoryIds,
    wpTagIds: article.wpTagIds,
  };
}

export async function saveArticleVersion(articleId: string, article: Article) {
  const nextVersion = article.currentVersion;
  await prisma.articleVersion.create({
    data: {
      articleId,
      version: nextVersion,
      snapshot: articleSnapshot(article) as object,
    },
  });
}
