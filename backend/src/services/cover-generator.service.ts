/**
 * Open Graph cover images (1200×630) via Satori + resvg-js.
 *
 * Image source (`COVER_IMAGE_SOURCE`):
 *   `gemini`  — Nano Banana 2 / Gemini 3.1 Flash Image (default) — uses Google API key from account Settings.
 *   `openai`  — DALL·E 3 (legacy).
 *   `none`    — gradient only (no AI image).
 *
 * - **HTTP:** `POST /api/articles/covers/batch` and `POST /api/articles/:id/cover`.
 * - **In code:** `await generateCoverForArticle(article.id)`.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { buildScenePrompt, loadCoverIllustration } from "./cover-illustration";
import { loadCoverLogoDataUrl } from "./cover-brand-assets";
import { coverLog } from "./cover-log";
import { sanitizeBrandLatin, sanitizeCoverText, splitCoverTitleThai, truncateGraphemes } from "./cover-thai";

/** @deprecated Use splitCoverTitleThai */
export { splitCoverTitleThai as splitCoverTitle };

const NOTO_PKG = join(process.cwd(), "node_modules", "@fontsource", "noto-sans-thai", "files");

const FONT_THAI = "NotoThai";
const FONT_LATIN = "NotoLatin";
const FONT_FAMILY = `${FONT_THAI}, ${FONT_LATIN}`;

type CreateElementFn = typeof import("react").createElement;

const WIDTH = 1200;
const HEIGHT = 630;

/** Fallback gradient when no AI image is available */
const GRADIENTS = [
  { id: "focus-teal", background: "linear-gradient(180deg, #0a6b62 0%, #004d40 40%, #001f1c 100%)" },
  { id: "focus-deep", background: "linear-gradient(180deg, #065f56 0%, #064e3b 44%, #022c22 100%)" },
  { id: "focus-abyss", background: "linear-gradient(180deg, #0f766e 0%, #115e59 46%, #021a18 100%)" },
  { id: "purple", background: "radial-gradient(circle at 28% 38%, #6d28d9 0%, #2e1065 45%, #0c0518 100%)" },
  { id: "teal", background: "radial-gradient(circle at 30% 36%, #0d9488 0%, #134e4a 46%, #042f2e 100%)" },
  { id: "blue", background: "radial-gradient(circle at 24% 38%, #2563eb 0%, #1e3a8a 48%, #0a0f1a 100%)" },
  { id: "emerald", background: "linear-gradient(180deg, #047857 0%, #064e3b 48%, #011e17 100%)" },
] as const;

let fontsPromise: ReturnType<typeof loadFontsInner> | null = null;

async function loadFontsInner() {
  const thai = await readFile(join(NOTO_PKG, "noto-sans-thai-thai-700-normal.woff"));
  const latin = await readFile(join(NOTO_PKG, "noto-sans-thai-latin-700-normal.woff"));
  return [
    { name: FONT_THAI, data: thai, weight: 700 as const, style: "normal" as const },
    { name: FONT_LATIN, data: latin, weight: 700 as const, style: "normal" as const },
  ];
}

function loadFonts() {
  if (!fontsPromise) fontsPromise = loadFontsInner();
  return fontsPromise;
}

