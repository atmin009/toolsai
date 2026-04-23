import OpenAI from "openai";
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

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const topicsWrapperSchema = z.object({ topics: z.array(z.unknown()) });
const singleTopicWrapperSchema = z.object({ topic: z.unknown() });
const seoSchema = z.object({ metaTitle: z.string(), metaDescription: z.string(), slug: z.string() });
const improveSchema = z.object({ bodyHtml: z.string() });
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

/**
 * DeepSeek provider — OpenAI-compatible API with custom base URL.
 */
export class DeepSeekProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor(
    private readonly apiKey: string,
    private readonly config: ProviderRuntimeConfig
  ) {
    this.client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
  }

  private effTemperature(): number {
    if (this.config.temperature != null && !Number.isNaN(this.config.temperature)) return this.config.temperature;
    return 0.7;
  }

  private effMax(opDefault: number): number {
    if (this.config.maxTokens != null && this.config.maxTokens > 0) return this.config.maxTokens;
    return opDefault;
  }

  private async completeJson(system: string, user: string, maxTokens: number): Promise<unknown> {
    return withRetry(async () => {
      const res = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: this.effTemperature(),
        max_tokens: this.effMax(maxTokens),
      });
      const text = res.choices[0]?.message?.content;
      if (!text) throw new Error("DeepSeek returned empty content");
      return parseJsonFromLlmText(text) as unknown;
    });
  }

  async generateTopics(input: GenerateTopicsInput): Promise<GeneratedTopic[]> {
    const { system, user } = buildBatchTopicsPrompts(input);
    const raw = await this.completeJson(system, user, 14000);
    const parsed = topicsWrapperSchema.safeParse(raw);
    const llmTopics = parsed.success ? coerceLlmTopicList(parsed.data.topics) : undefined;
    return mergeTopicsWithPlanner(llmTopics, input);
  }

  async regenerateTopic(input: RegenerateTopicInput): Promise<GeneratedTopic> {
    const { system, user } = buildRegenerateTopicPrompts(input);
    const raw = await this.completeJson(system, user, 4096);
    const parsed = singleTopicWrapperSchema.parse(raw);
    return parseTopic(parsed.topic);
  }

  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticlePayload> {
    const { system, user } = buildArticleJsonPrompts(input);
    const raw = await this.completeJson(system, user, 16384);
    return parseGeneratedArticlePayload(raw);
  }

  async generateSEO(input: GenerateSEOInput): Promise<Pick<GeneratedArticlePayload, "metaTitle" | "metaDescription" | "slug">> {
    const { system, user } = buildSEOPrompts(input);
    const raw = await this.completeJson(system, user, 1024);
    return seoSchema.parse(raw);
  }

  async improveArticle(input: ImproveArticleInput): Promise<{ bodyHtml: string }> {
    const { system, user } = buildImprovePrompts(input);
    const raw = await this.completeJson(system, user, 8192);
    return improveSchema.parse(raw);
  }
}
