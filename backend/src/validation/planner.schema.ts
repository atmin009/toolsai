import { z } from "zod";

export const plannerGenerateSchema = z
  .object({
    websiteId: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    postsPerDay: z.number().int().min(1).max(20),
    chunk: z
      .object({
        fromDay: z.number().int().min(1).max(31),
        toDay: z.number().int().min(1).max(31),
        resetMonth: z.boolean(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.chunk) return;
    const { fromDay, toDay } = data.chunk;
    if (fromDay > toDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fromDay must be <= toDay",
        path: ["chunk", "fromDay"],
      });
    }
    const dim = new Date(data.year, data.month, 0).getDate();
    if (toDay > dim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `toDay must be <= ${dim} for this month`,
        path: ["chunk", "toDay"],
      });
    }
  });

export const plannerQuerySchema = z.object({
  websiteId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
});
