import { Request, Response } from "express";
import { getSystemMonitorSnapshot } from "../services/SystemAdmin/SystemMonitorService";
import { getEvolutionMonitorSnapshot } from "../services/SystemAdmin/EvolutionMonitorService";

export const show = async (_req: Request, res: Response): Promise<void> => {
  const snapshot = await getSystemMonitorSnapshot();
  res.json(snapshot);
};

export const evolution = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const snapshot = await getEvolutionMonitorSnapshot();
  res.set("Cache-Control", "no-store");
  res.json(snapshot);
};
