import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as articles from "../controllers/article.controller";

export const articleRouter = Router();

articleRouter.use(requireAuth);

articleRouter.get("/", asyncHandler(articles.listArticles));
articleRouter.post("/generate/:topicId", asyncHandler(articles.generateArticle));
articleRouter.post("/bulk-generate", asyncHandler(articles.bulkGenerateArticles));
articleRouter.get("/:id/export", asyncHandler(articles.exportArticle));
articleRouter.get("/:id/score", asyncHandler(articles.scoreArticle));
articleRouter.get("/:id/versions", asyncHandler(articles.listArticleVersions));
articleRouter.post("/:id/improve", asyncHandler(articles.improveArticle));
articleRouter.post("/:id/seo-fields", asyncHandler(articles.generateSEOFields));
articleRouter.post("/:id/publish-wordpress", asyncHandler(articles.publishArticleWordpress));
articleRouter.patch("/:id", asyncHandler(articles.updateArticle));
articleRouter.get("/:id", asyncHandler(articles.getArticle));
