/**
 * Centralized environment configuration.
 * Bun automatically loads `.env` files — do not add dotenv.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 3000),

  mongoUri: required(
    "MONGODB_URI",
    "mongodb://localhost:27017/merb-starterpack",
  ),

  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  jwt: {
    accessSecret: required(
      "JWT_ACCESS_SECRET",
      "dev-access-secret-change-me",
    ),
    refreshSecret: required(
      "JWT_REFRESH_SECRET",
      "dev-refresh-secret-change-me",
    ),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresInDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7),
  },

  mail: {
    /** SMTP connection string, e.g. smtp://user:pass@smtp.example.com:587 */
    smtpUrl: process.env.SMTP_URL ?? "",
    from: process.env.MAIL_FROM ?? "no-reply@example.com",
  },

  seed: {
    enabled: process.env.SEED_ON_START === "true",
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
  },
} as const;
