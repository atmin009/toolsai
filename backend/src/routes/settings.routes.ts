import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as settings from "../controllers/settings.controller";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get("/", asyncHandler(settings.getSettings));
settingsRouter.patch("/", asyncHandler(settings.patchSettings));
