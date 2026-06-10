import { Request, Response } from "express";
import { getSystemMonitorSnapshot } from "../services/SystemAdmin/SystemMonitorService";

export const show = async (_req: Request, res: Response): Promise<void> => {
  const snapshot = await getSystemMonitorSnapshot();
  res.json(snapshot);
};
