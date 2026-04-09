import path from "path";
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

/**
 * Application factory — mount middleware and API routes once.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "zettaword-api" });
  });

  app.use("/covers", express.static(path.join(process.cwd(), "public", "covers")));

  app.use("/api", apiRouter);

  app.use(errorHandler);

  return app;
}
