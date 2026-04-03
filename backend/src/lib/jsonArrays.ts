import type { Prisma } from "@prisma/client";

/** MySQL stores string lists as JSON; normalize for app use. */
export function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((x) => String(x));
  return [];
}
