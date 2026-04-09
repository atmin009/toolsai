import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  DATABASE_URL: required("DATABASE_URL", "mysql://zettaword:zettaword@localhost:3306/zettaword"),
  JWT_SECRET: required("JWT_SECRET", "dev-change-me-in-production"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  /** Public origin for generated cover URLs (no trailing slash). Falls back to http://localhost:{PORT}. */
  PUBLIC_BASE_URL: optional("PUBLIC_BASE_URL"),
  /** If set, `POST /articles/covers/batch` and `POST /articles/:id/cover` accept header `x-cron-secret: <value>`. */
  CRON_SECRET: optional("CRON_SECRET"),
  /** Shown on generated cover images (top-right). */
  COVER_BRAND_NAME: process.env.COVER_BRAND_NAME?.trim() || "FOCUS",
  COVER_BRAND_TAGLINE: process.env.COVER_BRAND_TAGLINE?.trim() || "PROTECT WHAT MATTERS",
  /** Optional path to PNG for top-right logo (default: repo `frontend/public/logo-focus.png`). */
  COVER_LOGO_PATH: optional("COVER_LOGO_PATH"),
  /**
   * `none`    — gradient only (no AI image).
   * `gemini`  — Nano Banana 2 / Gemini 3.1 Flash Image (uses Google API key from account Settings or `GOOGLE_AI_API_KEY`).
   * `openai`  — DALL·E 3 (legacy).
   * If **unset**: defaults to **`gemini`**.
   */
  COVER_IMAGE_SOURCE: ((): "none" | "gemini" | "openai" => {
    const raw = process.env.COVER_IMAGE_SOURCE;
    if (raw === undefined || raw.trim() === "") return "gemini";
    const v = raw.trim().toLowerCase();
    if (v === "none") return "none";
    if (v === "openai") return "openai";
    return "gemini";
  })(),
};
