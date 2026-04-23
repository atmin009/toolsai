import type { User, Website } from "@prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import type { AIService } from "./ai.types";
import { ProviderAIServiceAdapter } from "./ai-provider-adapter";
import { FailoverAIService } from "./ai-resilience";
import { resolveClaudeApiKey, resolveDeepseekApiKey, resolveGoogleApiKey, resolveOpenAiApiKey } from "./ai-key-resolve";
import { createMockAIService } from "./mock-ai.service";
import { DEFAULT_CLAUDE_MODEL, DEFAULT_DEEPSEEK_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL, getAIProvider } from "./providers/provider-factory";
import type { AIProviderId, ProviderRuntimeConfig } from "./ai-provider.types";

function runtimeConfig(
  w: Pick<Website, "aiModel" | "aiTemperature" | "aiMaxTokens">,
  provider: AIProviderId
): ProviderRuntimeConfig {
  const defaultModel: Record<AIProviderId, string> = {
    openai: DEFAULT_OPENAI_MODEL,
    google: DEFAULT_GEMINI_MODEL,
    claude: DEFAULT_CLAUDE_MODEL,
    deepseek: DEFAULT_DEEPSEEK_MODEL,
  };
  const model = w.aiModel?.trim() || defaultModel[provider];
  return { model, temperature: w.aiTemperature, maxTokens: w.aiMaxTokens };
}

type WebsiteAi = Pick<
  Website,
  | "aiProvider"
  | "aiModel"
  | "aiTemperature"
  | "aiMaxTokens"
  | "aiFallbackProvider"
  | "openaiApiKey"
  | "googleApiKey"
  | "claudeApiKey"
  | "deepseekApiKey"
>;

type UserKeys = Pick<User, "openaiApiKey" | "googleApiKey" | "claudeApiKey" | "deepseekApiKey"> | null;

/**
 * When the site is still "mock" but keys exist (Settings or Website), use a real provider
 * so a saved OpenAI key in the DB is actually used.
 */
function inferProviderFromKeys(w: WebsiteAi, userKeys: UserKeys): "mock" | AIProviderId {
  if (resolveOpenAiApiKey(w, userKeys)) return "openai";
  if (resolveGoogleApiKey(w, userKeys)) return "google";
  if (resolveClaudeApiKey(w, userKeys)) return "claude";
  if (resolveDeepseekApiKey(w, userKeys)) return "deepseek";
  return "mock";
}

function buildLlmService(w: WebsiteAi, id: AIProviderId, userKeys: UserKeys): AIService {
  const resolvers: Record<AIProviderId, () => string | undefined> = {
    openai: () => resolveOpenAiApiKey(w, userKeys),
    google: () => resolveGoogleApiKey(w, userKeys),
    claude: () => resolveClaudeApiKey(w, userKeys),
    deepseek: () => resolveDeepseekApiKey(w, userKeys),
  };
  const resolved = resolvers[id]();
  try {
    return new ProviderAIServiceAdapter(getAIProvider(id, runtimeConfig(w, id), resolved));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      503,
      `Could not initialize ${id} provider. Add an API key in Settings or Website, or set the corresponding env var on the server. (${msg})`
    );
  }
}

/**
 * Resolves the correct `AIService` for a website: mock planner, or OpenAI / Gemini via the provider factory.
 * `userId` loads global API keys from the user (merged: website → user → env).
 */
export async function getAIServiceForWebsite(w: WebsiteAi, userId?: string | null): Promise<AIService> {
  const validProviders: AIProviderId[] = ["openai", "google", "claude", "deepseek"];

  let userKeys: UserKeys = null;
  if (userId) {
    userKeys = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiApiKey: true, googleApiKey: true, claudeApiKey: true, deepseekApiKey: true },
    });
  }

  let raw = (w.aiProvider ?? "mock").toLowerCase() as string;
  if (raw === "mock") {
    const inferred = inferProviderFromKeys(w, userKeys);
    if (inferred === "mock") return createMockAIService();
    raw = inferred;
  }

  if (!validProviders.includes(raw as AIProviderId)) {
    return createMockAIService();
  }

  const primary = buildLlmService(w, raw as AIProviderId, userKeys);

  const fbRaw = w.aiFallbackProvider?.trim().toLowerCase();
  if (!validProviders.includes(fbRaw as AIProviderId)) return primary;
  if (fbRaw === raw) return primary;

  let fallback: AIService;
  try {
    fallback = buildLlmService(w, fbRaw as AIProviderId, userKeys);
  } catch {
    return primary;
  }

  return new FailoverAIService(primary, fallback);
}
