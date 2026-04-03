import type { AIService, GeneratedArticlePayload, GeneratedTopic, WebsiteContext } from "./ai.types";
import { generatePlannedTopicsForMonth, sliceTopicsForDayRange } from "../planner/planner-topic-generator";
import { buildArticleUserPrompt } from "./prompts";

/** Strip tags for mock “analysis” of body text (no real NLP). */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Typical SERP snippet length target. */
function seoMetaDescription(parts: {
  primaryKeyword: string;
  niche: string;
  audience: string;
  brandName: string;
  bodyHint: string;
}): string {
  const base = `${parts.bodyHint.slice(0, 90)} Learn ${parts.primaryKeyword} best practices for ${parts.niche}. Built for ${parts.audience.slice(0, 40)}. ${parts.brandName ? `${parts.brandName}.` : ""}`;
  const cleaned = base.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 155) return cleaned;
  return `${cleaned.slice(0, 152)}…`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const intents = ["informational", "commercial", "comparison", "problem-solution"] as const;
const articleTypes = ["how-to", "listicle", "guide", "comparison", "pillar", "case-study"] as const;

export class MockAIService implements AIService {
  async generateTopics(input: {
    website: WebsiteContext;
    year: number;
    month: number;
    postsPerDay: number;
    fromDay?: number;
    toDay?: number;
  }): Promise<GeneratedTopic[]> {
    const full = generatePlannedTopicsForMonth(input);
    if (input.fromDay != null && input.toDay != null) {
      return sliceTopicsForDayRange(full, input.year, input.month, input.postsPerDay, input.fromDay, input.toDay);
    }
    return full;
  }

  async regenerateTopic(input: {
    website: WebsiteContext;
    existing: GeneratedTopic;
    publishDateIso: string;
  }): Promise<GeneratedTopic> {
    const seed = hashString(`${input.existing.primaryKeyword}-${Date.now()}`);
    return {
      proposedTitle: `${input.existing.proposedTitle} (refreshed)`,
      primaryKeyword: input.existing.primaryKeyword,
      secondaryKeywords: [
        pick(input.website.secondaryThemes, seed) || "insights",
        ...input.existing.secondaryKeywords.slice(0, 1),
      ],
      searchIntent: pick([...intents], seed + 1),
      articleType: pick([...articleTypes], seed + 2),
      brief: `${input.existing.brief}\n\nUpdated angle for ${input.publishDateIso}: add examples and a stronger CTA.`,
    };
  }

