import { z } from "zod";

export const depotSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Depot name must be between 2 and 50 characters")
    .max(50, "Depot name must be between 2 and 50 characters"),
  region_id: z.string().min(1, "Operational region is required"),
  organization_id: z.string().min(1, "Organization is required"),
});

export type DepotFormValues = z.infer<typeof depotSchema>;

