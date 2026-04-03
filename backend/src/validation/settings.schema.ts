import { z } from "zod";

export const settingsUpdateSchema = z.object({
  openaiApiKey: z.string().optional().nullable(),
  googleApiKey: z.string().optional().nullable(),
  claudeApiKey: z.string().optional().nullable(),
});
