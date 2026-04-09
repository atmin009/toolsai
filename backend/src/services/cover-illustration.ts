import OpenAI from "openai";
import sharp from "sharp";
import type { User, Website } from "@prisma/client";
import { env } from "../config/env";
import { resolveGoogleApiKeyAccountWide, resolveOpenAiApiKeyAccountWide } from "./ai/ai-key-resolve";
import { coverLog, coverWarn } from "./cover-log";
import { DEFAULT_OPENAI_MODEL } from "./ai/providers/provider-factory";

const COVER_W = 1200;
const COVER_H = 630;

/** Gemini model for image generation (Nano Banana 2). */
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

type KeysUser = Pick<User, "openaiApiKey" | "googleApiKey" | "claudeApiKey"> | null;

/* ------------------------------------------------------------------ */
/*  Prompt building                                                   */
/* ------------------------------------------------------------------ */

const SCENE_STYLE = [
  "Premium tech editorial header art, 1200×630 landscape.",
  "Cinematic studio product photography when the topic is gadgets, phones, tablets, or computers;",
  "otherwise a clean modern editorial scene that still fits the same mood.",
  "Background: smooth dark moody gradient — deep violet, burgundy, teal, or near-black — with a soft radial spotlight or gentle vignette.",
  "Lighting: dramatic but clean rim light, metallic or glass highlights, shallow depth of field, 8k sharp focus.",
  "Composition: main subject centered in the upper-middle 60%; keep the lower 30% darker and calm for headline overlay.",
  "CRITICAL: No text, no letters, no logos, no watermarks, no captions, no UI with readable words.",
].join(" ");

const LLM_PROMPT_SYSTEM = `You write brief English prompts for AI image generation. Reply with JSON only: {"q":"..."}.

Style target (FOCUS-like tech editorial covers):
- Cinematic studio or high-end product photography; sleek 3D renders of devices when the article is about tech hardware.
- Dark moody backgrounds: deep purple/violet, burgundy, teal, or near-black gradients; subtle radial glow behind the subject; soft vignette.
- Lighting: rim light, soft reflections on metal/glass, professional showcase lighting — not flat stock-photo lighting.
- Leave lower area visually quieter so headline text can sit there later (no busy clutter in the bottom band).

Hard rules for "q":
- One English sentence, max ~45 words, describing only the visual scene.
- No text, letters, logos, watermarks, or readable UI in the image.
- No people unless the article topic clearly requires human subjects.`;

function parseJsonWithQ(text: string): { q?: string } {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return {};
    return JSON.parse(m[0]) as { q?: string };
  } catch {
    return {};
  }
}

function asciiImagePromptHint(imagePrompt: string | null): string | null {
  if (!imagePrompt?.trim()) return null;
  const t = imagePrompt.trim();
  const asciiRatio = (t.match(/[\x00-\x7F]/g) ?? []).length / Math.max(t.length, 1);
  if (asciiRatio < 0.65 || t.length < 8) return null;
  return t.slice(0, 500).replace(/\s+/g, " ");
}

/**
 * Build a short English scene description via LLM (OpenAI → Gemini text → heuristic fallback).
 */
export async function buildScenePrompt(input: {
  proposedTitle: string;
  focusKeyword: string | null;
  imagePrompt: string | null;
  niche: string;
  website: Website;
  user: KeysUser;
}): Promise<string> {
  const fromField = asciiImagePromptHint(input.imagePrompt);
  if (fromField) {
    coverLog("buildScenePrompt: using article imagePrompt field");
    return fromField;
  }

  const userMsg = `Website niche: ${input.niche}
Article title: ${input.proposedTitle}
Primary keyword: ${input.focusKeyword ?? ""}
Return {"q":"..."}: one sentence matching the FOCUS-style tech editorial look above and the article topic.`;

  const openaiKey = resolveOpenAiApiKeyAccountWide(input.user);
  if (openaiKey) {
    try {
      coverLog("buildScenePrompt: using OpenAI chat for JSON prompt");
      const o = new OpenAI({ apiKey: openaiKey });
      const r = await o.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        messages: [
          { role: "system", content: LLM_PROMPT_SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.5,
      });
      const j = parseJsonWithQ(r.choices[0]?.message?.content ?? "");
      if (j.q?.trim()) return j.q.trim();
    } catch (e) {
      coverWarn("buildScenePrompt: OpenAI chat failed, will try Gemini text or heuristic", e);
    }
  }

  const googleKey = resolveGoogleApiKeyAccountWide(input.user);
  if (googleKey) {
    try {
      coverLog("buildScenePrompt: using Gemini text for JSON prompt");
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const gen = new GoogleGenerativeAI(googleKey);
      const model = gen.getGenerativeModel({ model: "gemini-2.0-flash" });
      const r = await model.generateContent(`${LLM_PROMPT_SYSTEM}\n\n${userMsg}`);
      const text = r.response.text();
      const j = parseJsonWithQ(text);
      if (j.q?.trim()) return j.q.trim();
    } catch (e) {
      coverWarn("buildScenePrompt: Gemini text failed, using heuristic", e);
    }
  }

  coverLog("buildScenePrompt: using heuristic fallback");
  const kw = input.focusKeyword?.trim() || input.niche.trim() || "blog topic";
  const base = kw.length > 80 ? kw.slice(0, 80) : kw;
  return `Cinematic tech product or editorial subject about ${base}, dark moody gradient backdrop, soft spotlight on subject, sleek metallic highlights, shallow depth of field, lower third calm, no text.`;
}