function publicBaseUrl(): string {
  return env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`;
}

function coverPublicUrl(filename: string): string {
  return `${publicBaseUrl().replace(/\/$/, "")}/covers/${filename}`;
}

function hashPick<T>(id: string, items: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length];
}

/* ------------------------------------------------------------------ */
/*  Text overlay element (rendered by Satori as transparent PNG)      */
/* ------------------------------------------------------------------ */

function buildTextOverlay(h: CreateElementFn, opts: {
  line1: string;
  line2?: string;
  brandName: string;
  brandTagline: string;
  logoSrc?: string | null;
  hasBackgroundImage: boolean;
}) {
  const { line1, line2, brandName, brandTagline, logoSrc, hasBackgroundImage } = opts;

  const brandCorner = logoSrc
    ? h(
        "div",
        {
          style: {
            position: "absolute",
            top: 28,
            right: 36,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            color: "#ffffff",
            maxWidth: 280,
          },
        },
        h("img", {
          src: logoSrc,
          width: 200,
          height: 52,
          alt: "",
          style: { objectFit: "contain", objectPosition: "right top" },
        }),
        h(
          "div",
          {
            style: {
              marginTop: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.1,
              opacity: 0.85,
              textAlign: "right",
            },
          },
          brandTagline
        )
      )
    : h(
        "div",
        {
          style: {
            position: "absolute",
            top: 28,
            right: 36,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            color: "#ffffff",
          },
        },
        h("div", { style: { fontSize: 26, fontWeight: 700, letterSpacing: 4, opacity: 0.95 } }, brandName),
        h("div", { style: { marginTop: 4, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, opacity: 0.85 } }, brandTagline)
      );

  const textShadowStrong = "0 2px 24px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)";
  const textShadowMild = "0 2px 20px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.25)";

  return h(
    "div",
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        position: "relative",
        fontFamily: FONT_FAMILY,
      },
    },
    brandCorner,
    hasBackgroundImage
      ? h("div", {
          style: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: Math.round(HEIGHT * 0.48),
            background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)",
          },
        })
      : null,
    h(
      "div",
      {
        style: {
          paddingBottom: 44,
          paddingLeft: 56,
          paddingRight: 56,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          color: "#ffffff",
          position: "relative",
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 38,
            fontWeight: 700,
            lineHeight: 1.22,
            textShadow: hasBackgroundImage ? textShadowStrong : textShadowMild,
          },
        },
        line1
      ),
      line2
        ? h(
            "div",
            {
              style: {
                marginTop: 10,
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.4,
                opacity: 0.92,
                textShadow: hasBackgroundImage ? textShadowStrong : textShadowMild,
              },
            },
            line2
          )
        : null
    )
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback: gradient-only cover (no AI image)                       */
/* ------------------------------------------------------------------ */

function buildGradientCover(h: CreateElementFn, opts: {
  line1: string;
  line2?: string;
  gradient: (typeof GRADIENTS)[number];
  brandName: string;
  brandTagline: string;
  logoSrc?: string | null;
}) {
  const { line1, line2, gradient, brandName, brandTagline, logoSrc } = opts;
  const overlay = buildTextOverlay(h, { line1, line2, brandName, brandTagline, logoSrc, hasBackgroundImage: false });
  return h(
    "div",
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        position: "relative",
        background: gradient.background,
      },
    },
    overlay
  );
}

/* ------------------------------------------------------------------ */
/*  renderCoverPng: two modes — full-bleed AI image or gradient       */
/* ------------------------------------------------------------------ */

export async function renderCoverPng(opts: {
  line1: string;
  line2?: string;
  articleId: string;
  /** Full 1200×630 background image from Banana 2 / DALL·E (data URL). */
  backgroundImageSrc?: string | null;
  gradientSeed?: string;
}): Promise<Buffer> {
  const [{ default: satori }, { Resvg }, { createElement: h }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
    import("react"),
  ]);
  const fonts = await loadFonts();
  const logoSrc = await loadCoverLogoDataUrl();
  const brandName = sanitizeBrandLatin(env.COVER_BRAND_NAME) || "FOCUS";
  const brandTagline = sanitizeBrandLatin(env.COVER_BRAND_TAGLINE) || "PROTECT WHAT MATTERS";
  const line1 = sanitizeCoverText(opts.line1);
  const line2 = opts.line2 ? sanitizeCoverText(opts.line2) : undefined;

  if (opts.backgroundImageSrc) {
    const overlaySvg = await satori(
      buildTextOverlay(h, { line1, line2, brandName, brandTagline, logoSrc, hasBackgroundImage: true }),
      { width: WIDTH, height: HEIGHT, fonts },
    );
    const overlayPng = Buffer.from(new Resvg(overlaySvg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());

    const sharp = (await import("sharp")).default;
    const bgBuf = Buffer.from(opts.backgroundImageSrc.replace(/^data:[^;]+;base64,/, ""), "base64");
    return sharp(bgBuf)
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
      .composite([{ input: overlayPng, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  const gradient = hashPick(`${opts.articleId}|${opts.gradientSeed ?? ""}`, GRADIENTS);
  const element = buildGradientCover(h, { line1, line2, gradient, brandName, brandTagline, logoSrc });
  const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

function coversDir(): string {
  return join(process.cwd(), "public", "covers");
}

export type GenerateCoverResult = {
  articleId: string;
  filename: string;
  coverImageUrl: string;
  skipped?: boolean;
  reason?: string;
  illustration?: "generated" | "off" | "no_key" | "failed";
  imageError?: string;
};

export async function generateCoverForArticle(
  articleId: string,
  force = false,
  options?: { userId?: string | null }
): Promise<GenerateCoverResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      plannedTopic: {
        include: { monthlyPlan: { include: { website: true } } },
      },
    },
  });
  if (!article) throw new AppError(404, "Article not found");

  if (article.coverImageUrl?.trim() && !force) {
    return {
      articleId,
      filename: "",
      coverImageUrl: article.coverImageUrl.trim(),
      skipped: true,
      reason: "Article already has coverImageUrl",
    };
  }

  const user = options?.userId
    ? await prisma.user.findUnique({
        where: { id: options.userId },
        select: { openaiApiKey: true, googleApiKey: true, claudeApiKey: true, deepseekApiKey: true },
      })
    : null;

  const website = article.plannedTopic.monthlyPlan.website;

  const title =
    article.h1?.trim() ||
    article.seoTitle?.trim() ||
    article.plannedTopic.proposedTitle?.trim() ||
    "Untitled";
  const subtitleRaw =
    article.metaDescription?.replace(/\s+/g, " ").trim() ||
    article.focusKeyword?.trim() ||
    article.plannedTopic.primaryKeyword?.trim() ||
    undefined;
  const subtitle = subtitleRaw ? truncateGraphemes(subtitleRaw, 100) : undefined;

  const lines = splitCoverTitleThai(title, 28, 32);
  const line1Raw = lines[0];
  const line2Raw = lines.length > 1 ? lines[1] : subtitle;
  const line1 = sanitizeCoverText(line1Raw);
  const line2 = line2Raw ? sanitizeCoverText(line2Raw) : undefined;

  coverLog("generateCoverForArticle", {
    articleId,
    coverImageSource: env.COVER_IMAGE_SOURCE,
    userId: options?.userId ?? null,
  });

  let backgroundImageSrc: string | null = null;
  let illustration: NonNullable<GenerateCoverResult["illustration"]> = "off";
  let imageError: string | undefined;

  if (env.COVER_IMAGE_SOURCE !== "none") {
    const enQuery = await buildScenePrompt({
      proposedTitle: article.plannedTopic.proposedTitle,
      focusKeyword: article.focusKeyword,
      imagePrompt: article.imagePrompt,
      niche: website.niche,
      website,
      user,
    });
    coverLog("scene prompt ready", { promptLen: enQuery.length, promptPreview: enQuery.slice(0, 120) });

    const ill = await loadCoverIllustration({ querySeed: enQuery, website, user });
    backgroundImageSrc = ill.dataUrl;
    coverLog("illustration finished", {
      status: ill.status,
      hasDataUrl: !!ill.dataUrl,
      dataUrlChars: ill.dataUrl?.length ?? 0,
      error: ill.errorMessage,
    });
    if (ill.status === "ok") illustration = "generated";
    else if (ill.status === "no_key") illustration = "no_key";
    else if (ill.status === "error") {
      illustration = "failed";
      imageError = ill.errorMessage;
    }
  } else {
    coverLog("skip AI image (COVER_IMAGE_SOURCE=none)");
  }

  const png = await renderCoverPng({
    line1,
    line2,
    articleId,
    backgroundImageSrc,
    gradientSeed: articleId,
  });

  const dir = coversDir();
  await mkdir(dir, { recursive: true });
  const filename = `cover-${articleId}.png`;
  const filePath = join(dir, filename);
  await writeFile(filePath, png);

  const coverImageUrl = coverPublicUrl(filename);
  await prisma.article.update({
    where: { id: articleId },
    data: { coverImageUrl },
  });

  return {
    articleId,
    filename,
    coverImageUrl,
    illustration,
    ...(imageError ? { imageError } : {}),
  };
}

export type BatchGenerateCoversResult = {
  processed: number;
  results: GenerateCoverResult[];
};

export async function generateMissingCovers(options?: {
  limit?: number;
  userId?: string | null;
}): Promise<BatchGenerateCoversResult> {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const rows = await prisma.article.findMany({
    where: { OR: [{ coverImageUrl: null }, { coverImageUrl: "" }] },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const results: GenerateCoverResult[] = [];
  for (const row of rows) {
    try {
      const r = await generateCoverForArticle(row.id, false, { userId: options?.userId });
      results.push(r);
    } catch (e) {
      results.push({
        articleId: row.id,
        filename: "",
        coverImageUrl: "",
        skipped: true,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { processed: results.length, results };
}
