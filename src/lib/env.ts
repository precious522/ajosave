import { z } from "zod";

const envSchema = z.object({
  // Auth
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),

  // Database & cache
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Stellar
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]),
  STELLAR_AJO_CONTRACT_ID: z.string().min(1),
  STELLAR_SERVER_SECRET_KEY: z.string().min(1),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),

  // Payments
  PAYSTACK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().min(1),

  // SMS
  TERMII_API_KEY: z.string().min(1),
  TERMII_SENDER_ID: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),

  // USDC
  USDC_ISSUER: z.string().min(1),
  USDC_ASSET_CODE: z.string().min(1),

  // Optional
  SENTRY_DSN: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`[env] Missing or invalid environment variables:\n${missing.join("\n")}`);
  }
  return result.data;
}

export const env = validateEnv();
