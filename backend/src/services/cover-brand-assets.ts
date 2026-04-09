import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { env } from "../config/env";
import { coverLog } from "./cover-log";

/**
 * Resolve path to FOCUS logo PNG for Satori. Repo layout: `frontend/public/logo-focus.png`.
 * Override with `COVER_LOGO_PATH` (absolute or relative to `process.cwd()`).
 */
export function resolveCoverLogoPath(): string | null {
  const fromEnv = env.COVER_LOGO_PATH?.trim();
  if (fromEnv) {
    const abs = fromEnv.startsWith("/") || /^[A-Za-z]:\\/.test(fromEnv) ? fromEnv : join(process.cwd(), fromEnv);
    if (existsSync(abs)) return abs;
    coverLog("COVER_LOGO_PATH set but file not found", { path: abs });
  }

  const candidates = [
    join(process.cwd(), "..", "frontend", "public", "logo-focus.png"),
    join(process.cwd(), "frontend", "public", "logo-focus.png"),
    join(process.cwd(), "public", "logo-focus.png"),
    join(process.cwd(), "assets", "logo-focus.png"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function loadCoverLogoDataUrl(): Promise<string | null> {
  const p = resolveCoverLogoPath();
  if (!p) {
    coverLog("cover logo: no logo-focus.png found (optional COVER_LOGO_PATH or frontend/public/logo-focus.png)");
    return null;
  }
  const buf = await readFile(p);
  coverLog("cover logo loaded", { path: p, bytes: buf.length });
  return `data:image/png;base64,${buf.toString("base64")}`;
}
