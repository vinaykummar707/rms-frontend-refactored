import { z } from "zod";

export const regionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Region name must be between 2 and 50 characters")
    .max(50, "Region name must be between 2 and 50 characters"),
  organization_id: z.string().min(1, "Organization is required"),
});

export type RegionFormValues = z.infer<typeof regionSchema>;

