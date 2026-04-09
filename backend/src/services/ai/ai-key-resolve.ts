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

/**
 * **Account-wide keys only** (Settings → “คีย์ API (ทั่วทั้งบัญชี)”), then server `process.env`.
 * Per-website keys on the Website record are **not** used — same scope as the Settings page.
 */
export function resolveOpenAiApiKeyAccountWide(user: UserKeys): string | undefined {
  const a = user?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  return a || undefined;
}

/** Same as `resolveOpenAiApiKeyAccountWide` for Gemini helper text on covers. */
export function resolveGoogleApiKeyAccountWide(user: UserKeys): string | undefined {
  const a = user?.googleApiKey?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  return a || undefined;
}

export function resolveClaudeApiKey(w: WebsiteKeys, user: UserKeys): string | undefined {
  const a = w.claudeApiKey?.trim() || user?.claudeApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  return a || undefined;
}
