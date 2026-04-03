import type { User, Website } from "@prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import type { AIService } from "./ai.types";
import { ProviderAIServiceAdapter } from "./ai-provider-adapter";
import { FailoverAIService } from "./ai-resilience";
import { resolveClaudeApiKey, resolveGoogleApiKey, resolveOpenAiApiKey } from "./ai-key-resolve";
import { createMockAIService } from "./mock-ai.service";
import { DEFAULT_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL, getAIProvider } from "./providers/provider-factory";
import type { AIProviderId, ProviderRuntimeConfig } from "./ai-provider.types";

function runtimeConfig(
  w: Pick<Website, "aiModel" | "aiTemperature" | "aiMaxTokens">,
  provider: AIProviderId
): ProviderRuntimeConfig {
  const model =
    w.aiModel?.trim() ||
    (provider === "openai" ? DEFAULT_OPENAI_MODEL : provider === "claude" ? DEFAULT_CLAUDE_MODEL : DEFAULT_GEMINI_MODEL);
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
>;

type UserKeys = Pick<User, "openaiApiKey" | "googleApiKey" | "claudeApiKey"> | null;

/**
 * When the site is still "mock" but keys exist (Settings or Website), use a real provider
 * so a saved OpenAI key in the DB is actually used.
 */
function inferProviderFromKeys(w: WebsiteAi, userKeys: UserKeys): "mock" | AIProviderId {
  if (resolveOpenAiApiKey(w, userKeys)) return "openai";
  if (resolveGoogleApiKey(w, userKeys)) return "google";
  if (resolveClaudeApiKey(w, userKeys)) return "claude";
  return "mock";
}

function buildLlmService(
  w: WebsiteAi,
  id: AIProviderId,
  userKeys: Pick<User, "openaiApiKey" | "googleApiKey" | "claudeApiKey"> | null
): AIService {
  const resolved =
    id === "openai"
      ? resolveOpenAiApiKey(w, userKeys)
      : id === "google"
        ? resolveGoogleApiKey(w, userKeys)
        : resolveClaudeApiKey(w, userKeys);
  try {
    return new ProviderAIServiceAdapter(getAIProvider(id, runtimeConfig(w, id), resolved));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      503,
      `Could not initialize ${id} provider. Add an API key in Settings or Website, or set OPENAI_API_KEY / GOOGLE_AI_API_KEY / ANTHROPIC_API_KEY on the server. (${msg})`
    );
  }
}

/**
 * Resolves the correct `AIService` for a website: mock planner, or OpenAI / Gemini via the provider factory.
 * `userId` loads global API keys from the user (merged: website → user → env).
 */
export async function getAIServiceForWebsite(w: WebsiteAi, userId?: string | null): Promise<AIService> {
  let userKeys: UserKeys = null;
  if (userId) {
    userKeys = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiApiKey: true, googleApiKey: true, claudeApiKey: true },
    });
  }

  let raw = (w.aiProvider ?? "mock").toLowerCase() as string;
  if (raw === "mock") {
    const inferred = inferProviderFromKeys(w, userKeys);
    if (inferred === "mock") return createMockAIService();
    raw = inferred;
  }

  if (raw !== "openai" && raw !== "google" && raw !== "claude") {
    return createMockAIService();
  }

  const primary = buildLlmService(w, raw, userKeys);

  const fbRaw = w.aiFallbackProvider?.trim().toLowerCase();
  if (fbRaw !== "openai" && fbRaw !== "google" && fbRaw !== "claude") return primary;
  if (fbRaw === raw) return primary;

  let fallback: AIService;
  try {
    fallback = buildLlmService(w, fbRaw, userKeys);
  } catch {
    return primary;
  }

  return new FailoverAIService(primary, fallback);
}
