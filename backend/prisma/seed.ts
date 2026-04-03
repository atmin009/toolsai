import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@zettaword.local" },
    update: {},
    create: {
      email: "demo@zettaword.local",
      password: passwordHash,
      name: "Demo User",
    },
  });

  await prisma.website.deleteMany({ where: { domain: { in: ["brewpeak.com", "flowmetrics.io"] } } });

  const coffee = await prisma.website.create({
    data: {
      name: "BrewPeak Coffee",
      domain: "brewpeak.com",
      brandName: "BrewPeak",
      niche: "Specialty coffee equipment",
      defaultLanguage: "en",
      targetAudience: "Home baristas and small café owners upgrading grinders and espresso setups.",
      toneOfVoice: "Warm, knowledgeable, never pretentious. Short sentences. Sensory language allowed.",
      seoRules: "Prefer question-style H2s. Mention grinder burr types once per article max. Internal link to buying guides.",
      articleGoals: ["traffic", "education", "conversion"],
      keywordGroups: {
        create: [
          {
            type: "primary",
            label: "Core themes",
            keywords: ["espresso grinder", "burr grinder", "home barista"],
          },
          {
            type: "secondary",
            label: "Supporting",
            keywords: ["grind size", "dialing in", "maintenance"],
          },
        ],
      },
      categories: {
        create: [
          { name: "Gear guides", description: "Hardware reviews and comparisons" },
          { name: "Technique", description: "Brewing tips" },
        ],
      },
    },
  });

  const saas = await prisma.website.create({
    data: {
      name: "FlowMetrics SaaS",
      domain: "flowmetrics.io",
      brandName: "FlowMetrics",
      niche: "Product analytics for SaaS teams",
      defaultLanguage: "en",
      targetAudience: "PMs and growth leads at B2B SaaS companies (50–500 employees).",
      toneOfVoice: "Direct, data-first, confident. Avoid hype. Use concrete examples.",
      seoRules: "Target BOFU comparison keywords. Include ROI framing. CTA to demo or template.",
      articleGoals: ["traffic", "comparison", "branding"],
      keywordGroups: {
        create: [
          {
            type: "primary",
            label: "Core themes",
            keywords: ["product analytics", "activation rate", "retention cohorts"],
          },
          {
            type: "secondary",
            label: "Supporting",
            keywords: ["funnel analysis", "feature adoption", "PLG"],
          },
        ],
      },
      categories: {
        create: [
          { name: "Playbooks", description: "How-to analytics" },
          { name: "Comparisons", description: "Category POVs" },
        ],
      },
    },
  });

  const year = 2026;
  const month = 4;

  const plan = await prisma.monthlyPlan.create({
    data: {
      websiteId: coffee.id,
      year,
      month,
      postsPerDay: 2,
    },
  });

  const day1 = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const day2 = new Date(Date.UTC(year, month - 1, 2, 12, 0, 0));

  const t1 = await prisma.plannedTopic.create({
    data: {
      monthlyPlanId: plan.id,
      proposedTitle: "Best burr grinders for espresso at home in 2026",
      primaryKeyword: "espresso grinder",
      secondaryKeywords: ["flat burr", "conical burr", "dialing in"],
      searchIntent: "commercial",
      articleType: "comparison",
      brief: "Compare 3 price tiers, maintenance tips, and who each tier is for.",
      recommendedPublishDate: day1,
      status: "draft_topic",
      sortOrder: 1,
    },
  });

  const t2 = await prisma.plannedTopic.create({
    data: {
      monthlyPlanId: plan.id,
      proposedTitle: "How to clean your grinder without voiding the warranty",
      primaryKeyword: "grinder maintenance",
      secondaryKeywords: ["burr cleaning", "home barista"],
      searchIntent: "informational",
      articleType: "how-to",
      brief: "Step-by-step with safety notes and tool list.",
      recommendedPublishDate: day1,
      status: "draft_topic",
      sortOrder: 2,
    },
  });

  const t3 = await prisma.plannedTopic.create({
    data: {
      monthlyPlanId: plan.id,
      proposedTitle: "Dialing in: grind size checkpoints for medium roast espresso",
      primaryKeyword: "dialing in espresso",
      secondaryKeywords: ["grind size", "shot time"],
      searchIntent: "informational",
      articleType: "guide",
      brief: "Practical checkpoints, taste cues, and a simple decision tree.",
      recommendedPublishDate: day2,
      status: "approved_topic",
      sortOrder: 3,
    },
  });

  const article = await prisma.article.create({
    data: {
      plannedTopicId: t3.id,
      seoTitle: "Dialing in espresso: grind checkpoints | BrewPeak",
      metaTitle: "Dialing in espresso: grind checkpoints",
      metaDescription: "A practical guide to grind size checkpoints for medium roast espresso—taste cues and shot timing.",
      slug: "dialing-in-espresso-grind-checkpoints",
      focusKeyword: "dialing in espresso",
      secondaryKeywords: ["grind size", "shot time"],
      excerpt: "Use these checkpoints to adjust grind faster without guessing.",
      h1: "Dialing in: grind size checkpoints for medium roast espresso",
      outline: [
        { level: 2, text: "Why medium roast behaves differently" },
        { level: 2, text: "Checkpoint A: shot time window" },
        { level: 3, text: "What to taste when you’re too fine" },
        { level: 2, text: "Checkpoint B: balance and aftertaste" },
      ],
      body: "<h1>Dialing in: grind size checkpoints for medium roast espresso</h1><p>Intro paragraph for demo content.</p>",
      faq: [
        { question: "How fast should a shot run?", answer: "Start near 25–35s for a double, then adjust by taste." },
      ],
      internalLinkIdeas: [{ anchor: "grinder buying guide", note: "Link from cluster pillar page." }],
      suggestedCta: "See BrewPeak’s recommended grinders for medium roasts.",
      schemaSuggestion: "Article + FAQPage JSON-LD",
      imagePrompt: "Close-up of espresso puck prep, soft morning light, no text.",
      tagsSuggestion: ["espresso", "dialing in", "medium roast"],
      categoriesSuggestion: ["Technique", "Gear guides"],
      wpReadyPayload: {
        status: "draft",
        title: "Dialing in: grind size checkpoints for medium roast espresso",
        excerpt: "Practical checkpoints for home baristas.",
        meta: { focus_kw: "dialing in espresso" },
      },
      currentVersion: 1,
    },
  });

  await prisma.plannedTopic.update({
    where: { id: t3.id },
    data: { status: "article_draft" },
  });

  await prisma.articleVersion.create({
    data: {
      articleId: article.id,
      version: 1,
      snapshot: {
        seoTitle: article.seoTitle,
        body: article.body,
        metaTitle: article.metaTitle,
      },
    },
  });

  await prisma.plannedTopic.create({
    data: {
      monthlyPlanId: plan.id,
      proposedTitle: "Flat vs conical burrs: what actually changes in the cup?",
      primaryKeyword: "flat vs conical burr",
      secondaryKeywords: ["espresso", "taste"],
      searchIntent: "informational",
      articleType: "comparison",
      brief: "Honest tradeoffs; avoid absolutes; link to grinder guides.",
      recommendedPublishDate: day2,
      status: "ready_for_publish",
      sortOrder: 4,
    },
  });

  console.log("Seed complete.", { user: user.email, websites: [coffee.domain, saas.domain] });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
