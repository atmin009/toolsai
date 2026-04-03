import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type {
  AIProvider,
  GenerateArticleInput,
  GenerateSEOInput,
  GenerateTopicsInput,
  ImproveArticleInput,
  ProviderRuntimeConfig,
  RegenerateTopicInput,
} from "../ai-provider.types";
import type { GeneratedArticlePayload, GeneratedTopic } from "../ai.types";
import { parseGeneratedArticlePayload } from "../article-llm-schema";
import { parseJsonFromLlmText, withRetry } from "../llm-json";
import { coerceLlmTopicList, mergeTopicsWithPlanner } from "../topic-merge";
import {
  buildArticleJsonPrompts,
  buildBatchTopicsPrompts,
  buildImprovePrompts,
  buildRegenerateTopicPrompts,
  buildSEOPrompts,
} from "../prompts-llm";

const topicsWrapperSchema = z.object({
  topics: z.array(z.unknown()),
});

const singleTopicWrapperSchema = z.object({
  topic: z.unknown(),
});

const seoSchema = z.object({
  metaTitle: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
});

const improveSchema = z.object({
  bodyHtml: z.string(),
});

const topicSchema = z.object({
  proposedTitle: z.string(),
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  searchIntent: z.string(),
  articleType: z.string(),
  brief: z.string(),
});

function parseTopic(t: unknown): GeneratedTopic {
  return topicSchema.parse(t);
}

export class GoogleAIProvider implements AIProvider {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly config: ProviderRuntimeConfig
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private effTemperature(): number {
    if (this.config.temperature != null && !Number.isNaN(this.config.temperature)) {
      return this.config.temperature;
    }
    return 0.7;
  }

  private effMax(opDefault: number): number {
    if (this.config.maxTokens != null && this.config.maxTokens > 0) return this.config.maxTokens;
    return opDefault;
  }

  private async generateJson(system: string, user: string, maxOut: number): Promise<unknown> {
    return withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.config.model,
        systemInstruction: system,
      });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: this.effTemperature(),
          maxOutputTokens: this.effMax(maxOut),
          responseMimeType: "application/json",
        },
      });
      const text = result.response.text();
      if (!text) throw new Error("Gemini returned empty content");
      return parseJsonFromLlmText(text) as unknown;
    });
  }

  async generateTopics(input: GenerateTopicsInput): Promise<GeneratedTopic[]> {
    const { system, user } = buildBatchTopicsPrompts(input);
    const raw = await this.generateJson(system, user, 8192);
    const parsed = topicsWrapperSchema.safeParse(raw);
    const llmTopics = parsed.success ? coerceLlmTopicList(parsed.data.topics) : undefined;
    return mergeTopicsWithPlanner(llmTopics, input);
  }

  async regenerateTopic(input: RegenerateTopicInput): Promise<GeneratedTopic> {
    const { system, user } = buildRegenerateTopicPrompts(input);
    const raw = await this.generateJson(system, user, 4096);
    const parsed = singleTopicWrapperSchema.parse(raw);
    return parseTopic(parsed.topic);
  }

  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticlePayload> {
    const { system, user } = buildArticleJsonPrompts(input);
    const raw = await this.generateJson(system, user, 8192);
    return parseGeneratedArticlePayload(raw);
  }

  async generateSEO(input: GenerateSEOInput): Promise<Pick<GeneratedArticlePayload, "metaTitle" | "metaDescription" | "slug">> {
    const { system, user } = buildSEOPrompts(input);
    const raw = await this.generateJson(system, user, 1024);
    return seoSchema.parse(raw);
  }

  async improveArticle(input: ImproveArticleInput): Promise<{ bodyHtml: string }> {
    const { system, user } = buildImprovePrompts(input);
    const raw = await this.generateJson(system, user, 8192);
    return improveSchema.parse(raw);
  }
}
