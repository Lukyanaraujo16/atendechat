import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getSystemMonitorSnapshot } from "../services/SystemAdmin/SystemMonitorService";
import { getEvolutionMonitorSnapshot } from "../services/SystemAdmin/EvolutionMonitorService";
import {
  EvolutionMetricsValidationError,
  HISTORY_RANGES,
  HistoryRange,
  getEvolutionInfraCurrent,
  getEvolutionInfraHistory,
  ingestEvolutionMetrics,
  verifyEvolutionMetricsIngestToken
} from "../services/SystemAdmin/EvolutionInfraMetricsService";

export const show = async (_req: Request, res: Response): Promise<void> => {
  const snapshot = await getSystemMonitorSnapshot();
  res.json(snapshot);
};

export const evolution = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const [snapshot, infra] = await Promise.all([
    getEvolutionMonitorSnapshot(),
    getEvolutionInfraCurrent()
  ]);
  res.set("Cache-Control", "no-store");
  res.json({ ...snapshot, infra });
};

export const evolutionHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const range = String(req.query.range || "24h");
  if (!Object.prototype.hasOwnProperty.call(HISTORY_RANGES, range)) {
    throw new AppError("ERR_INVALID_RANGE", 400);
  }
  const history = await getEvolutionInfraHistory(range as HistoryRange);
  res.set("Cache-Control", "no-store");
  res.json(history);
};

/** Ingestão do coletor: token próprio (Bearer), independente de sessão de usuário. */
export const evolutionMetricsIngest = async (
  req: Request,
  res: Response
): Promise<void> => {
  const match = /^Bearer\s+(\S+)$/i.exec(
    String(req.headers.authorization || "")
  );
  const auth = verifyEvolutionMetricsIngestToken(match ? match[1] : null);
  if (auth === "not_configured") {
    throw new AppError("ERR_EVOLUTION_METRICS_INGEST_DISABLED", 503);
  }
  if (auth !== "ok") {
    throw new AppError("ERR_EVOLUTION_METRICS_UNAUTHORIZED", 401);
  }
  try {
    const result = await ingestEvolutionMetrics(req.body);
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof EvolutionMetricsValidationError) {
      res
        .status(400)
        .json({ error: "ERR_EVOLUTION_METRICS_INVALID", detail: err.message });
      return;
    }
    throw err;
  }
};
