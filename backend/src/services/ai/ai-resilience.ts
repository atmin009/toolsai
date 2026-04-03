import type { AIService } from "./ai.types";

/**
 * On any failure from the primary service, runs the same call on `fallback` once.
 * Retries are handled inside each LLM provider; this layer only switches providers.
 */
export class FailoverAIService implements AIService {
  constructor(
    private readonly primary: AIService,
    private readonly fallback: AIService
  ) {}

  async generateTopics(input: Parameters<AIService["generateTopics"]>[0]) {
    try {
      return await this.primary.generateTopics(input);
    } catch {
      return await this.fallback.generateTopics(input);
    }
  }

  async regenerateTopic(input: Parameters<AIService["regenerateTopic"]>[0]) {
    try {
      return await this.primary.regenerateTopic(input);
    } catch {
      return await this.fallback.regenerateTopic(input);
    }
  }

  async generateArticle(input: Parameters<AIService["generateArticle"]>[0]) {
    try {
      return await this.primary.generateArticle(input);
    } catch {
      return await this.fallback.generateArticle(input);
    }
  }

  async generateSEOFields(input: Parameters<AIService["generateSEOFields"]>[0]) {
    try {
      return await this.primary.generateSEOFields(input);
    } catch {
      return await this.fallback.generateSEOFields(input);
    }
  }

  async improveArticle(input: Parameters<AIService["improveArticle"]>[0]) {
    try {
      return await this.primary.improveArticle(input);
    } catch {
      return await this.fallback.improveArticle(input);
    }
  }
}
