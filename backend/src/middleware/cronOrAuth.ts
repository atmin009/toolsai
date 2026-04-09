import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../utils/jwt";

/**
 * Allows either a valid JWT (same as requireAuth) or `x-cron-secret` when `CRON_SECRET` is set.
 * Use for endpoints invoked by schedulers without a user session.
 */
export async function requireCronOrAuth(req: Request, _res: Response, next: NextFunction) {
  const cronSecret = env.CRON_SECRET?.trim();
  const header = req.headers["x-cron-secret"];
  const provided = typeof header === "string" ? header.trim() : Array.isArray(header) ? header[0]?.trim() : undefined;

  if (cronSecret && provided === cronSecret) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return next(new AppError(401, "Unauthorized"));

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    if (!user) return next(new AppError(401, "Unauthorized"));
    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    next(new AppError(401, "Unauthorized"));
  }
}
