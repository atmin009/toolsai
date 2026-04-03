import type { Request, Response } from "express";
import { parseBody } from "../lib/validateRequest";
import { bulkIdsSchema, manualTopicCreateSchema, topicUpdateSchema } from "../validation/topic.schema";
import { routeParam } from "../utils/routeParam";
import * as topicService from "../services/topic.service";

export async function listTopics(req: Request, res: Response) {
  const websiteId = req.query.websiteId ? String(req.query.websiteId) : undefined;
  const monthlyPlanId = req.query.monthlyPlanId ? String(req.query.monthlyPlanId) : undefined;
  const status = topicService.parseTopicStatusQuery(
    req.query.status ? String(req.query.status) : undefined
  );
  const source = topicService.parseTopicSourceQuery(req.query.source ? String(req.query.source) : undefined);
  const q = req.query.q ? String(req.query.q) : undefined;
  const sortBy = req.query.sortBy
    ? (String(req.query.sortBy) as "date" | "title" | "status" | "updated")
    : undefined;
  const order = req.query.order ? (String(req.query.order) as "asc" | "desc") : undefined;

  const items = await topicService.listTopics({
    websiteId,
    monthlyPlanId,
    status,
    source,
    q,
    sortBy,
    order,
  });
  res.json({ items });
}

export async function createManualTopic(req: Request, res: Response) {
  const body = parseBody(manualTopicCreateSchema, req.body);
  const topic = await topicService.createManualTopic(body);
  res.status(201).json({ topic });
}

export async function getTopic(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const topic = await topicService.getTopicById(id);
  res.json({ topic });
}

export async function updateTopic(req: Request, res: Response) {
  const body = parseBody(topicUpdateSchema, req.body);
  const id = routeParam(req.params.id);
  const topic = await topicService.updateTopic(id, body);
  res.json({ topic });
}

export async function approveTopic(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const topic = await topicService.approveTopic(id);
  res.json({ topic });
}

export async function rejectTopic(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  await topicService.rejectTopic(id);
  res.status(204).send();
}

export async function regenerateTopic(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const topic = await topicService.regenerateTopic(id, req.user!.id);
  res.json({ topic });
}

export async function bulkApprove(req: Request, res: Response) {
  const body = parseBody(bulkIdsSchema, req.body);
  const items = await topicService.bulkApproveTopicIds(body.ids);
  res.json({ items });
}

export async function bulkRegenerate(req: Request, res: Response) {
  const body = parseBody(bulkIdsSchema, req.body);
  const items = await topicService.bulkRegenerateTopicIds(body.ids, req.user!.id);
  res.json({ items });
}

export async function bulkDelete(req: Request, res: Response) {
  const body = parseBody(bulkIdsSchema, req.body);
  await topicService.bulkDeleteTopicIds(body.ids);
  res.status(204).send();
}
