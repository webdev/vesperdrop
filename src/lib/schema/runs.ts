import { z } from "zod";

export const RunCreateSchema = z.object({
  presetIds: z.array(z.string().min(1)).min(1).max(20),
});

export type RunCreate = z.infer<typeof RunCreateSchema>;
