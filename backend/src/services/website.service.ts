import type { Website } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { resolveClaudeApiKey, resolveGoogleApiKey, resolveOpenAiApiKey } from "./ai/ai-key-resolve";
import { normalizeWpApplicationPassword } from "./wordpress.service";
import { pingProvider } from "./ai/ai-connection-test";
import type { z } from "zod";
import { websiteCreateSchema, websiteUpdateSchema } from "../validation/website.schema";

type CreateInput = z.infer<typeof websiteCreateSchema>;
type UpdateInput = z.infer<typeof websiteUpdateSchema>;

/** Strip secret API keys / WP app password from API responses; expose whether credentials exist. */
export function sanitizeWebsiteForClient(
  website: Website & { keywordGroups?: unknown[]; categories?: unknown[]; _count?: unknown }
): Omit<Website, "openaiApiKey" | "googleApiKey" | "claudeApiKey" | "wpApplicationPassword" | "wpPluginApiKey"> & {
  hasOpenaiApiKey: boolean;
  hasGoogleApiKey: boolean;
  hasClaudeApiKey: boolean;
  hasWpCredentials: boolean;
  hasWpPluginKey: boolean;
} {
  const { openaiApiKey, googleApiKey, claudeApiKey, wpApplicationPassword, wpPluginApiKey, ...rest } = website;
  const hasWpPluginKey = !!wpPluginApiKey?.trim();
  return {
    ...(rest as Omit<
      Website,
      "openaiApiKey" | "googleApiKey" | "claudeApiKey" | "wpApplicationPassword" | "wpPluginApiKey"
    >),
    hasOpenaiApiKey: !!openaiApiKey?.trim(),
    hasGoogleApiKey: !!googleApiKey?.trim(),
    hasClaudeApiKey: !!claudeApiKey?.trim(),
    hasWpCredentials: !!(
      (website.wpSiteUrl?.trim() && hasWpPluginKey) ||
      (website.wpSiteUrl?.trim() && website.wpUsername?.trim() && wpApplicationPassword?.trim())
    ),
    hasWpPluginKey,
  };
}

export async function listWebsites() {
  return prisma.website.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { monthlyPlans: true, keywordGroups: true, categories: true } },
    },
  });
}

export async function getWebsiteById(id: string) {
  const website = await prisma.website.findUnique({
    where: { id },
    include: { keywordGroups: true, categories: true },
  });
  if (!website) throw new AppError(404, "Website not found");
  return website;
}

export async function createWebsite(input: CreateInput) {
  const { keywordGroups, categories, ...data } = input;
  return prisma.website.create({
    data: {
      ...data,
      defaultLanguage: data.defaultLanguage ?? "th",
      keywordBlacklist: data.keywordBlacklist ?? [],
      forbiddenClaims: data.forbiddenClaims ?? null,
      complianceNotes: data.complianceNotes ?? null,
      defaultArticleLength: data.defaultArticleLength ?? "standard",
      aiProvider: data.aiProvider ?? "mock",
      aiModel: data.aiModel ?? null,
      aiTemperature: data.aiTemperature ?? null,
      aiMaxTokens: data.aiMaxTokens ?? null,
      aiFallbackProvider: data.aiFallbackProvider ?? null,
      openaiApiKey: data.openaiApiKey ?? null,
      googleApiKey: data.googleApiKey ?? null,
      claudeApiKey: data.claudeApiKey ?? null,
      keywordGroups: keywordGroups?.length
        ? {
            create: keywordGroups.map((kg) => ({
              type: kg.type,
              label: kg.label,
              keywords: kg.keywords,
            })),
          }
        : undefined,
      categories: categories?.length
        ? { create: categories.map((c) => ({ name: c.name, description: c.description })) }
        : undefined,
    },
    include: { keywordGroups: true, categories: true },
  });
}

