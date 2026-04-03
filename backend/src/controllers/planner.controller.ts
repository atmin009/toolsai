import type { Request, Response } from "express";
import { parseBody, parseQuery } from "../lib/validateRequest";
import { plannerGenerateSchema, plannerQuerySchema } from "../validation/planner.schema";
import * as plannerService from "../services/planner.service";

export async function generatePlan(req: Request, res: Response) {
  const body = parseBody(plannerGenerateSchema, req.body);
  const result = await plannerService.generateMonthlyPlan(body, req.user!.id);
  res.status(201).json(result);
}

export async function getPlan(req: Request, res: Response) {
  const q = parseQuery(plannerQuerySchema, req.query);
  const result = await plannerService.getMonthlyPlan(q.websiteId, q.year, q.month);
  res.json(result);
}
