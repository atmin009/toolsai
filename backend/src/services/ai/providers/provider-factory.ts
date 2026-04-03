import type { AIProvider, AIProviderId, ProviderRuntimeConfig } from "../ai-provider.types";
import { GoogleAIProvider } from "./google.provider";
import { OpenAIProvider } from "./openai.provider";
import { ClaudeAIProvider } from "./claude.provider";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
export const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20240620";

/**
 * Construct a concrete LLM provider. Pass `resolvedApiKey` from website / user / env merge; otherwise env only.
 * @throws if no API key is available for the provider
 */
export function getAIProvider(
  provider: AIProviderId,
  config: ProviderRuntimeConfig,
  resolvedApiKey?: string | null
): AIProvider {
  switch (provider) {
    case "openai": {
      const key = resolvedApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
      if (!key) throw new Error("OpenAI API key not configured");
      return new OpenAIProvider(key, config);
    }
    case "google": {
      const key = resolvedApiKey?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
      if (!key) throw new Error("Google AI API key not configured");
      return new GoogleAIProvider(key, config);
    }
    case "claude": {
      const key = resolvedApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) throw new Error("Anthropic API key not configured");
      return new ClaudeAIProvider(key, config);
    }
    default:
      throw new Error("Invalid provider");
  }
}
