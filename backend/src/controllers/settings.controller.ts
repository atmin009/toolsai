import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { parseBody } from "../lib/validateRequest";
import { settingsUpdateSchema } from "../validation/settings.schema";

export async function getSettings(req: Request, res: Response) {
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { openaiApiKey: true, googleApiKey: true, claudeApiKey: true, deepseekApiKey: true },
  });
  res.json({
    appName: "Zettaword",
    features: {},
    hasOpenaiApiKey: !!u?.openaiApiKey?.trim(),
    hasGoogleApiKey: !!u?.googleApiKey?.trim(),
    hasClaudeApiKey: !!u?.claudeApiKey?.trim(),
    hasDeepseekApiKey: !!u?.deepseekApiKey?.trim(),
  });
}

export async function patchSettings(req: Request, res: Response) {
  const body = parseBody(settingsUpdateSchema, req.body);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(body.openaiApiKey !== undefined && { openaiApiKey: body.openaiApiKey }),
      ...(body.googleApiKey !== undefined && { googleApiKey: body.googleApiKey }),
      ...(body.claudeApiKey !== undefined && { claudeApiKey: body.claudeApiKey }),
      ...(body.deepseekApiKey !== undefined && { deepseekApiKey: body.deepseekApiKey }),
    },
  });
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { openaiApiKey: true, googleApiKey: true, claudeApiKey: true, deepseekApiKey: true },
  });
  res.json({
    hasOpenaiApiKey: !!u?.openaiApiKey?.trim(),
    hasGoogleApiKey: !!u?.googleApiKey?.trim(),
    hasClaudeApiKey: !!u?.claudeApiKey?.trim(),
    hasDeepseekApiKey: !!u?.deepseekApiKey?.trim(),
  });
}
