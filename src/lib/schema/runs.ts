import { z } from "zod";

export const RunCreateSchema = z.object({
  presetIds: z.array(z.string().min(1)).min(1).max(20),
});

export type RunCreate = z.infer<typeof RunCreateSchema>;

const HttpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "must be http(s) url");

export const TryClaimSchema = z.object({
  source: z
    .object({
      url: HttpUrl.optional(),
      name: z.string().max(200).optional(),
    })
    .optional(),
  generations: z
    .array(
      z.object({
        sceneSlug: z.string().min(1).max(100),
        sceneName: z.string().min(1).max(200),
        outputUrl: HttpUrl,
      }),
    )
    .min(1)
    .max(6),
});

export type TryClaim = z.infer<typeof TryClaimSchema>;
