import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET должен быть не короче 16 символов"),
  APP_BASE_URL: z.string().url().default("http://127.0.0.1:5173"),
  YOOKASSA_SHOP_ID: z.string().trim().optional(),
  YOOKASSA_SECRET_KEY: z.string().trim().optional(),
  YOOKASSA_RETURN_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
