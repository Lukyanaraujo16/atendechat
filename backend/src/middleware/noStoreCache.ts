import { Request, Response, NextFunction } from "express";

/**
 * Rotas dinâmicas (tickets, mensagens, etc.) não devem ser cacheadas pelo navegador/proxy.
 * Evita 304 Not Modified com corpo vazio quebrando listagens no frontend.
 */
export default function noStoreCache(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("ETag", "false");
  next();
}
