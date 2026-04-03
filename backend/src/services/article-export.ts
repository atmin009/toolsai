import type { Article, PlannedTopic } from "@prisma/client";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bodyToMarkdown(body: string | null): string {
  if (!body) return "";
  return body
    .replace(/<\/?h1[^>]*>/gi, "\n# ")
    .replace(/<\/?h2[^>]*>/gi, "\n## ")
    .replace(/<\/?h3[^>]*>/gi, "\n### ")
    .replace(/<\/?p[^>]*>/gi, "\n\n")
    .replace(/<\/?li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ExportFormat = "html" | "markdown" | "json";

export function buildArticleExport(
  article: Article & { plannedTopic: PlannedTopic },
  format: ExportFormat
): { content: string; contentType: string; filename: string } {
  const slug =
    (article.slug ?? article.plannedTopic.proposedTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "article";

  if (format === "json") {
    const payload = {
      exportedAt: new Date().toISOString(),
      language: article.language,
      articleLength: article.articleLength,
      topic: {
        id: article.plannedTopic.id,
        proposedTitle: article.plannedTopic.proposedTitle,
        primaryKeyword: article.plannedTopic.primaryKeyword,
        status: article.plannedTopic.status,
        source: article.plannedTopic.source,
      },
      seo: {
        seoTitle: article.seoTitle,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        slug: article.slug,
        focusKeyword: article.focusKeyword,
        secondaryKeywords: article.secondaryKeywords,
        excerpt: article.excerpt,
      },
      content: {
        h1: article.h1,
        outline: article.outline,
        bodyHtml: article.body,
        faq: article.faq,
        suggestedCta: article.suggestedCta,
        internalLinkIdeas: article.internalLinkIdeas,
        schemaSuggestion: article.schemaSuggestion,
        imagePrompt: article.imagePrompt,
        coverImageUrl: article.coverImageUrl,
        wpPostId: article.wpPostId,
        wpPostUrl: article.wpPostUrl,
        wpLastPushedAt: article.wpLastPushedAt?.toISOString() ?? null,
        wpCategoryIds: article.wpCategoryIds,
        wpTagIds: article.wpTagIds,
        tagsSuggestion: article.tagsSuggestion,
        categoriesSuggestion: article.categoriesSuggestion,
        wpReadyPayload: article.wpReadyPayload,
      },
    };
    return {
      content: JSON.stringify(payload, null, 2),
      contentType: "application/json; charset=utf-8",
      filename: `${slug}.json`,
    };
  }

  if (format === "html") {
    const title = escapeHtml(article.metaTitle ?? article.plannedTopic.proposedTitle);
    const html = `<!DOCTYPE html>
<html lang="${escapeHtml(article.language)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
</head>
<body>
${article.coverImageUrl ? `<figure class="cover"><img src="${escapeHtml(article.coverImageUrl)}" alt=""/></figure>\n` : ""}
${article.body ?? ""}
</body>
</html>`;
    return {
      content: html,
      contentType: "text/html; charset=utf-8",
      filename: `${slug}.html`,
    };
  }

  const md = [
    `# ${article.h1 ?? article.plannedTopic.proposedTitle}`,
    "",
    `**Language:** ${article.language}  `,
    article.articleLength ? `**Length:** ${article.articleLength}  ` : "",
    "",
    bodyToMarkdown(article.body),
    "",
    article.suggestedCta ? `## CTA\n\n${article.suggestedCta}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content: md,
    contentType: "text/markdown; charset=utf-8",
    filename: `${slug}.md`,
  };
}
