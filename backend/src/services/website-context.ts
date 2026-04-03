import type { Website } from "@prisma/client";
import type { WebsiteContext } from "./ai/ai.types";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { asStringArray } from "../lib/jsonArrays";

function parseArticleLength(raw: string): "short" | "standard" | "long" {
  if (raw === "short" || raw === "long" || raw === "standard") return raw;
  return "standard";
}

export async function loadWebsiteContext(websiteId: string): Promise<WebsiteContext & { website: Website }> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: {
      keywordGroups: true,
      categories: true,
    },
  });
  if (!website) throw new AppError(404, "Website not found");

  const primaryThemes = website.keywordGroups
    .filter((k) => k.type === "primary")
    .flatMap((k) => asStringArray(k.keywords));
  const secondaryThemes = website.keywordGroups
    .filter((k) => k.type === "secondary")
    .flatMap((k) => asStringArray(k.keywords));

  const keywordGroups = website.keywordGroups.map((k) => ({
    type: k.type as "primary" | "secondary",
    label: k.label,
    keywords: asStringArray(k.keywords),
  }));

  const contentCategories = website.categories.map((c) => ({
    name: c.name,
    description: c.description,
  }));

  const ctx: WebsiteContext = {
    brandName: website.brandName,
    niche: website.niche,
    toneOfVoice: website.toneOfVoice,
    targetAudience: website.targetAudience,
    seoRules: website.seoRules,
    categories: website.categories.map((c) => c.name),
    primaryThemes: primaryThemes.length ? primaryThemes : [website.niche],
    secondaryThemes: secondaryThemes.length ? secondaryThemes : ["tips", "guide"],
    articleGoals: asStringArray(website.articleGoals),
    defaultLanguage: website.defaultLanguage,
    keywordBlacklist: asStringArray(website.keywordBlacklist),
    forbiddenClaims: website.forbiddenClaims,
    complianceNotes: website.complianceNotes,
    defaultArticleLength: parseArticleLength(website.defaultArticleLength),
    keywordGroups,
    contentCategories,
  };

  return { ...ctx, website };
}

/** Strip DB entity for AI calls. */
export function toAIWebsiteContext(loaded: WebsiteContext & { website: Website }): WebsiteContext {
  const { website: _w, ...ctx } = loaded;
  return ctx;
}
