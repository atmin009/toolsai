/** Internal prompt templates for future LLM integration; mock service mirrors this structure. */

export const topicSystemPrompt = `You are an SEO content strategist. Propose blog topics that match the brand voice, niche, keyword themes, and content categories. Each topic must include a compelling title, primary keyword, secondary keywords, search intent, article type, and a short angle. Avoid keyword stuffing; prioritize reader value and clear intent.`;

export function buildTopicUserPrompt(input: {
  brandName: string;
  niche: string;
  tone: string;
  audience: string;
  seoRules?: string | null;
  categories: string[];
  primaryThemes: string[];
  secondaryThemes: string[];
  articleGoals: string[];
  year: number;
  month: number;
  postsPerDay: number;
  slotIndex: number;
  publishDateIso: string;
}): string {
  return `Plan content for ${input.brandName} (${input.niche}).
Tone: ${input.tone}
Audience: ${input.audience}
SEO / brand notes: ${input.seoRules ?? "—"}
Categories: ${input.categories.join(", ") || "General"}
Primary keyword themes: ${input.primaryThemes.join(", ")}
Secondary keyword themes: ${input.secondaryThemes.join(", ")}
Article goals: ${input.articleGoals.join(", ")}
Calendar: ${input.year}-${String(input.month).padStart(2, "0")}, slot ${input.slotIndex}, publish date ${input.publishDateIso}
Posts per day target: ${input.postsPerDay}
Return one topic idea aligned with the publish date and slot.`;
}

export const articleSystemPrompt = `You are an expert SEO copywriter. Write structured, readable long-form content with natural keyword use, clear H2/H3 hierarchy, conversion-aware CTA, and an FAQ. Include meta fields, slug, schema hint, internal link anchors, and image prompt suggestions.`;

export function buildArticleUserPrompt(input: {
  proposedTitle: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  articleType: string;
  brief: string;
  brandName: string;
  tone: string;
  audience: string;
  niche: string;
  seoRules?: string | null;
}): string {
  return `Write a full article plan and draft for:
Title: ${input.proposedTitle}
Primary keyword: ${input.primaryKeyword}
Secondary: ${input.secondaryKeywords.join(", ")}
Intent: ${input.searchIntent}
Type: ${input.articleType}
Brief: ${input.brief}
Brand: ${input.brandName} | Niche: ${input.niche}
Tone: ${input.tone} | Audience: ${input.audience}
Brand/SEO notes: ${input.seoRules ?? "—"}
Output must be suitable for HTML body (paragraphs, headings) plus SEO metadata and FAQ as structured sections.`;
}
