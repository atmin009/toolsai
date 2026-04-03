import type { WebsiteContext } from "./ai.types";
import type { GenerateArticleInput, GenerateSEOInput, GenerateTopicsInput, RegenerateTopicInput } from "./ai-provider.types";
import { topicSystemPrompt } from "./prompts";

function websiteContextBlock(w: WebsiteContext): string {
  return [
    `Brand: ${w.brandName}`,
    `Niche: ${w.niche}`,
    `Tone: ${w.toneOfVoice}`,
    `Audience: ${w.targetAudience}`,
    `Default language: ${w.defaultLanguage}`,
    `SEO / brand rules: ${w.seoRules ?? "—"}`,
    `Categories: ${w.categories.join(", ") || "General"}`,
    `Primary themes: ${w.primaryThemes.join(", ")}`,
    `Secondary themes: ${w.secondaryThemes.join(", ")}`,
    `Article goals: ${w.articleGoals.join(", ")}`,
    `Keyword blacklist (never use these phrases in titles, keywords, or briefs): ${(w.keywordBlacklist ?? []).join("; ") || "—"}`,
    `Forbidden claims (do not imply these): ${w.forbiddenClaims ?? "—"}`,
    `Compliance notes: ${w.complianceNotes ?? "—"}`,
  ].join("\n");
}

export function buildBatchTopicsPrompts(input: GenerateTopicsInput): { system: string; user: string } {
  const { website, year, month, postsPerDay, fromDay, toDay } = input;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dStart = fromDay ?? 1;
  const dEnd = toDay ?? daysInMonth;
  if (dStart < 1 || dEnd > daysInMonth || dStart > dEnd) {
    throw new Error(`Invalid planner day range ${dStart}–${dEnd} for month ${year}-${month}`);
  }

  const total = (dEnd - dStart + 1) * postsPerDay;
  const slots: { slotIndex: number; publishDateIso: string }[] = [];
  for (let d = dStart; d <= dEnd; d++) {
    for (let p = 0; p < postsPerDay; p++) {
      slots.push({
        slotIndex: slots.length,
        publishDateIso: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }
  }

  const rangeNote =
    fromDay != null && toDay != null
      ? `This batch covers days ${dStart}–${dEnd} only (${total} topics).`
      : `Full month: ${daysInMonth} days.`;

  const system = `${topicSystemPrompt}

You MUST respond with valid JSON only, no markdown fences, in this exact shape:
{"topics":[{"proposedTitle":"string","primaryKeyword":"string","secondaryKeywords":["string"],"searchIntent":"string","articleType":"string","brief":"string"}, ...]}

The "topics" array MUST contain exactly ${total} items, in the same order as the schedule below (local slot 0 .. ${total - 1}). ${rangeNote}`;

  const user = `${websiteContextBlock(website)}

Calendar: ${year}-${String(month).padStart(2, "0")}, ${postsPerDay} post(s) per day; ${rangeNote}
Schedule (one topic per line, same order as output array):
${slots.map((s) => `slot ${s.slotIndex}: publish ${s.publishDateIso}`).join("\n")}`;

  return { system, user };
}

export function buildRegenerateTopicPrompts(input: RegenerateTopicInput): { system: string; user: string } {
  const system = `${topicSystemPrompt}

Respond with JSON only: {"topic":{"proposedTitle":"...","primaryKeyword":"...","secondaryKeywords":[],"searchIntent":"...","articleType":"...","brief":"..."}}`;

  const user = `${websiteContextBlock(input.website)}

Publish date: ${input.publishDateIso}

Existing topic to refresh:
${JSON.stringify(input.existing, null, 2)}

Produce a new angle; keep primary keyword family similar unless blacklist forces a change.`;

  return { system, user };
}

export function buildArticleJsonPrompts(input: GenerateArticleInput): { system: string; user: string } {
  const { website, topic, options } = input;
  const articleLength = options?.articleLength ?? website.defaultArticleLength ?? "standard";
  const language = options?.language ?? website.defaultLanguage ?? "en";

  const system = `You are an expert SEO copywriter. Output valid JSON only (no markdown), matching this contract:
- seoTitle, metaTitle, metaDescription, slug, focusKeyword, secondaryKeywords[], excerpt, h1
- outline: array of { "level": 1|2|3, "text": string }
- bodyHtml: full HTML article (use semantic tags, h1–h3, paragraphs, lists). Lang attribute is not in JSON but write content in language "${language}".
- faq: [{question, answer}]
- internalLinkIdeas: [{anchor, note}]
- suggestedCta, schemaTypes (string[]), schemaSuggestion (JSON-LD string or notes), imagePrompt
- tagsSuggestion, categoriesSuggestion (string arrays)
- wpReadyPayload: object with useful CMS fields

Article length target: ${articleLength} (short = fewer sections; long = more depth and subsections).`;

  const user = `${websiteContextBlock(website)}

Topic:
${JSON.stringify(topic, null, 2)}

Write the complete JSON object at the root (not wrapped in "article").`;

  return { system, user };
}

export function buildSEOPrompts(input: GenerateSEOInput): { system: string; user: string } {
  const system = `Return JSON only: {"metaTitle":"string","metaDescription":"string","slug":"string"} — optimized for SERP, metaDescription under 160 chars where possible.`;

  const user = `${websiteContextBlock(input.website)}

Topic title: ${input.topicTitle}
Primary keyword: ${input.primaryKeyword}

Article body HTML (extract themes from this):
${input.bodyHtml.slice(0, 12_000)}`;

  return { system, user };
}

export function buildImprovePrompts(input: { website: WebsiteContext; bodyHtml: string; instruction: string }): {
  system: string;
  user: string;
} {
  const system = `You improve HTML article bodies. Return JSON only: {"bodyHtml":"..."} — preserve structure where possible, apply the instruction, keep brand voice.`;

  const user = `${websiteContextBlock(input.website)}

Instruction:
${input.instruction}

Current HTML:
${input.bodyHtml.slice(0, 100_000)}`;

  return { system, user };
}
