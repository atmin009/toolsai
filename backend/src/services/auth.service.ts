import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import type { z } from "zod";
import { loginSchema, registerSchema } from "../validation/auth.schema";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export function sanitizeUserForClient(
  user: Pick<User, "id" | "email" | "name" | "openaiApiKey" | "googleApiKey">
) {
  const { openaiApiKey, googleApiKey, ...rest } = user;
  return {
    ...rest,
    hasOpenaiApiKey: !!openaiApiKey?.trim(),
    hasGoogleApiKey: !!googleApiKey?.trim(),
  };
}

export async function registerUser(input: RegisterInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new AppError(409, "Email already registered");

  const password = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password,
      name: input.name,
    },
    select: { id: true, email: true, name: true },
  });

  const token = signToken({ sub: user.id, email: user.email });
  return { user, token };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError(401, "Invalid credentials");

  const ok = await verifyPassword(input.password, user.password);
  if (!ok) throw new AppError(401, "Invalid credentials");

  const token = signToken({ sub: user.id, email: user.email });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}
