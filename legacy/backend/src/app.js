import cors from "cors";
import express from "express";
import { notFoundHandler, errorHandler } from "./middleware/errors.js";
import { apiRouter } from "./routes/api.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