  async generateArticle(input: {
    website: WebsiteContext;
    topic: {
      proposedTitle: string;
      primaryKeyword: string;
      secondaryKeywords: string[];
      searchIntent: string;
      articleType: string;
      brief: string;
    };
    options?: { language?: string; articleLength?: "short" | "standard" | "long" };
  }): Promise<GeneratedArticlePayload> {
    const { website, topic, options } = input;
    const articleLength = options?.articleLength ?? website.defaultArticleLength ?? "standard";
    const language = options?.language ?? website.defaultLanguage ?? "en";
    const prompt = buildArticleUserPrompt({
      proposedTitle: topic.proposedTitle,
      primaryKeyword: topic.primaryKeyword,
      secondaryKeywords: topic.secondaryKeywords,
      searchIntent: topic.searchIntent,
      articleType: topic.articleType,
      brief: topic.brief,
      brandName: website.brandName,
      tone: website.toneOfVoice,
      audience: website.targetAudience,
      niche: website.niche,
      seoRules: website.seoRules,
    });
    void prompt;
    const slug = topic.proposedTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const outline: { level: 1 | 2 | 3; text: string }[] = [
      { level: 1, text: topic.proposedTitle },
      { level: 2, text: `Why ${topic.primaryKeyword} matters for ${website.niche}` },
      { level: 2, text: "Key steps and implementation" },
      { level: 3, text: "Step 1: Assess your baseline" },
      { level: 3, text: "Step 2: Apply best practices" },
      { level: 2, text: "Common mistakes to avoid" },
      { level: 2, text: "FAQ and next steps" },
    ];
    const jsonLdExample =
      '{"@context":"https://schema.org","@graph":[' +
      '{"@type":"Article","headline":"' +
      topic.proposedTitle.replace(/"/g, '\\"') +
      '","inLanguage":"' +
      language +
      '","author":{"@type":"Organization","name":"' +
      website.brandName.replace(/"/g, '\\"') +
      '"}},' +
      '{"@type":"FAQPage","mainEntity":[]}' +
      "]}";
    const complianceBlock = `
<section data-internal="compliance">
<p><strong>Compliance:</strong> ${website.complianceNotes ?? "Review marketing claims with your compliance team before publishing."}</p>
<p><strong>Forbidden / sensitive claims:</strong> ${website.forbiddenClaims ?? "Do not state unverified medical, financial, or guaranteed outcomes."}</p>
</section>`;
    const mainSections =
      articleLength === "short"
        ? `
<h2>${outline[1].text}</h2>
<p>Concise overview for ${website.niche}; use ${topic.primaryKeyword} naturally in the opening.</p>
<h2>${outline[6].text}</h2>
<p>Quick recap and one CTA.</p>`
        : articleLength === "long"
          ? `
<h2>${outline[1].text}</h2>
<p>Open with a problem statement, then preview the outcome. Use ${topic.primaryKeyword} in the first 100 words without stuffing.</p>
<ul>
<li>Key takeaway aligned to ${website.niche}</li>
<li>Measurable outcome (traffic, leads, or retention)</li>
<li>Deep-dive: methodology and data sources</li>
</ul>
<h2>${outline[2].text}</h2>
<h3>${outline[3].text}</h3>
<p>Extended paragraph with examples, edge cases, and internal link placeholders.</p>
<h3>${outline[4].text}</h3>
<p>Checklist: (1) baseline, (2) experiment, (3) review. Mention ${website.brandName} once in context.</p>
<h2>Resources &amp; further reading</h2>
<p>Curated links and glossary for ${topic.primaryKeyword}.</p>
<h2>${outline[5].text}</h2>
<p>Contrast weak vs strong approaches; keep entities and keywords natural.</p>
<section data-mock="faq">
<h2>${outline[6].text}</h2>
</section>`
          : `
<h2>${outline[1].text}</h2>
<p>Open with a problem statement, then preview the outcome. Use ${topic.primaryKeyword} in the first 100 words without stuffing.</p>
<ul>
<li>Key takeaway aligned to ${website.niche}</li>
<li>Measurable outcome (traffic, leads, or retention)</li>
</ul>
<h2>${outline[2].text}</h2>
<h3>${outline[3].text}</h3>
<p>Short paragraph (45–65 words). Include one stat placeholder and a transition to implementation.</p>
<h3>${outline[4].text}</h3>
<p>Checklist: (1) baseline, (2) experiment, (3) review. Mention ${website.brandName} once in context.</p>
<h2>${outline[5].text}</h2>
<p>Contrast weak vs strong approaches; keep entities and keywords natural.</p>
<section data-mock="faq">
<h2>${outline[6].text}</h2>
</section>`;
    const bodyHtml = `
<article lang="${language}" data-article-length="${articleLength}">
<h1>${outline[0].text}</h1>
<p class="lead"><strong>Search intent:</strong> ${topic.searchIntent}. Target reader: ${website.targetAudience}. Voice: ${website.toneOfVoice}.</p>
<p><em>Focus keyword</em>: <strong>${topic.primaryKeyword}</strong>. Supporting terms: ${topic.secondaryKeywords.slice(0, 3).join(", ")}.</p>
${complianceBlock}
${mainSections}
</article>
`.trim();
    const faq = [
      {
        question: `What is ${topic.primaryKeyword} in ${website.niche}?`,
        answer: `A practical definition for teams optimizing for ${topic.searchIntent} queries, with examples relevant to ${website.targetAudience.split(",")[0]?.trim() ?? "your audience"}.`,
      },
      {
        question: `How long until results?`,
        answer: `Expect 2–4 weeks for early signals; compound gains over 8–12 weeks with consistent publishing and internal links.`,
      },
      {
        question: `What should I avoid?`,
        answer: `Thin content, duplicate titles, and keyword stuffing. Prefer semantic coverage and helpful structure.`,
      },
    ];
    const plainHint = stripHtml(bodyHtml).slice(0, 120);
    const metaDescription = seoMetaDescription({
      primaryKeyword: topic.primaryKeyword,
      niche: website.niche,
      audience: website.targetAudience,
      brandName: website.brandName,
      bodyHint: plainHint || topic.brief,
    });
    return {
      seoTitle: `${topic.proposedTitle} | ${website.brandName}`,
      metaTitle: `${topic.proposedTitle}`.slice(0, 58),
      metaDescription,
      slug,
      focusKeyword: topic.primaryKeyword,
      secondaryKeywords: topic.secondaryKeywords,
      excerpt: topic.brief.length > 220 ? `${topic.brief.slice(0, 217)}…` : topic.brief,
      h1: topic.proposedTitle,
      outline,
      bodyHtml,
      faq,
      internalLinkIdeas: [
        { anchor: `${website.niche} fundamentals`, note: "Link to pillar category page when live." },
        { anchor: "related how-to guide", note: "Support topical cluster internal links." },
      ],
      suggestedCta: `Download the ${website.niche} ${topic.articleType} worksheet from ${website.brandName} or book a 15‑minute strategy call.`,
      schemaTypes: ["Article", "FAQPage", "Organization"],
      schemaSuggestion: jsonLdExample,
      imagePrompt: `Editorial hero image: modern workspace, ${website.niche} context, soft light, no text overlay, brand-safe.`,
      tagsSuggestion: [topic.primaryKeyword, website.niche, topic.articleType],
      categoriesSuggestion: website.categories.slice(0, 3),
      wpReadyPayload: {
        status: "draft",
        title: topic.proposedTitle,
        slug,
        excerpt: topic.brief,
        schemaTypes: ["Article", "FAQPage", "Organization"],
        seo: {
          metaTitle: `${topic.proposedTitle}`.slice(0, 60),
          metaDescription,
          focusKeyword: topic.primaryKeyword,
          canonicalPath: `/${slug}`,
        },
        yoastFocusKeyword: topic.primaryKeyword,
        blocks: "future: Gutenberg or REST payload",
      },
    };
  }

  async generateSEOFields(input: {
    website: WebsiteContext;
    bodyHtml: string;
    topicTitle: string;
    primaryKeyword: string;
  }): Promise<Pick<GeneratedArticlePayload, "metaTitle" | "metaDescription" | "slug">> {
    const slug = input.topicTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const plain = stripHtml(input.bodyHtml);
    const metaDescription = seoMetaDescription({
      primaryKeyword: input.primaryKeyword,
      niche: input.website.niche,
      audience: input.website.targetAudience,
      brandName: input.website.brandName,
      bodyHint: plain.slice(0, 160) || input.topicTitle,
    });
    const metaTitle = `${input.topicTitle} | ${input.website.brandName}`.slice(0, 60);
    return {
      metaTitle,
      metaDescription,
      slug,
    };
  }

  async improveArticle(input: {
    website: WebsiteContext;
    bodyHtml: string;
    instruction: string;
  }): Promise<{ bodyHtml: string }> {
    const summary = input.instruction.trim().slice(0, 200);
    const brand = input.website.brandName || "your brand";
    const refinement = `
<aside class="ai-refinement" data-mock="improvement">
<p><strong>Refinement applied</strong> (${brand} voice)</p>
<p>${summary}</p>
<p>Edits: tightened headings, improved keyword placement for ${input.website.niche}, and clearer scannability.</p>
</aside>`;
    return {
      bodyHtml: `${input.bodyHtml}\n${refinement}`,
    };
  }
}

export function createMockAIService(): AIService {
  return new MockAIService();
}
