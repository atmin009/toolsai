import { Prisma, TopicStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { asStringArray } from "../lib/jsonArrays";
import { getAIServiceForWebsite, regenerateTopic as aiRegenerateTopic } from "./ai";
import { loadWebsiteContext, toAIWebsiteContext } from "./website-context";
import { findDuplicates } from "./topic-dedup";
import type { z } from "zod";
import { manualTopicCreateSchema, topicUpdateSchema } from "../validation/topic.schema";

type TopicUpdateInput = z.infer<typeof topicUpdateSchema>;
type ManualTopicInput = z.infer<typeof manualTopicCreateSchema>;

export async function listTopics(filters: {
  websiteId?: string;
  monthlyPlanId?: string;
  status?: TopicStatus;
  source?: "planner" | "manual";
  q?: string;
  sortBy?: "date" | "title" | "status" | "updated";
  order?: "asc" | "desc";
  /** When both set, return all matching topics for the calendar (no pagination). */
  calendarYear?: number;
  calendarMonth?: number;
  page?: number;
  limit?: number;
}) {
  const q = filters.q?.trim();
  const calendarMode =
    filters.calendarYear != null &&
    filters.calendarMonth != null &&
    filters.calendarYear >= 1970 &&
    filters.calendarYear <= 2100 &&
    filters.calendarMonth >= 1 &&
    filters.calendarMonth <= 12;

  const monthlyPlanWhere: Prisma.MonthlyPlanWhereInput = {
    ...(filters.websiteId ? { websiteId: filters.websiteId } : {}),
    ...(calendarMode
      ? { year: filters.calendarYear!, month: filters.calendarMonth! }
      : {}),
  };

  const where: Prisma.PlannedTopicWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.monthlyPlanId ? { monthlyPlanId: filters.monthlyPlanId } : {}),
    ...(Object.keys(monthlyPlanWhere).length > 0 ? { monthlyPlan: monthlyPlanWhere } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(q
      ? {
          OR: [
            { proposedTitle: { contains: q } },
            { primaryKeyword: { contains: q } },
            { brief: { contains: q } },
          ],
        }
      : {}),
  };

  const sortBy = filters.sortBy ?? "date";
  const order = filters.order === "desc" ? "desc" : "asc";
  let orderBy: Prisma.PlannedTopicOrderByWithRelationInput[] = [{ recommendedPublishDate: order }, { sortOrder: "asc" }];
  if (sortBy === "title") orderBy = [{ proposedTitle: order }, { sortOrder: "asc" }];
  else if (sortBy === "status") orderBy = [{ status: order }, { recommendedPublishDate: "asc" }];
  else if (sortBy === "updated") orderBy = [{ updatedAt: order }];

  const include = {
    monthlyPlan: { select: { id: true, year: true, month: true, websiteId: true } },
    article: { select: { id: true } },
  };

  if (calendarMode) {
    const items = await prisma.plannedTopic.findMany({
      where,
      orderBy,
      include,
    });
    return { items, total: items.length, page: 1, limit: items.length };
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const [items, total] = await prisma.$transaction([
    prisma.plannedTopic.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include,
    }),
    prisma.plannedTopic.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function createManualTopic(input: ManualTopicInput) {
  const [dupResult] = await findDuplicates(input.websiteId, [
    { proposedTitle: input.proposedTitle, primaryKeyword: input.primaryKeyword },
  ]);
  if (dupResult.isDuplicate) {
    const field = dupResult.field === "keyword" ? "primaryKeyword" : "proposedTitle";
    throw new AppError(
      409,
      `Duplicate ${field}: "${dupResult.field === "keyword" ? input.primaryKeyword : input.proposedTitle}" already exists — "${dupResult.existingTitle}"`
    );
  }

  const plan = await prisma.monthlyPlan.upsert({
    where: {
      websiteId_year_month: { websiteId: input.websiteId, year: input.year, month: input.month },
    },
    create: { websiteId: input.websiteId, year: input.year, month: input.month, postsPerDay: 1 },
    update: {},
  });
  const agg = await prisma.plannedTopic.aggregate({
    where: { monthlyPlanId: plan.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? 0) + 1;
  return prisma.plannedTopic.create({
    data: {
      monthlyPlanId: plan.id,
      proposedTitle: input.proposedTitle,
      primaryKeyword: input.primaryKeyword,
      secondaryKeywords: input.secondaryKeywords,
      searchIntent: input.searchIntent,
      articleType: input.articleType,
      brief: input.brief,
      recommendedPublishDate: new Date(input.recommendedPublishDate),
      status: TopicStatus.draft_topic,
      sortOrder,
      source: "manual",
    },
    include: { monthlyPlan: true, article: true },
  });
}

export async function bulkDeleteTopicIds(ids: string[]) {
  await prisma.plannedTopic.deleteMany({ where: { id: { in: ids } } });
}

export async function getTopicById(id: string) {
  const topic = await prisma.plannedTopic.findUnique({
    where: { id },
    include: {
      monthlyPlan: { include: { website: true } },
      article: true,
    },
  });
  if (!topic) throw new AppError(404, "Topic not found");
  return topic;
}

export async function updateTopic(id: string, input: TopicUpdateInput) {
  const data: Record<string, unknown> = { ...input };
  if (input.recommendedPublishDate) {
    data.recommendedPublishDate = new Date(input.recommendedPublishDate);
  }

  try {
    return await prisma.plannedTopic.update({
      where: { id },
      data: data as object,
      include: { monthlyPlan: true, article: true },
    });
  } catch {
    throw new AppError(404, "Topic not found");
  }
}

export async function approveTopic(id: string) {
  try {
    return await prisma.plannedTopic.update({
      where: { id },
      data: { status: "approved_topic" },
    });
  } catch {
    throw new AppError(404, "Topic not found");
  }
}

export async function rejectTopic(id: string) {
  try {
    await prisma.plannedTopic.delete({ where: { id } });
  } catch {
    throw new AppError(404, "Topic not found");
  }
}

export async function regenerateTopic(id: string, userId?: string | null) {
  const existing = await prisma.plannedTopic.findUnique({
    where: { id },
    include: { monthlyPlan: true },
  });
  if (!existing) throw new AppError(404, "Topic not found");

  const loaded = await loadWebsiteContext(existing.monthlyPlan.websiteId);
  const ai = await getAIServiceForWebsite(loaded.website, userId);
  const next = await aiRegenerateTopic(
    ai,
    toAIWebsiteContext(loaded),
    {
      proposedTitle: existing.proposedTitle,
      primaryKeyword: existing.primaryKeyword,
      secondaryKeywords: asStringArray(existing.secondaryKeywords),
      searchIntent: existing.searchIntent,
      articleType: existing.articleType,
      brief: existing.brief,
    },
    existing.recommendedPublishDate.toISOString()
  );

  return prisma.plannedTopic.update({
    where: { id },
    data: {
      proposedTitle: next.proposedTitle,
      primaryKeyword: next.primaryKeyword,
      secondaryKeywords: next.secondaryKeywords,
      searchIntent: next.searchIntent,
      articleType: next.articleType,
      brief: next.brief,
      status: "draft_topic",
    },
  });
}

export async function bulkApproveTopicIds(ids: string[]) {
  await prisma.plannedTopic.updateMany({
    where: { id: { in: ids } },
    data: { status: "approved_topic" },
  });
  return prisma.plannedTopic.findMany({ where: { id: { in: ids } } });
}

export async function bulkRegenerateTopicIds(ids: string[], userId?: string | null) {
  const updated = [];

  for (const id of ids) {
    const existing = await prisma.plannedTopic.findUnique({
      where: { id },
      include: { monthlyPlan: true },
    });
    if (!existing) continue;

    const loaded = await loadWebsiteContext(existing.monthlyPlan.websiteId);
    const ai = await getAIServiceForWebsite(loaded.website, userId);
    const next = await aiRegenerateTopic(
      ai,
      toAIWebsiteContext(loaded),
      {
        proposedTitle: existing.proposedTitle,
        primaryKeyword: existing.primaryKeyword,
        secondaryKeywords: asStringArray(existing.secondaryKeywords),
        searchIntent: existing.searchIntent,
        articleType: existing.articleType,
        brief: existing.brief,
      },
      existing.recommendedPublishDate.toISOString()
    );

    const topic = await prisma.plannedTopic.update({
      where: { id },
      data: {
        proposedTitle: next.proposedTitle,
        primaryKeyword: next.primaryKeyword,
        secondaryKeywords: next.secondaryKeywords,
        searchIntent: next.searchIntent,
        articleType: next.articleType,
        brief: next.brief,
        status: "draft_topic",
      },
    });
    updated.push(topic);
  }

  return updated;
}

export function parseTopicStatusQuery(raw: string | undefined): TopicStatus | undefined {
  if (!raw) return undefined;
  return (Object.values(TopicStatus) as string[]).includes(raw) ? (raw as TopicStatus) : undefined;
}

export function parseTopicSourceQuery(raw: string | undefined): "planner" | "manual" | undefined {
  if (raw === "planner" || raw === "manual") return raw;
  return undefined;
}
