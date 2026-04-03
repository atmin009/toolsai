import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as planner from "../controllers/planner.controller";

export const plannerRouter = Router();

plannerRouter.use(requireAuth);

plannerRouter.post("/generate", asyncHandler(planner.generatePlan));
plannerRouter.get("/", asyncHandler(planner.getPlan));