/* ------------------------------------------------------------------ */
/*  Gemini Image Generation (Nano Banana 2) via REST                  */
/* ------------------------------------------------------------------ */

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

async function geminiImageGenerate(prompt: string, apiKey: string): Promise<string> {
  const fullPrompt = `${SCENE_STYLE}\n\nScene: ${prompt}`;
  coverLog("Gemini image generate starting", { model: GEMINI_IMAGE_MODEL });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini image API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData) throw new Error("Gemini: no image in response");

  const raw = Buffer.from(imagePart.inlineData.data, "base64");
  const png = await sharp(raw)
    .resize(COVER_W, COVER_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  coverLog("Gemini image OK", { pngBytes: png.length });
  return `data:image/png;base64,${png.toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/*  Legacy DALL·E 3 (kept for COVER_IMAGE_SOURCE=openai)              */
/* ------------------------------------------------------------------ */

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`Image download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openaiImageToDataUrl(prompt: string, apiKey: string): Promise<string> {
  coverLog("DALL·E images.generate starting", { model: "dall-e-3", size: "1792x1024" });
  const o = new OpenAI({ apiKey });
  const img = await o.images.generate({
    model: "dall-e-3",
    prompt: `${SCENE_STYLE} Scene: ${prompt}`,
    size: "1792x1024",
    quality: "standard",
    n: 1,
  });
  const url = img.data?.[0]?.url;
  if (!url) throw new Error("DALL·E: no URL");
  const raw = await fetchBuffer(url);
  const png = await sharp(raw)
    .resize(COVER_W, COVER_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  coverLog("DALL·E image OK", { pngBytes: png.length });
  return `data:image/png;base64,${png.toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/*  Public entry point                                                */
/* ------------------------------------------------------------------ */

export type CoverIllustrationResult = {
  dataUrl: string | null;
  seed: string;
  status: "ok" | "mode_off" | "no_key" | "error";
  errorMessage?: string;
};

export async function loadCoverIllustration(params: {
  querySeed: string;
  website: Website;
  user: KeysUser;
}): Promise<CoverIllustrationResult> {
  const mode = env.COVER_IMAGE_SOURCE;
  const seed = `${params.querySeed}|${params.website.id}`;

  coverLog("loadCoverIllustration", { mode });

  if (mode === "none") {
    return { dataUrl: null, seed, status: "mode_off" };
  }

  if (mode === "gemini") {
    const googleKey = resolveGoogleApiKeyAccountWide(params.user);
    if (!googleKey) {
      coverWarn("loadCoverIllustration: no Google API key — set คีย์ Google API (ทั่วทั้งบัญชี) in Settings or GOOGLE_AI_API_KEY in .env");
      return { dataUrl: null, seed, status: "no_key" };
    }
    try {
      const dataUrl = await geminiImageGenerate(params.querySeed, googleKey);
      return { dataUrl, seed, status: "ok" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      coverWarn("Gemini image failed", msg);
      return { dataUrl: null, seed, status: "error", errorMessage: msg };
    }
  }

  // Legacy: openai / DALL·E
  const openaiKey = resolveOpenAiApiKeyAccountWide(params.user);
  if (!openaiKey) {
    coverWarn("loadCoverIllustration: no OpenAI key");
    return { dataUrl: null, seed, status: "no_key" };
  }
  try {
    const dataUrl = await openaiImageToDataUrl(params.querySeed, openaiKey);
    return { dataUrl, seed, status: "ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    coverWarn("DALL·E image failed", msg);
    return { dataUrl: null, seed, status: "error", errorMessage: msg };
  }
}
