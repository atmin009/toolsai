export interface GeneratedTopic {
  proposedTitle: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  articleType: string;
  brief: string;
}

export interface GeneratedArticlePayload {
  seoTitle: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  excerpt: string;
  h1: string;
  /** Full heading outline including H1–H3 (H1 usually matches `h1`). */
  outline: { level: 1 | 2 | 3; text: string }[];
  bodyHtml: string;
  faq: { question: string; answer: string }[];
  internalLinkIdeas: { anchor: string; note: string }[];
  suggestedCta: string;
  /** Recommended schema.org primary types (stored with JSON-LD in `schemaSuggestion`). */
  schemaTypes: string[];
  /** Example JSON-LD or implementation notes */
  schemaSuggestion: string;
  imagePrompt: string;
  tagsSuggestion: string[];
  categoriesSuggestion: string[];
  wpReadyPayload: Record<string, unknown>;
}

/** Keyword group from CMS — used by monthly planner for rotation and pools. */
export type PlannerKeywordGroup = {
  type: "primary" | "secondary";
  label: string;
  keywords: string[];
};

/** Content category from CMS — planner rotates titles/briefs through these. */
export type PlannerContentCategory = {
  name: string;
  description?: string | null;
};

export interface WebsiteContext {
  brandName: string;
  niche: string;
  toneOfVoice: string;
  targetAudience: string;
  seoRules: string | null;
  categories: string[];
  primaryThemes: string[];
  secondaryThemes: string[];
  articleGoals: string[];
  defaultLanguage: string;
  keywordBlacklist: string[];
  forbiddenClaims: string | null;
  complianceNotes: string | null;
  defaultArticleLength: "short" | "standard" | "long";
  /** When loaded from DB, drives planner diversity and keyword pools. */
  keywordGroups?: PlannerKeywordGroup[];
  contentCategories?: PlannerContentCategory[];
}

/** Alias: same shape you pass from DB / `toAIWebsiteContext` for content planning. */
export type WebsiteProfile = WebsiteContext;

/** Month-level planner inputs (maps to calendar + slot count). */
export type PlannerConfig = {
  year: number;
  month: number;
  postsPerDay: number;
  /** Inclusive day-of-month slice (1–31). When both set, only that range is generated (chunked planner). */
  fromDay?: number;
  toDay?: number;
};

/** Approved or draft topic ready for full article generation (matches `GeneratedTopic`). */
export type ApprovedTopic = GeneratedTopic;

/** Minimal draft for SEO meta regeneration without full article regen. */
export type ArticleDraft = {
  website: WebsiteProfile;
  title: string;
  primaryKeyword: string;
  bodyHtml: string;
};

export interface AIService {
  /** Monthly grid: length = daysInMonth × postsPerDay; or a day-range slice when fromDay/toDay are set. */
  generateTopics(input: {
    website: WebsiteContext;
    year: number;
    month: number;
    postsPerDay: number;
    fromDay?: number;
    toDay?: number;
  }): Promise<GeneratedTopic[]>;

  regenerateTopic(input: {
    website: WebsiteContext;
    existing: GeneratedTopic;
    publishDateIso: string;
  }): Promise<GeneratedTopic>;

  generateArticle(input: {
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
  }): Promise<GeneratedArticlePayload>;

  generateSEOFields(input: {
    website: WebsiteContext;
    bodyHtml: string;
    topicTitle: string;
    primaryKeyword: string;
  }): Promise<Pick<GeneratedArticlePayload, "metaTitle" | "metaDescription" | "slug">>;

  improveArticle(input: {
    website: WebsiteContext;
    bodyHtml: string;
    instruction: string;
  }): Promise<{ bodyHtml: string }>;
}
