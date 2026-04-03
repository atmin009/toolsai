import { z } from "zod";
import type { GeneratedTopic } from "./ai.types";
import type { GenerateTopicsInput } from "./ai-provider.types";
import {
  generatePlannedTopicsForMonth,
  sliceTopicsForDayRange,
  topicViolatesBlacklist,
} from "../planner/planner-topic-generator";

const topicSchema = z.object({
  proposedTitle: z.string(),
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  searchIntent: z.string(),
  articleType: z.string(),
  brief: z.string(),
});

function isValidTopic(t: unknown): t is GeneratedTopic {
  return topicSchema.safeParse(t).success;
}

/** Per-slot LLM output: null means invalid or missing for that index (keep deterministic slot). */
export function coerceLlmTopicList(raw: unknown[]): (GeneratedTopic | null)[] {
  return raw.map((t) => {
    const r = topicSchema.safeParse(t);
    return r.success ? r.data : null;
  });
}

/**
 * Prefer LLM topics when valid and compliant; otherwise keep deterministic planner slots.
 */
export function mergeTopicsWithPlanner(
  llm: (GeneratedTopic | null)[] | null | undefined,
  input: GenerateTopicsInput
): GeneratedTopic[] {
  const full = generatePlannedTopicsForMonth(input);
  const { year, month, postsPerDay, fromDay, toDay } = input;
  const deterministic =
    fromDay != null && toDay != null
      ? sliceTopicsForDayRange(full, year, month, postsPerDay, fromDay, toDay)
      : full;
  const blacklist = input.website.keywordBlacklist ?? [];
  if (!llm?.length) return deterministic;

  return deterministic.map((det, i) => {
    const t = llm[i];
    if (t && isValidTopic(t) && !topicViolatesBlacklist(t, blacklist)) return t;
    return det;
  });
}
