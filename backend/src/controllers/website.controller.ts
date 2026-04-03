import type { Request, Response } from "express";
import { parseBody } from "../lib/validateRequest";
import {
  websiteCreateSchema,
  websiteDuplicateSchema,
  websiteUpdateSchema,
  wordpressTestSchema,
} from "../validation/website.schema";
import { routeParam } from "../utils/routeParam";
import * as websiteService from "../services/website.service";
import * as wordpressService from "../services/wordpress.service";

export async function listWebsites(_req: Request, res: Response) {
  const items = await websiteService.listWebsites();
  res.json({ items: items.map(websiteService.sanitizeWebsiteForClient) });
}

export async function getWebsite(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const website = await websiteService.getWebsiteById(id);
  res.json({ website: websiteService.sanitizeWebsiteForClient(website) });
}

export async function createWebsite(req: Request, res: Response) {
  const body = parseBody(websiteCreateSchema, req.body);
  const website = await websiteService.createWebsite(body);
  res.status(201).json({ website: websiteService.sanitizeWebsiteForClient(website) });
}

export async function updateWebsite(req: Request, res: Response) {
  const body = parseBody(websiteUpdateSchema, req.body);
  const id = routeParam(req.params.id);
  const website = await websiteService.updateWebsite(id, body);
  res.json({ website: websiteService.sanitizeWebsiteForClient(website) });
}

export async function deleteWebsite(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  await websiteService.deleteWebsite(id);
  res.status(204).send();
}

export async function testWebsiteAI(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const result = await websiteService.testWebsiteAIConnection(id, req.user!.id);
  res.json(result);
}

export async function testWordPress(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const body =
    req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
      ? parseBody(wordpressTestSchema, req.body)
      : undefined;
  const result = await wordpressService.testWordPressConnection(id, body);
  res.json(result);
}

export async function listWordpressCategories(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const items = await wordpressService.listWordPressTerms(id, "categories");
  res.json({ items });
}

export async function listWordpressTags(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const items = await wordpressService.listWordPressTerms(id, "tags");
  res.json({ items });
}

export async function duplicateWebsite(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const body =
    req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
      ? parseBody(websiteDuplicateSchema, req.body)
      : {};
  const website = await websiteService.duplicateWebsite(id, body.name);
  res.status(201).json({ website: websiteService.sanitizeWebsiteForClient(website) });
}
