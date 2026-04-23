import { prisma } from "../lib/prisma";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface DedupCandidate {
  proposedTitle: string;
  primaryKeyword: string;
}

export interface DedupResult {
  isDuplicate: boolean;
  /** Which field matched: "keyword" or "title" */
  field?: "keyword" | "title";
  existingTitle?: string;
}

/**
 * Load all existing primaryKeyword values for a website (across all months).
 * Returns a Set of normalized keywords for fast lookup.
 */
export async function loadExistingKeywords(websiteId: string): Promise<Set<string>> {
  const rows = await prisma.plannedTopic.findMany({
    where: { monthlyPlan: { websiteId } },
    select: { primaryKeyword: true },
  });
  return new Set(rows.map((r) => normalize(r.primaryKeyword)));
}

/**
 * Load all existing primaryKeyword + proposedTitle for a website.
 */
async function loadExistingTopics(websiteId: string) {
  return prisma.plannedTopic.findMany({
    where: { monthlyPlan: { websiteId } },
    select: { primaryKeyword: true, proposedTitle: true },
  });
}

/**
 * Check a list of candidates against existing topics in the DB for a given website.
 * Matches on normalized primaryKeyword (exact) or normalized proposedTitle (exact).
 */
export async function findDuplicates(
  websiteId: string,
  candidates: DedupCandidate[],
  /** Topic IDs to exclude from matching (e.g. topics being replaced in the current chunk) */
  excludePlanId?: string
): Promise<DedupResult[]> {
  const whereClause = excludePlanId
    ? { monthlyPlan: { websiteId }, NOT: { monthlyPlanId: excludePlanId } }
    : { monthlyPlan: { websiteId } };

  const existing = await prisma.plannedTopic.findMany({
    where: whereClause,
    select: { primaryKeyword: true, proposedTitle: true },
  });

  const keywordSet = new Map<string, string>();
  const titleSet = new Map<string, string>();
  for (const row of existing) {
    keywordSet.set(normalize(row.primaryKeyword), row.proposedTitle);
    titleSet.set(normalize(row.proposedTitle), row.proposedTitle);
  }

  return candidates.map((c) => {
    const nk = normalize(c.primaryKeyword);
    if (keywordSet.has(nk)) {
      return { isDuplicate: true, field: "keyword" as const, existingTitle: keywordSet.get(nk) };
    }
    const nt = normalize(c.proposedTitle);
    if (titleSet.has(nt)) {
      return { isDuplicate: true, field: "title" as const, existingTitle: titleSet.get(nt) };
    }
    return { isDuplicate: false };
  });
}

/**
 * Filter out duplicate topics from a generated list, returning only unique ones.
 * Also tracks within-batch uniqueness so the batch itself has no internal duplicates.
 */
export async function filterDuplicateTopics<T extends DedupCandidate>(
  websiteId: string,
  topics: T[],
  excludePlanId?: string
): Promise<{ unique: T[]; skippedCount: number }> {
  const results = await findDuplicates(websiteId, topics, excludePlanId);

  const seenInBatch = new Set<string>();
  const unique: T[] = [];
  let skippedCount = 0;

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const result = results[i];
    const nk = normalize(topic.primaryKeyword);

    if (result.isDuplicate || seenInBatch.has(nk)) {
      skippedCount++;
      continue;
    }
    seenInBatch.add(nk);
    unique.push(topic);
  }

  return { unique, skippedCount };
}
