import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getSystemMonitorSnapshot } from "../services/SystemAdmin/SystemMonitorService";
import { getEvolutionMonitorSnapshot } from "../services/SystemAdmin/EvolutionMonitorService";
import {
  WHATSAPP_MONITOR_SORT_FIELDS,
  WHATSAPP_MONITOR_STATUSES,
  WhatsappMonitorSortField,
  WhatsappMonitorStatus,
  getWhatsappMonitor
} from "../services/SystemAdmin/WhatsappMonitorService";
import {
  isWhatsAppConnectionProvider,
  WhatsAppConnectionProviderValue
} from "../modules/whatsapp/connectionProvider";
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

/** Central de Monitoramento WhatsApp (Baileys + Evolution), filtros e paginação no servidor. */
export const whatsapp = async (req: Request, res: Response): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const pick = (key: string): string =>
    typeof q[key] === "string" ? (q[key] as string).trim() : "";

  const provider = pick("provider");
  if (provider && !isWhatsAppConnectionProvider(provider)) {
    throw new AppError("ERR_INVALID_PROVIDER", 400);
  }
  const status = pick("status");
  if (
    status &&
    !(WHATSAPP_MONITOR_STATUSES as readonly string[]).includes(status)
  ) {
    throw new AppError("ERR_INVALID_STATUS", 400);
  }
  const sortBy = pick("sortBy") || "company";
  if (!(WHATSAPP_MONITOR_SORT_FIELDS as readonly string[]).includes(sortBy)) {
    throw new AppError("ERR_INVALID_SORT", 400);
  }
  const companyId = pick("companyId");
  if (companyId && !/^\d+$/.test(companyId)) {
    throw new AppError("ERR_INVALID_COMPANY", 400);
  }

  const result = await getWhatsappMonitor({
    provider: (provider || undefined) as WhatsAppConnectionProviderValue,
    status: (status || undefined) as WhatsappMonitorStatus,
    companyId: companyId ? Number(companyId) : undefined,
    search: pick("search").slice(0, 100),
    page: Number(pick("page")) || 1,
    pageSize: Number(pick("pageSize")) || 25,
    sortBy: sortBy as WhatsappMonitorSortField,
    sortDir: pick("sortDir") === "desc" ? "desc" : "asc"
  });
  res.set("Cache-Control", "no-store");
  res.json(result);
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
