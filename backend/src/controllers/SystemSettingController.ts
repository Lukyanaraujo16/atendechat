import path from "path";
import fs from "fs";
import { Request, Response } from "express";

import uploadConfig from "../config/upload";
import GetPublicBrandingService, {
  PublicBranding
} from "../services/SystemSettingService/GetPublicBrandingService";
import UpsertBrandingService from "../services/SystemSettingService/UpsertBrandingService";
import SystemSetting from "../models/SystemSetting";

function unlinkPublicAsset(publicPath: string): void {
  if (!publicPath?.startsWith("/public/")) return;
  const rel = publicPath.replace(/^\/public\/?/, "");
  const abs = path.join(uploadConfig.directory, rel);
  const root = path.resolve(uploadConfig.directory);
  if (!abs.startsWith(root)) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}

export const publicBranding = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const branding = await GetPublicBrandingService();
  return res.json(branding);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const rows = await SystemSetting.findAll({ order: [["key", "ASC"]] });
  const settings: Record<string, string> = {};
  rows.forEach((r) => {
    settings[r.key] = r.value ?? "";
  });
  const branding = await GetPublicBrandingService();
  return res.json({ settings, branding });
};

export const upsert = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as { branding?: Partial<PublicBranding> };
  if (body.branding && typeof body.branding === "object") {
    await UpsertBrandingService(body.branding);
  }
  const branding = await GetPublicBrandingService();
  return res.json(branding);
};

export const updateBrandingMultipart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const files = req.files as
    | { [field: string]: Express.Multer.File[] }
    | undefined;

  const systemNameRaw = req.body?.systemName;
  const systemName =
    typeof systemNameRaw === "string" ? systemNameRaw.trim() : undefined;

  const partial: Partial<PublicBranding> = {};

  if (systemName !== undefined) {
    partial.systemName = systemName;
  }

  const login = files?.loginLogo?.[0];
  const menu = files?.menuLogo?.[0];

  const before = await GetPublicBrandingService();

  if (login) {
    if (before.loginLogoUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.loginLogoUrl);
    }
    partial.loginLogoUrl = `/public/branding/${login.filename}`;
  }
  if (menu) {
    if (before.menuLogoUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.menuLogoUrl);
    }
    partial.menuLogoUrl = `/public/branding/${menu.filename}`;
  }

  if (Object.keys(partial).length === 0) {
    return res.status(400).json({ error: "NOTHING_TO_UPDATE" });
  }

  await UpsertBrandingService(partial);
  const branding = await GetPublicBrandingService();
  return res.json(branding);
};
