import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { parseBody } from "../lib/validateRequest";
import { registerSchema, loginSchema } from "../validation/auth.schema";
import * as authService from "../services/auth.service";

export async function register(req: Request, res: Response) {
  const body = parseBody(registerSchema, req.body);
  const result = await authService.registerUser(body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const body = parseBody(loginSchema, req.body);
  const result = await authService.loginUser(body);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ user: authService.sanitizeUserForClient(u) });
}
