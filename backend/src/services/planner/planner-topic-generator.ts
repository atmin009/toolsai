import type { GeneratedTopic, WebsiteContext } from "../ai/ai.types";

/** Rotating article shapes — one per slot index mod length. */
const ARTICLE_TYPES = ["how-to", "listicle", "guide", "comparison", "pillar", "case-study"] as const;

/** Required intent mix for the calendar. */
const SEARCH_INTENTS = ["informational", "commercial", "comparison", "problem-solution"] as const;

function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchesBlacklist(phrase: string, blacklist: string[]): boolean {
  if (!blacklist.length) return false;
  const n = normalizeKeyword(phrase);
  return blacklist.some((b) => {
    const bn = normalizeKeyword(b);
    if (!bn) return false;
    return n.includes(bn) || bn.includes(n);
  });
}

/** True if any visible topic field contains a blacklisted phrase. */
export function topicViolatesBlacklist(topic: GeneratedTopic, blacklist: string[]): boolean {
  if (!blacklist.length) return false;
  const parts = [topic.proposedTitle, topic.primaryKeyword, topic.brief, ...topic.secondaryKeywords];
  return parts.some((p) => matchesBlacklist(p, blacklist));
}

function collectPrimaryPool(w: WebsiteContext): string[] {
  const fromGroups =
    w.keywordGroups?.filter((g) => g.type === "primary").flatMap((g) => g.keywords.map((k) => k.trim())) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const k of fromGroups) {
    if (!k) continue;
    const n = normalizeKeyword(k);
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push(k);
  }
  if (!unique.length) {
  for (const k of w.primaryThemes) {
    const t = k.trim();
    if (!t) continue;
    const n = normalizeKeyword(t);
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push(t);
  }
  }
  const pool = unique.length ? unique : [w.niche.trim() || "content"];
  const bl = w.keywordBlacklist ?? [];
  const filtered = pool.filter((k) => !matchesBlacklist(k, bl));
  return filtered.length ? filtered : [`${pool[0] ?? "content"} (alt)`];
}

function collectSecondaryPool(w: WebsiteContext): string[] {
  const fromGroups =
    w.keywordGroups?.filter((g) => g.type === "secondary").flatMap((g) => g.keywords.map((k) => k.trim())) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const k of fromGroups) {
    if (!k) continue;
    const n = normalizeKeyword(k);
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push(k);
  }
  if (unique.length) return unique;
  for (const k of w.secondaryThemes) {
    const t = k.trim();
    if (!t) continue;
    const n = normalizeKeyword(t);
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push(t);
  }
  return unique.length ? unique : ["tips", "best practices", w.niche].filter(Boolean);
}

function categoryNames(w: WebsiteContext): string[] {
  const from = w.contentCategories?.map((c) => c.name.trim()).filter(Boolean) ?? w.categories.map((c) => c.trim()).filter(Boolean);
  return from.length ? from : ["General"];
}

/**
 * Assign a unique primary keyword per calendar slot (normalized uniqueness within the month).
 */
function uniquePrimaryForSlot(
  slotIndex: number,
  primaryPool: string[],
  categories: string[],
  niche: string,
  year: number,
  month: number,
  used: Set<string>,
  blacklist: string[]
): string {
  const kw = primaryPool[slotIndex % primaryPool.length];
  const cat = categories[slotIndex % categories.length];
  const candidates = [
    kw,
    `${kw} · ${cat}`,
    `${cat}: ${kw}`,
    `${kw} (${year})`,
    `${kw} for ${niche}`,
    `${month}/${year} — ${kw}`,
    `${kw} — angle ${slotIndex + 1}`,
  ];
  for (const c of candidates) {
    if (matchesBlacklist(c, blacklist)) continue;
    const n = normalizeKeyword(c);
    if (!used.has(n)) {
      used.add(n);
      return c;
    }
  }
  let n = 0;
  while (n < 10_000) {
    const fallback = `${kw} ${cat} #${slotIndex + 1}-${n}`;
    if (matchesBlacklist(fallback, blacklist)) {
      n += 1;
      continue;
    }
    const key = normalizeKeyword(fallback);
    if (!used.has(key)) {
      used.add(key);
      return fallback;
    }
    n += 1;
  }
  return `${kw} ${slotIndex}`;
}

function pickSecondaryKeywords(
  secondaryPool: string[],
  primaryNormalized: string,
  slotIndex: number,
  category: string
): string[] {
  const out: string[] = [];
  const used = new Set<string>([primaryNormalized]);
  let i = slotIndex;
  let guard = 0;
  while (out.length < 3 && guard < Math.max(secondaryPool.length * 6, 24)) {
    guard += 1;
    const s = secondaryPool[i % secondaryPool.length];
    i += 1;
    const n = normalizeKeyword(s);
    if (used.has(n)) continue;
    used.add(n);
    out.push(s);
  }
  while (out.length < 3) {
    const filler = `related term ${slotIndex + 1 + out.length}`;
    if (!used.has(normalizeKeyword(filler))) {
      used.add(normalizeKeyword(filler));
      out.push(filler);
    } else break;
  }
  out.push(`${category} cluster`);
  return out.slice(0, 4);
}

