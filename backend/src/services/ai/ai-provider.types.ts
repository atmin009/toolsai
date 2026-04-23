import type { GeneratedArticlePayload, GeneratedTopic, WebsiteContext } from "./ai.types";

/** Inputs aligned with existing AIService methods — used by all LLM providers. */
export type GenerateTopicsInput = {
  website: WebsiteContext;
  year: number;
  month: number;
  postsPerDay: number;
  /** Inclusive; when set with toDay, prompts and merge use only this slice (same global slot order). */
  fromDay?: number;
  toDay?: number;
  /** Existing primary keywords in this website — AI should avoid generating duplicates. */
  existingKeywords?: string[];
};

export type RegenerateTopicInput = {
  website: WebsiteContext;
  existing: GeneratedTopic;
  publishDateIso: string;
};

export type GenerateArticleInput = {
  website: WebsiteContext;
  topic: {
    proposedTitle: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    searchIntent: string;
    articleType: string;
    brief: string;
  };
  options?: {
    language?: string;
    articleLength?: "short" | "standard" | "long";
  };
};

export type GenerateSEOInput = {
  website: WebsiteContext;
  bodyHtml: string;
  topicTitle: string;
  primaryKeyword: string;
};

export type SEOResult = Pick<GeneratedArticlePayload, "metaTitle" | "metaDescription" | "slug">;

export type ImproveArticleInput = {
  website: WebsiteContext;
  bodyHtml: string;
  instruction: string;
};

/**
 * Pluggable AI backend — business logic should depend on {@link AIService} / facades,
 * not on concrete providers.
 */
export interface AIProvider {
  generateTopics(input: GenerateTopicsInput): Promise<GeneratedTopic[]>;
  regenerateTopic(input: RegenerateTopicInput): Promise<GeneratedTopic>;
  generateArticle(input: GenerateArticleInput): Promise<GeneratedArticlePayload>;
  generateSEO(input: GenerateSEOInput): Promise<SEOResult>;
  improveArticle(input: ImproveArticleInput): Promise<{ bodyHtml: string }>;
}

export type AIProviderId = "openai" | "google" | "claude" | "deepseek";

export type ProviderRuntimeConfig = {
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
};
