import { z } from "zod";

export const organizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must be between 2 and 100 characters")
      .max(100, "Organization name must be between 2 and 100 characters")
      .regex(
        /^[a-zA-Z0-9\s&.,'_-]+$/,
        "Organization name must contain valid alphanumeric characters"
      )
      .refine(
        (val) => /[a-zA-Z0-9]/.test(val),
        "Organization name must contain alphanumeric characters"
      ),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .regex(
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Invalid email format"
      ),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .regex(
        /^[6-9]\d{9}$/,
        "Phone number must be a valid 10-digit Indian phone number (starts with 6-9)"
      ),
    logo: z.string().optional().or(z.literal("")),
    PIS: z.boolean().default(true),
    PAS: z.boolean().default(true),
    ITMS: z.boolean().default(false),
    v1_routes: z.boolean().default(false),
    v2_routes: z.boolean().default(true),
    active: z.boolean().default(true),
    customer_type: z.enum(["regular", "stu"]).default("stu"),
  })
  .refine((data) => data.PIS || data.PAS || data.ITMS, {
    message: "At least one module must be selected for the organization",
    path: ["PIS"],
  });

export type OrganizationFormValues = z.infer<typeof organizationSchema>;

