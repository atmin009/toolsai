import type { User, Website } from "@prisma/client";

type UserKeys = Pick<User, "openaiApiKey" | "googleApiKey" | "claudeApiKey"> | null;
type WebsiteKeys = Pick<Website, "openaiApiKey" | "googleApiKey" | "claudeApiKey">;

/** Website key → user key → process env */
export function resolveOpenAiApiKey(w: WebsiteKeys, user: UserKeys): string | undefined {
  const a = w.openaiApiKey?.trim() || user?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  return a || undefined;
}

export function resolveGoogleApiKey(w: WebsiteKeys, user: UserKeys): string | undefined {
  const a = w.googleApiKey?.trim() || user?.googleApiKey?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  return a || undefined;
}

export function resolveClaudeApiKey(w: WebsiteKeys, user: UserKeys): string | undefined {
  const a = w.claudeApiKey?.trim() || user?.claudeApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  return a || undefined;
}
