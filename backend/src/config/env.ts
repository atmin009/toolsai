import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  DATABASE_URL: required("DATABASE_URL", "mysql://zettaword:zettaword@localhost:3306/zettaword"),
  JWT_SECRET: required("JWT_SECRET", "dev-change-me-in-production"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
};
