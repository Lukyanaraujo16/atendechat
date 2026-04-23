import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import * as Sentry from "@sentry/node";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import { logger } from "./utils/logger";
import { messageQueue, sendScheduledMessages } from "./queues";
import bodyParser from 'body-parser';

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

const bodyparser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb' }));

/** Origens CORS: FRONTEND_URL e CORS_EXTRA_ORIGINS (várias separadas por vírgula). Sem barra final. */
function getCorsAllowedOrigins(): string[] {
  const raw = [process.env.FRONTEND_URL || "", process.env.CORS_EXTRA_ORIGINS || ""].join(",");
  const parts = raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set(parts)];
}

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      const allowed = getCorsAllowedOrigins();
      if (!origin) {
        return callback(null, true);
      }
      const normalized = origin.replace(/\/$/, "");
      if (allowed.length === 0) {
        return callback(null, process.env.NODE_ENV !== "production");
      }
      callback(null, allowed.includes(normalized));
    }
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {

  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.clientMessage ? { message: err.clientMessage } : {})
    });
  }

  if (err instanceof multer.MulterError) {
    logger.warn({ multerCode: err.code, field: err.field, msg: err.message });
    const pathStr = req.originalUrl || req.url || "";
    const hint =
      err.code === "LIMIT_UNEXPECTED_FILE" && pathStr.includes("/system-settings/branding")
        ? "Campo de ficheiro não aceite pelo servidor. Reconstrua e reinicie o backend (rotas branding com loginLogoDark/menuLogoDark) ou alinhe o nome do campo ao multer.fields."
        : undefined;
    return res.status(400).json({
      error: err.code,
      message: err.message,
      ...(hint ? { hint } : {})
    });
  }

  logger.error(err);
  const detail =
    err instanceof Error ? err.message : String(err);
  const pathStr = req.originalUrl || req.url || "";
  const exposeDetail =
    pathStr.includes("/platform/backups/execute-restore") ||
    pathStr.includes("/platform/backups/generate");
  return res.status(500).json({
    error: "ERR_INTERNAL_SERVER_ERROR",
    ...(exposeDetail && detail ? { message: detail } : {})
  });
});

export default app;
