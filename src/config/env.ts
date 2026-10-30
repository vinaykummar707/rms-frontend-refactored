import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url()
    .default("https://supabase.navitronix.in"),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1)
    .default(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU4MzkzMDAwLCJleHAiOjE5MTYxNTk0MDB9.ndWaEbKzxiLYhEvyBugDAsPFRhMhgi26g0PBk1alXyU"
    ),
  VITE_CONTROLLER_API_URL: z
    .string()
    .url()
    .default("https://api.navitronix.in/navitranix/api"),
  VITE_BITMAP_API_URL: z
    .string()
    .url()
    .default("http://localhost:5288/api/bitmap"),
  VITE_V1_APP_URL: z
    .string()
    .default("http://31.97.228.29:9091"),
  VITE_SARVAM_API_KEY: z
    .string()
    .optional()
    .default(""),
});

export type AppEnvironment = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_CONTROLLER_API_URL: import.meta.env.VITE_CONTROLLER_API_URL,
  VITE_BITMAP_API_URL: import.meta.env.VITE_BITMAP_API_URL,
  VITE_V1_APP_URL: import.meta.env.VITE_V1_APP_URL,
  VITE_SARVAM_API_KEY: import.meta.env.VITE_SARVAM_API_KEY,
});

if (!parsedEnv.success) {
  console.error(
    "Invalid application environment configuration:",
    parsedEnv.error.format()
  );
}

export const env: AppEnvironment = parsedEnv.success
  ? parsedEnv.data
  : envSchema.parse({});

