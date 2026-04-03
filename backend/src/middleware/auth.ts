import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { verifyToken } from "../utils/jwt";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
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
