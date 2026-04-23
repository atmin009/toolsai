import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { generateTopics, getAIServiceForWebsite, type GeneratedTopic } from "./ai";
import { loadWebsiteContext, toAIWebsiteContext } from "./website-context";
import { filterDuplicateTopics, loadExistingKeywords } from "./topic-dedup";
import type { z } from "zod";
import { plannerGenerateSchema } from "../validation/planner.schema";

type GenerateInput = z.infer<typeof plannerGenerateSchema>;

export async function generateMonthlyPlan(input: GenerateInput, userId?: string | null) {
  const { websiteId, year, month, postsPerDay, chunk } = input;
  const loaded = await loadWebsiteContext(websiteId);
  const ai = await getAIServiceForWebsite(loaded.website, userId);
  const website = toAIWebsiteContext(loaded);

  const daysInMonth = new Date(year, month, 0).getDate();
  const totalSlots = daysInMonth * postsPerDay;

  const existingKwSet = await loadExistingKeywords(websiteId);
  const existingKeywords = [...existingKwSet];

  const plannerConfig = {
    year,
    month,
    postsPerDay,
    existingKeywords,
    ...(chunk ? { fromDay: chunk.fromDay, toDay: chunk.toDay } : {}),
  };

  let topics: GeneratedTopic[];
  try {
    topics = await generateTopics(ai, website, plannerConfig);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(502, `AI planner failed: ${msg}`);
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.monthlyPlan.upsert({
      where: { websiteId_year_month: { websiteId, year, month } },
      create: { websiteId, year, month, postsPerDay },
      update: { postsPerDay },
    });

    // Full-month: delete all topics in this plan first, then dedup against OTHER plans only
    if (!chunk) {
      await tx.plannedTopic.deleteMany({ where: { monthlyPlanId: plan.id } });

      const { unique: dedupedTopics, skippedCount } = await filterDuplicateTopics(
        websiteId, topics, plan.id
      );

      const created: Awaited<ReturnType<typeof tx.plannedTopic.create>>[] = [];
      let sortOrder = 0;
      let ti = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        for (let p = 0; p < postsPerDay; p++) {
          const t = dedupedTopics[ti];
          ti += 1;
          if (!t) break;
          sortOrder += 1;
          const row = await persistOneTopic(tx, plan.id, t, year, month, d, sortOrder);
          created.push(row);
        }
      }
      return {
        plan,
        topics: created,
        skippedDuplicates: skippedCount,
        progress: { mode: "full" as const, totalSlots, createdCount: created.length },
      };
    }

    if (chunk.resetMonth) {
      await tx.plannedTopic.deleteMany({ where: { monthlyPlanId: plan.id } });
    } else {
      const startUtc = new Date(Date.UTC(year, month - 1, chunk.fromDay, 0, 0, 0, 0));
      const endUtc = new Date(Date.UTC(year, month - 1, chunk.toDay, 23, 59, 59, 999));
      await tx.plannedTopic.deleteMany({
        where: {
          monthlyPlanId: plan.id,
          recommendedPublishDate: { gte: startUtc, lte: endUtc },
        },
      });
    }

    // Chunk: exclude this plan from dedup only if resetMonth cleared it
    const excludePlan = chunk.resetMonth ? plan.id : undefined;
    const { unique: dedupedTopics, skippedCount } = await filterDuplicateTopics(
      websiteId, topics, excludePlan
    );

    const created: Awaited<ReturnType<typeof tx.plannedTopic.create>>[] = [];
    let ti = 0;
    for (let d = chunk.fromDay; d <= chunk.toDay; d++) {
      for (let p = 0; p < postsPerDay; p++) {
        const t = dedupedTopics[ti];
        ti += 1;
        if (!t) break;
        const sortOrder = (d - 1) * postsPerDay + p + 1;
        const row = await persistOneTopic(tx, plan.id, t, year, month, d, sortOrder);
        created.push(row);
      }
    }

    return {
      plan,
      topics: created,
      skippedDuplicates: skippedCount,
      progress: {
        mode: "chunk" as const,
        fromDay: chunk.fromDay,
        toDay: chunk.toDay,
        resetMonth: chunk.resetMonth,
        totalSlotsInMonth: totalSlots,
        createdInChunk: created.length,
      },
    };
  });
}

async function persistOneTopic(
  tx: Prisma.TransactionClient,
  monthlyPlanId: string,
  t: GeneratedTopic,
  year: number,
  month: number,
  day: number,
  sortOrder: number
) {
  const recommendedPublishDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return tx.plannedTopic.create({
    data: {
      monthlyPlanId,
      proposedTitle: t.proposedTitle,
      primaryKeyword: t.primaryKeyword,
      secondaryKeywords: t.secondaryKeywords,
      searchIntent: t.searchIntent,
      articleType: t.articleType,
      brief: t.brief,
      recommendedPublishDate,
      status: "draft_topic",
      sortOrder,
    },
  });
}

export async function getMonthlyPlan(websiteId: string, year: number, month: number) {
  if (!websiteId || !Number.isFinite(year) || !Number.isFinite(month)) {
    throw new AppError(400, "websiteId, year, month are required");
  }

  const plan = await prisma.monthlyPlan.findUnique({
    where: { websiteId_year_month: { websiteId, year, month } },
    include: {
      plannedTopics: { orderBy: [{ recommendedPublishDate: "asc" }, { sortOrder: "asc" }] },
    },
  });

  if (!plan) return { plan: null, topics: [] };
  return { plan, topics: plan.plannedTopics };
}

export { generatePlannedTopicsForMonth } from "./planner/planner-topic-generator";
export type { PlannerGenerationInput } from "./planner/planner-topic-generator";
