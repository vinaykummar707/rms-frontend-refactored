import { z } from "zod";

export const stopSchema = z.object({
  name: z.string().trim().min(1, "Stop name is required"),
  depot_id: z.string().min(1, "Depot is required"),
  organization_id: z.string().min(1, "Organization is required"),
  up_latitude: z.string().nullable().optional(),
  up_longitude: z.string().nullable().optional(),
  down_latitude: z.string().nullable().optional(),
  down_longitude: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export type StopFormValues = z.infer<typeof stopSchema>;

