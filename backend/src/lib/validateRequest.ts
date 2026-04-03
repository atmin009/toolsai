import type { z } from "zod";
import { AppError } from "../errors/AppError";

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, "Validation error", result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, "Validation error", result.error.flatten());
  }
  return result.data;
}
