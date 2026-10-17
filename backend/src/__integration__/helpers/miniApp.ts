/**
 * App Express mínimo com routers REAIS e middlewares REAIS (isAuth/isSuper).
 *
 * Não montamos backend/src/app.ts inteiro porque ele importa ./queues (Bull → Redis),
 * Sentry e webhooks Meta/Evolution, que exigem serviços externos. O handler de erro abaixo
 * replica o de app.ts (AppError → status/JSON; demais → 500 ERR_INTERNAL_SERVER_ERROR).
 */
import "express-async-errors";
import express, { NextFunction, Request, Response, Router } from "express";
import { sign } from "jsonwebtoken";
import authConfig from "../../config/auth";
import AppError from "../../errors/AppError";

export function buildApp(routers: Router[]): express.Express {
  const app = express();
  app.use(express.json());
  routers.forEach(r => app.use(r));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {}),
        ...((err.data as any) ?? {})
      });
    }
    // eslint-disable-next-line no-console
    if (process.env.IT_DEBUG === "true") console.error("[it] 500:", err);
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR", detail: String(err?.message || err) });
  });
  return app;
}

/** JWT de acesso assinado com o segredo de TESTE (JWT_SECRET definido pelo harness). */
export function tokenFor(user: { id: number; profile: string; companyId: number | null }): string {
  return sign(
    { id: String(user.id), username: "it", profile: user.profile, companyId: user.companyId },
    authConfig.secret,
    { expiresIn: "15m" }
  );
}
