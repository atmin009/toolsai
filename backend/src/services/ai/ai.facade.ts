import type {
  AIService,
  ApprovedTopic,
  ArticleDraft,
  GeneratedArticlePayload,
  GeneratedTopic,
  PlannerConfig,
  WebsiteProfile,
} from "./ai.types";

/**
 * Provider-agnostic entry points. Pass any `AIService` implementation
 * (mock today, OpenAI / Anthropic / Bedrock tomorrow).
 */
export async function generateTopics(
  provider: AIService,
  websiteProfile: WebsiteProfile,
  plannerConfig: PlannerConfig
): Promise<GeneratedTopic[]> {
  return provider.generateTopics({
    website: websiteProfile,
    year: plannerConfig.year,
    month: plannerConfig.month,
    postsPerDay: plannerConfig.postsPerDay,
    fromDay: plannerConfig.fromDay,
    toDay: plannerConfig.toDay,
  });
}

export async function regenerateTopic(
  provider: AIService,
  websiteProfile: WebsiteProfile,
  oldTopic: GeneratedTopic,
  publishDateIso?: string
): Promise<GeneratedTopic> {
  const iso = publishDateIso ?? new Date().toISOString().slice(0, 10);
  return provider.regenerateTopic({
    website: websiteProfile,
    existing: oldTopic,
    publishDateIso: iso,
  });
}

export async function generateArticle(
  provider: AIService,
  websiteProfile: WebsiteProfile,
  approvedTopic: ApprovedTopic,
  options?: { language?: string; articleLength?: "short" | "standard" | "long" }
): Promise<GeneratedArticlePayload> {
  return provider.generateArticle({
    website: websiteProfile,
    topic: approvedTopic,
    options,
  });
}

export async function generateSEOFields(
  provider: AIService,
  articleDraft: ArticleDraft
): Promise<Pick<GeneratedArticlePayload, "metaTitle" | "metaDescription" | "slug">> {
  return provider.generateSEOFields({
    website: articleDraft.website,
    bodyHtml: articleDraft.bodyHtml,
    topicTitle: articleDraft.title,
    primaryKeyword: articleDraft.primaryKeyword,
  });
}

/**
 * Refine HTML body from a natural-language instruction.
 * Optional `websiteProfile` lets a real LLM apply brand voice; the mock ignores it if omitted.
 */
export async function improveArticle(
  provider: AIService,
  content: string,
  instruction: string,
  websiteProfile?: WebsiteProfile
): Promise<{ bodyHtml: string }> {
  const website =
    websiteProfile ??
    ({
      brandName: "",
      niche: "general",
      toneOfVoice: "neutral",
      targetAudience: "readers",
      seoRules: null,
      categories: [],
      primaryThemes: [],
      secondaryThemes: [],
      articleGoals: [],
      defaultLanguage: "en",
      keywordBlacklist: [],
      forbiddenClaims: null,
      complianceNotes: null,
      defaultArticleLength: "standard",
    } satisfies WebsiteProfile);

  return provider.improveArticle({
    website,
    bodyHtml: content,
    instruction,
  });
}
