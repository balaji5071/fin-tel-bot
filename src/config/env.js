import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required in .env'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required in .env'),
  SUPER_ADMIN_IDS: z
    .string()
    .optional()
    .default('')
    .transform((val) => val.split(',').map((id) => id.trim()).filter((id) => id.length > 0)),
  ADMIN_IDS: z
    .string()
    .optional()
    .default('')
    .transform((val) => val.split(',').map((id) => id.trim()).filter((id) => id.length > 0)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required for conversational AI bot'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const config = parseEnv();
