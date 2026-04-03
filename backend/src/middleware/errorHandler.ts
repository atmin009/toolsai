import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

export { AppError };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }
  console.error(err);
  const body: { error: string; message?: string } = { error: "Internal server error" };
  if (env.NODE_ENV !== "production" && err instanceof Error) {
    body.message = err.message;
  }
  return res.status(500).json(body);
}
