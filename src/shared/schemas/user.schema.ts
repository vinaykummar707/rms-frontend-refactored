import { z } from "zod";

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const userLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter email address")
    .regex(EMAIL_REGEX, "Invalid email address"),
  password: z.string().min(1, "Enter password"),
  rememberMe: z.boolean().default(true),
});

export type UserLoginFormValues = z.infer<typeof userLoginSchema>;

export const userCreationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .regex(EMAIL_REGEX, "Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      PASSWORD_REGEX,
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character"
    ),
  role_id: z.string().min(1, "Role is required"),
  organization_id: z.string().nullable().optional(),
  region_id: z.string().nullable().optional(),
  depot_id: z.string().nullable().optional(),
  active: z.boolean().default(true),
  customer_type: z.enum(["regular", "stu"]).default("stu"),
  v1_routes: z.boolean().default(false),
  v2_routes: z.boolean().default(true),
});

export type UserCreationFormValues = z.infer<typeof userCreationSchema>;

