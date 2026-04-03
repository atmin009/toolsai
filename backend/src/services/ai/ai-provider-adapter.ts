import type { AIService } from "./ai.types";
import type { AIProvider } from "./ai-provider.types";

export class ProviderAIServiceAdapter implements AIService {
  constructor(private readonly provider: AIProvider) {}

  generateTopics(input: Parameters<AIService["generateTopics"]>[0]) {
    return this.provider.generateTopics(input);
  }

  regenerateTopic(input: Parameters<AIService["regenerateTopic"]>[0]) {
    return this.provider.regenerateTopic(input);
  }

  generateArticle(input: Parameters<AIService["generateArticle"]>[0]) {
    return this.provider.generateArticle(input);
  }

  generateSEOFields(input: Parameters<AIService["generateSEOFields"]>[0]) {
    return this.provider.generateSEO({
      website: input.website,
      bodyHtml: input.bodyHtml,
      topicTitle: input.topicTitle,
      primaryKeyword: input.primaryKeyword,
    });
  }

  improveArticle(input: Parameters<AIService["improveArticle"]>[0]) {
    return this.provider.improveArticle(input);
  }
}
