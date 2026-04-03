import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as websites from "../controllers/website.controller";

export const websiteRouter = Router();

websiteRouter.use(requireAuth);

websiteRouter.get("/", asyncHandler(websites.listWebsites));
websiteRouter.post("/", asyncHandler(websites.createWebsite));
websiteRouter.post("/:id/duplicate", asyncHandler(websites.duplicateWebsite));
websiteRouter.post("/:id/ai-test", asyncHandler(websites.testWebsiteAI));
websiteRouter.post("/:id/wordpress/test", asyncHandler(websites.testWordPress));
websiteRouter.get("/:id/wordpress/categories", asyncHandler(websites.listWordpressCategories));
websiteRouter.get("/:id/wordpress/tags", asyncHandler(websites.listWordpressTags));
websiteRouter.get("/:id", asyncHandler(websites.getWebsite));
websiteRouter.patch("/:id", asyncHandler(websites.updateWebsite));
websiteRouter.delete("/:id", asyncHandler(websites.deleteWebsite));