export async function updateWebsite(id: string, input: UpdateInput) {
  const existing = await prisma.website.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Website not found");

  const { keywordGroups, categories, wpApplicationPassword, wpPluginApiKey, ...rest } = input;

  await prisma.$transaction(async (tx) => {
    await tx.website.update({
      where: { id },
      data: {
        ...rest,
        articleGoals: rest.articleGoals ?? undefined,
        ...(wpApplicationPassword !== undefined
          ? {
              wpApplicationPassword: wpApplicationPassword
                ? normalizeWpApplicationPassword(wpApplicationPassword)
                : null,
            }
          : {}),
        ...(wpPluginApiKey !== undefined
          ? { wpPluginApiKey: wpPluginApiKey?.trim() ? wpPluginApiKey.trim() : null }
          : {}),
      },
    });

    if (keywordGroups) {
      await tx.keywordGroup.deleteMany({ where: { websiteId: id } });
      await tx.keywordGroup.createMany({
        data: keywordGroups.map((kg) => ({
          websiteId: id,
          type: kg.type,
          label: kg.label,
          keywords: kg.keywords,
        })),
      });
    }

    if (categories) {
      await tx.contentCategory.deleteMany({ where: { websiteId: id } });
      await tx.contentCategory.createMany({
        data: categories.map((c) => ({
          websiteId: id,
          name: c.name,
          description: c.description ?? null,
        })),
      });
    }
  });

  const website = await prisma.website.findUnique({
    where: { id },
    include: { keywordGroups: true, categories: true },
  });
  if (!website) throw new AppError(404, "Website not found");
  return website;
}

export async function testWebsiteAIConnection(id: string, userId?: string | null) {
  const w = await getWebsiteById(id);
  const p = (w.aiProvider ?? "mock").toLowerCase();
  if (p === "mock") {
    return { ok: true as const, message: "Mock provider — no network call." };
  }
  if (p !== "openai" && p !== "google" && p !== "claude") {
    throw new AppError(400, "Invalid AI provider");
  }
  let userKeys:
    | { openaiApiKey: string | null; googleApiKey: string | null; claudeApiKey: string | null }
    | null = null;
  if (userId) {
    userKeys = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiApiKey: true, googleApiKey: true, claudeApiKey: true },
    });
  }
  const resolved =
    p === "openai"
      ? resolveOpenAiApiKey(w, userKeys)
      : p === "google"
        ? resolveGoogleApiKey(w, userKeys)
        : resolveClaudeApiKey(w, userKeys);
  try {
    await pingProvider(p, w.aiModel, resolved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(502, `AI connection failed: ${msg}`);
  }
  return { ok: true as const, message: "Credentials and model accepted a test request." };
}

export async function deleteWebsite(id: string) {
  try {
    await prisma.website.delete({ where: { id } });
  } catch {
    throw new AppError(404, "Website not found");
  }
}

/** Deep-copy keyword groups and categories; new domain gets a unique suffix. */
export async function duplicateWebsite(id: string, name?: string) {
  const w = await getWebsiteById(id);
  const domainSuffix = `-copy-${Date.now().toString(36)}`;
  return prisma.website.create({
    data: {
      name: name ?? `${w.name} (copy)`,
      domain: w.domain.length + domainSuffix.length > 200 ? `${w.domain.slice(0, 120)}${domainSuffix}` : `${w.domain}${domainSuffix}`,
      brandName: w.brandName,
      niche: w.niche,
      defaultLanguage: w.defaultLanguage,
      targetAudience: w.targetAudience,
      toneOfVoice: w.toneOfVoice,
      seoRules: w.seoRules,
      articleGoals: w.articleGoals as Prisma.InputJsonValue,
      keywordBlacklist: w.keywordBlacklist as Prisma.InputJsonValue,
      forbiddenClaims: w.forbiddenClaims,
      complianceNotes: w.complianceNotes,
      defaultArticleLength: w.defaultArticleLength,
      aiProvider: w.aiProvider,
      aiModel: w.aiModel,
      aiTemperature: w.aiTemperature,
      aiMaxTokens: w.aiMaxTokens,
      aiFallbackProvider: w.aiFallbackProvider,
      openaiApiKey: null,
      googleApiKey: null,
      claudeApiKey: null,
      wpSiteUrl: null,
      wpUsername: null,
      wpApplicationPassword: null,
      wpPluginApiKey: null,
      wpDefaultStatus: "draft",
      keywordGroups: {
        create: w.keywordGroups.map((kg) => ({
          type: kg.type,
          label: kg.label,
          keywords: kg.keywords as Prisma.InputJsonValue,
        })),
      },
      categories: {
        create: w.categories.map((c) => ({
          name: c.name,
          description: c.description,
        })),
      },
    },
    include: { keywordGroups: true, categories: true },
  });
}
