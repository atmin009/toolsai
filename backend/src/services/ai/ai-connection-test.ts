import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from "./providers/provider-factory";

export async function pingProvider(
  provider: "openai" | "google" | "claude",
  model?: string | null,
  resolvedApiKey?: string | null
): Promise<{ ok: true }> {
  if (provider === "openai") {
    const key = resolvedApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("OpenAI API key not configured");
    const o = new OpenAI({ apiKey: key });
    const m = model?.trim() || DEFAULT_OPENAI_MODEL;
    await o.chat.completions.create({
      model: m,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 8,
    });
    return { ok: true };
  }

  if (provider === "google") {
    const key = resolvedApiKey?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
    if (!key) throw new Error("Google AI API key not configured");
    const genAI = new GoogleGenerativeAI(key);
    const m = model?.trim() || DEFAULT_GEMINI_MODEL;
    const modelRef = genAI.getGenerativeModel({ model: m });
    await modelRef.generateContent("Reply with exactly: ok");
    return { ok: true };
  }

  const key = resolvedApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Anthropic API key not configured");
  const anthropic = new Anthropic({ apiKey: key });
  const m = model?.trim() || "claude-3-5-sonnet-20240620";
  await anthropic.messages.create({
    model: m,
    system: "Return the word ok.",
    messages: [{ role: "user", content: "Say exactly: ok" }],
    max_tokens: 8,
    temperature: 0,
  } as any);
  return { ok: true };
}