function buildTitle(params: {
  articleType: string;
  primaryKeyword: string;
  category: string;
  niche: string;
  brandName: string;
  year: number;
  month: number;
  day: number;
  intent: string;
}): string {
  const { articleType, primaryKeyword, category, niche, brandName, year, month, day, intent } = params;
  const listN = 5 + (day % 5);
  switch (articleType) {
    case "how-to":
      return `How to Approach ${primaryKeyword} in ${niche} (${category})`;
    case "listicle":
      return `${listN} ${primaryKeyword} Ideas for ${category} Teams (${month}/${year})`;
    case "guide":
      return `The ${category} Guide to ${primaryKeyword} [${intent}]`;
    case "comparison":
      return `${primaryKeyword} vs Alternatives: What ${niche} Buyers Should Know`;
    case "pillar":
      return `${primaryKeyword}: The Complete ${niche} Playbook — ${brandName}`;
    case "case-study":
      return `Case Study: ${primaryKeyword} in ${category}`;
    default:
      return `${primaryKeyword} — ${category} | ${brandName}`;
  }
}

function buildBrief(params: {
  website: WebsiteContext;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  articleType: string;
  category: string;
  categoryDescription: string | null;
  publishDateIso: string;
  slotIndex: number;
}): string {
  const w = params.website;
  const catHint = params.categoryDescription ? ` Category note: ${params.categoryDescription.slice(0, 120)}` : "";
  return [
    `Primary: "${params.primaryKeyword}". Supporting: ${params.secondaryKeywords.slice(0, 3).join(", ")}.`,
    `Intent: ${params.searchIntent}. Format: ${params.articleType}.`,
    `Pillar category: ${params.category}.${catHint}`,
    `Audience: ${w.targetAudience.slice(0, 200)}. Tone: ${w.toneOfVoice.slice(0, 120)}.`,
    w.seoRules ? `SEO/brand rules: ${w.seoRules.slice(0, 200)}` : "",
    `Slot ${params.slotIndex + 1}, planned date ${params.publishDateIso}.`,
    w.articleGoals.length ? `Goals: ${w.articleGoals.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export type PlannerGenerationInput = {
  website: WebsiteContext;
  year: number;
  month: number;
  postsPerDay: number;
};

/** Slice a full-month topic list to an inclusive day range (same indices as persistence). */
export function sliceTopicsForDayRange(
  fullMonthTopics: GeneratedTopic[],
  year: number,
  month: number,
  postsPerDay: number,
  fromDay: number,
  toDay: number
): GeneratedTopic[] {
  const days = new Date(year, month, 0).getDate();
  if (fromDay < 1 || toDay > days || fromDay > toDay) {
    throw new Error(`Invalid day range ${fromDay}–${toDay} for ${year}-${month} (${days} days)`);
  }
  const start = (fromDay - 1) * postsPerDay;
  const end = toDay * postsPerDay;
  return fullMonthTopics.slice(start, end);
}

/**
 * Deterministic monthly topic grid: same order as planner persistence (day ascending, then posts per day).
 * Business rules: diversify article types, rotate categories, unique primaries per month, mixed intents.
 * Status is applied when persisting (`draft_topic`).
 */
export function generatePlannedTopicsForMonth(input: PlannerGenerationInput): GeneratedTopic[] {
  const { website, year, month, postsPerDay } = input;
  const days = new Date(year, month, 0).getDate();
  const totalSlots = days * postsPerDay;

  const primaryPool = collectPrimaryPool(website);
  const secondaryPool = collectSecondaryPool(website);
  const categories = categoryNames(website);
  const usedPrimary = new Set<string>();
  const blacklist = website.keywordBlacklist ?? [];

  const topics: GeneratedTopic[] = [];
  let slotIndex = 0;

  for (let d = 1; d <= days; d++) {
    for (let p = 0; p < postsPerDay; p++) {
      const publishDateIso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const articleType = ARTICLE_TYPES[slotIndex % ARTICLE_TYPES.length];
      const searchIntent = SEARCH_INTENTS[slotIndex % SEARCH_INTENTS.length];
      const category = categories[slotIndex % categories.length];
      const categoryMeta = website.contentCategories?.find((c) => c.name === category) ?? null;

      const primaryKeyword = uniquePrimaryForSlot(
        slotIndex,
        primaryPool,
        categories,
        website.niche,
        year,
        month,
        usedPrimary,
        blacklist
      );
      const primaryNorm = normalizeKeyword(primaryKeyword);
      const secondaryKeywords = pickSecondaryKeywords(secondaryPool, primaryNorm, slotIndex, category);

      const proposedTitle = buildTitle({
        articleType,
        primaryKeyword,
        category,
        niche: website.niche,
        brandName: website.brandName,
        year,
        month,
        day: d,
        intent: searchIntent,
      });

      const brief = buildBrief({
        website,
        primaryKeyword,
        secondaryKeywords,
        searchIntent,
        articleType,
        category,
        categoryDescription: categoryMeta?.description ?? null,
        publishDateIso,
        slotIndex,
      });

      topics.push({
        proposedTitle,
        primaryKeyword,
        secondaryKeywords,
        searchIntent,
        articleType,
        brief,
      });

      slotIndex += 1;
    }
  }

  if (topics.length !== totalSlots) {
    throw new Error(`Planner generation mismatch: expected ${totalSlots} topics, got ${topics.length}`);
  }

  return topics;
}
