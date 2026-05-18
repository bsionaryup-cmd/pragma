import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  /** URL pública (ngrok / producción). Alternativa a NEXT_PUBLIC_APP_URL. */
  APP_URL: z.string().url().optional(),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});
