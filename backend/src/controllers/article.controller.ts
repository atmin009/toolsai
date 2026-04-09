import type { Request, Response } from "express";
import { parseBody } from "../lib/validateRequest";
import {
  articleUpdateSchema,
  coverBatchSchema,
  improveArticleSchema,
  wordpressPublishSchema,
} from "../validation/article.schema";
import * as coverGeneratorService from "../services/cover-generator.service";
import { routeParam } from "../utils/routeParam";
import * as articleService from "../services/article.service";
import * as wordpressService from "../services/wordpress.service";
import { parseTopicStatusQuery } from "../services/topic.service";
import { bulkIdsSchema } from "../validation/topic.schema";

export async function listArticles(req: Request, res: Response) {
  const websiteId = req.query.websiteId ? String(req.query.websiteId) : undefined;
  const q = req.query.q ? String(req.query.q) : undefined;
  const topicStatus = parseTopicStatusQuery(req.query.status ? String(req.query.status) : undefined);
  const sortBy = req.query.sortBy
    ? (String(req.query.sortBy) as "date" | "updated" | "title")
    : undefined;
  const order = req.query.order ? (String(req.query.order) as "asc" | "desc") : undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const result = await articleService.listArticles({ websiteId, q, topicStatus, sortBy, order, page, limit });
  res.json(result);
}

export async function generateArticle(req: Request, res: Response) {
  const topicId = routeParam(req.params.topicId);
  const article = await articleService.generateArticleForTopic(topicId, req.user!.id);
  res.status(201).json({ article });
}

export async function bulkGenerateArticles(req: Request, res: Response) {
  const body = parseBody(bulkIdsSchema, req.body);
  const items = [];
  for (const topicId of body.ids) {
    try {
      const article = await articleService.generateArticleForTopic(topicId, req.user!.id);
      items.push(article);
    } catch {
      // ignore individual topic errors for bulk operation
    }
  }
  res.status(201).json({ items });
}

export async function getArticle(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const article = await articleService.getArticleById(id);
  res.json({ article: articleService.sanitizeArticleForClient(article) });
}

export async function updateArticle(req: Request, res: Response) {
  const body = parseBody(articleUpdateSchema, req.body);
  const id = routeParam(req.params.id);
  const article = await articleService.updateArticle(id, body);
  res.json({ article });
}

export async function publishArticleWordpress(req: Request, res: Response) {
  const body = parseBody(wordpressPublishSchema, req.body);
  const id = routeParam(req.params.id);
  const wp = await wordpressService.publishArticleToWordpress(id, {
    status: body.status,
    wpCategoryIds: body.wpCategoryIds,
    wpTagIds: body.wpTagIds,
  });
  const article = await articleService.getArticleById(id);
  res.json({ article: articleService.sanitizeArticleForClient(article), wordpress: wp.wordpress });
}

export async function listArticleVersions(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const items = await articleService.listArticleVersions(id);
  res.json({ items });
}

export async function improveArticle(req: Request, res: Response) {
  const body = parseBody(improveArticleSchema, req.body);
  const id = routeParam(req.params.id);
  const article = await articleService.improveArticleBody(id, body.instruction, req.user!.id);
  res.json({ article });
}

export async function generateSEOFields(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const fields = await articleService.generateArticleSEOFields(id, req.user!.id);
  res.json({ fields });
}

export async function exportArticle(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const format = (req.query.format as string) || "html";
  if (!["html", "markdown", "json"].includes(format)) {
    res.status(400).json({ error: "format must be html, markdown, or json" });
    return;
  }
  const result = await articleService.exportArticleDocument(id, format as "html" | "markdown" | "json");
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.send(result.content);
}

export async function scoreArticle(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const checklist = await articleService.getArticleScoreChecklist(id);
  res.json(checklist);
}

/** Batch-generate Open Graph covers for articles missing `coverImageUrl`. */
export async function generateCoverBatch(req: Request, res: Response) {
  const body = parseBody(coverBatchSchema, req.body ?? {});
  const result = await coverGeneratorService.generateMissingCovers({ limit: body.limit, userId: req.user?.id });
  res.json(result);
}

/** Generate a 1200×630 cover for one article. Query `force=1` to replace an existing URL. */
export async function generateArticleCover(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const force = req.query.force === "1" || req.query.force === "true";
  const result = await coverGeneratorService.generateCoverForArticle(id, force, { userId: req.user?.id });
  res.json(result);
}
