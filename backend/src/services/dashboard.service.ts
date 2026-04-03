import { prisma } from "../lib/prisma";

export async function getDashboardSummary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const [
    totalWebsites,
    topicsThisMonth,
    approvedTopics,
    articleDrafts,
    readyToPublish,
    monthTopics,
  ] = await Promise.all([
    prisma.website.count(),
    prisma.plannedTopic.count({
      where: { recommendedPublishDate: { gte: start, lte: end } },
    }),
    prisma.plannedTopic.count({ where: { status: "approved_topic" } }),
    prisma.plannedTopic.count({ where: { status: "article_draft" } }),
    prisma.plannedTopic.count({ where: { status: "ready_for_publish" } }),
    prisma.plannedTopic.findMany({
      where: { recommendedPublishDate: { gte: start, lte: end } },
      select: { monthlyPlan: { select: { websiteId: true, website: { select: { name: true, domain: true } } } } },
    }),
  ]);

  const postsByWebsite = new Map<string, { name: string; domain: string; count: number }>();
  for (const t of monthTopics) {
    const wid = t.monthlyPlan.websiteId;
    const cur = postsByWebsite.get(wid);
    if (cur) cur.count += 1;
    else
      postsByWebsite.set(wid, {
        name: t.monthlyPlan.website.name,
        domain: t.monthlyPlan.website.domain,
        count: 1,
      });
  }

  const upcoming = await prisma.plannedTopic.findMany({
    where: {
      recommendedPublishDate: {
        gte: now,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { recommendedPublishDate: "asc" },
    take: 20,
    include: {
      monthlyPlan: { select: { website: { select: { name: true, id: true } } } },
    },
  });

  const websites = await prisma.website.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, domain: true },
  });

  return {
    totalWebsites,
    plannedTopicsThisMonth: topicsThisMonth,
    approvedTopics,
    articleDrafts,
    readyToPublish,
    websites: websites.map((w) => ({
      ...w,
      plannedPostsThisMonth: postsByWebsite.get(w.id)?.count ?? 0,
    })),
    postsPerWebsite: Array.from(postsByWebsite.entries()).map(([websiteId, v]) => ({
      websiteId,
      name: v.name,
      domain: v.domain,
      postsThisMonth: v.count,
    })),
    upcomingSchedule: upcoming.map((t) => ({
      id: t.id,
      title: t.proposedTitle,
      date: t.recommendedPublishDate,
      status: t.status,
      websiteName: t.monthlyPlan.website.name,
      websiteId: t.monthlyPlan.website.id,
    })),
  };
}
