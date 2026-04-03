import type { AIService } from "./ai.types";
import { createMockAIService } from "./mock-ai.service";

export type {
  AIService,
  ApprovedTopic,
  ArticleDraft,
  GeneratedArticlePayload,
  GeneratedTopic,
  PlannerConfig,
  PlannerContentCategory,
  PlannerKeywordGroup,
  WebsiteContext,
  WebsiteProfile,
} from "./ai.types";
export type { AIProvider, AIProviderId, ProviderRuntimeConfig } from "./ai-provider.types";
export { createMockAIService } from "./mock-ai.service";
export {
  generateArticle,
  generateSEOFields,
  generateTopics,
  improveArticle,
  regenerateTopic,
} from "./ai.facade";
export { getAIServiceForWebsite } from "./ai-website-resolver";
export { getAIProvider, DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL } from "./providers/provider-factory";

let singleton: AIService | null = null;

/** Default mock AI (no external calls). Prefer {@link getAIServiceForWebsite} for real providers. */
export function getAIService(): AIService {
  if (!singleton) singleton = createMockAIService();
  return singleton;
}
