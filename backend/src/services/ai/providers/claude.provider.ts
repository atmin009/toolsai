import Anthropic from "@anthropic-ai/sdk";
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

export class ClaudeAIProvider implements AIProvider {
  private readonly anthropic: Anthropic;

  constructor(
    apiKey: string,
    private readonly config: ProviderRuntimeConfig
  ) {
    this.anthropic = new Anthropic({ apiKey });
  }

  private effTemperature(): number {
    if (this.config.temperature != null && !Number.isNaN(this.config.temperature)) return this.config.temperature;
    return 0.7;
  }

  private effMax(opDefault: number): number {
    if (this.config.maxTokens != null && this.config.maxTokens > 0) return this.config.maxTokens;
    return opDefault;
  }

  private async generateJson(system: string, user: string, maxTokens: number): Promise<unknown> {
    return withRetry(async () => {
      const res = await this.anthropic.messages.create({
        model: this.config.model,
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: this.effMax(maxTokens),
        temperature: this.effTemperature(),
      } as any);

      // `content` is an array of blocks; we only need the text blocks.
      const text = Array.isArray((res as any).content)
        ? (res as any).content.map((c: any) => (c?.type === "text" ? c.text : "")).join("")
        : (res as any).content?.toString?.() ?? "";
      if (!text.trim()) throw new Error("Claude returned empty content");
      return parseJsonFromLlmText(text) as unknown;
    });
  }

  async generateTopics(input: GenerateTopicsInput): Promise<GeneratedTopic[]> {
    const { system, user } = buildBatchTopicsPrompts(input);
    const raw = await this.generateJson(system, user, 14_000);
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
    const raw = await this.generateJson(system, user, 16_000);
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

