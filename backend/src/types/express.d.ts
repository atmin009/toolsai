import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: Pick<User, "id" | "email" | "name">;
    }
  }
}

export {};
