import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as auth from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(auth.register));
authRouter.post("/login", asyncHandler(auth.login));
authRouter.get("/me", requireAuth, asyncHandler(auth.me));
