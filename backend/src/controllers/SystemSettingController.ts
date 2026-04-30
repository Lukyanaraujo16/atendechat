import path from "path";
import fs from "fs";
import { Request, Response } from "express";

import uploadConfig from "../config/upload";
import { FAVICON_MAX_BYTES } from "../config/brandingUpload";
import GetPublicBrandingService, {
  PublicBranding
} from "../services/SystemSettingService/GetPublicBrandingService";
import UpsertBrandingService from "../services/SystemSettingService/UpsertBrandingService";
import SystemSetting from "../models/SystemSetting";
import GetSystemBillingSettingsService from "../services/SystemSettingService/GetSystemBillingSettingsService";
import UpsertSystemBillingSettingsService, {
  UpsertSystemBillingSettingsInput
} from "../services/SystemSettingService/UpsertSystemBillingSettingsService";
import GetPublicPushConfigService from "../services/SystemSettingService/GetPublicPushConfigService";
import UpsertOneSignalSettingsService from "../services/SystemSettingService/UpsertOneSignalSettingsService";
import GetSmtpSettingsService from "../services/SystemSettingService/GetSmtpSettingsService";
import UpsertSmtpSettingsService, {
  UpsertSmtpSettingsInput
} from "../services/SystemSettingService/UpsertSmtpSettingsService";
import SendSmtpTestEmailService from "../services/SystemSettingService/SendSmtpTestEmailService";
import { SMTP_SETTING_KEYS } from "../services/SystemSettingService/smtpSettingKeys";

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

/** Configuração pública para o cliente Web (sem segredos). */
export const publicPushConfig = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const config = await GetPublicPushConfigService();
  return res.status(200).json(config);
};

/**
 * Script executado antes do bundle React: define window.__BOOTSTRAP_BRANDING__, título, favicon
 * e preload das imagens de branding a partir da BD (primeiro paint alinhado à plataforma).
 */
export const publicBrandingBootstrapScript = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const branding = await GetPublicBrandingService();
  const backendUrl =
    process.env.BACKEND_URL ||
    `http://127.0.0.1:${process.env.PORT || "8080"}`;
  let apiOrigin: string;
  try {
    apiOrigin = new URL(backendUrl).origin;
  } catch {
    apiOrigin = "http://127.0.0.1:8080";
  }
  const payload = JSON.stringify(branding);
  const originJson = JSON.stringify(apiOrigin);
  const js = `!function(){"use strict";var b=${payload},o=${originJson};window.__BOOTSTRAP_BRANDING__=b;function abs(u){if(!u)return"";if(/^https?:\\/\\//i.test(u))return u;var x=o.replace(/\\/$/,"");return x+(u.charAt(0)==="/"?u:"/"+u)}function applyTitle(){var t=String(b.systemName||"").trim();if(t){document.title=t;["apple-mobile-web-app-title","application-name"].forEach(function(n){var m=document.querySelector('meta[name="'+n+'"]');if(m)m.setAttribute("content",t)})}}function applyFavicon(){var raw=String(b.faviconUrl||"").trim();if(!raw)return;var fav=abs(raw);var rev=String(b.assetRevision!=null?b.assetRevision:"0");document.querySelectorAll('link[rel="mask-icon"],link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"]').forEach(function(e){e.remove()});var pure=fav.split("?")[0].toLowerCase(),ty=pure.endsWith(".svg")?"image/svg+xml":pure.endsWith(".png")?"image/png":pure.endsWith(".ico")?"image/x-icon":(pure.endsWith(".jpg")||pure.endsWith(".jpeg"))?"image/jpeg":"";var sep=fav.indexOf("?")>=0?"&":"?";var href=fav+sep+"v="+encodeURIComponent(rev);["icon","shortcut icon","apple-touch-icon"].forEach(function(r){var e=document.createElement("link");e.setAttribute("rel",r);e.setAttribute("href",href);if(ty&&r==="icon")e.setAttribute("type",ty);document.head.appendChild(e)})}function preloadLogos(){var S={},P=function(u){var h=abs(u);if(!h||S[h])return;S[h]=1;var p=document.createElement("link");p.rel="preload";p.as="image";p.href=h;document.head.appendChild(p)};[b.loginLogoUrl,b.loginLogoDarkUrl,b.menuLogoUrl,b.menuLogoDarkUrl].forEach(P)}applyTitle();applyFavicon();preloadLogos();document.addEventListener("DOMContentLoaded",function(){applyTitle();applyFavicon();});}();`;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=120");
  return res.status(200).send(js);
};

export const getBillingAutomation = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const billing = await GetSystemBillingSettingsService();
  return res.json(billing);
};

export const upsertBillingAutomation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const body = req.body as Record<string, unknown>;
  const partial: UpsertSystemBillingSettingsInput = {};

  if (body.daysBeforeDueWarning !== undefined) {
    partial.daysBeforeDueWarning = Number(body.daysBeforeDueWarning);
  }
  if (body.daysAfterDueWarning !== undefined) {
    partial.daysAfterDueWarning = Number(body.daysAfterDueWarning);
  }
  if (body.daysAfterDueBlock !== undefined) {
    partial.daysAfterDueBlock = Number(body.daysAfterDueBlock);
  }
  if (body.enableAutoBlock !== undefined) {
    partial.enableAutoBlock = Boolean(body.enableAutoBlock);
  }
  if (body.enableAutoWarning !== undefined) {
    partial.enableAutoWarning = Boolean(body.enableAutoWarning);
  }
  if (body.enableAutoWhatsAppWarning !== undefined) {
    partial.enableAutoWhatsAppWarning = Boolean(body.enableAutoWhatsAppWarning);
  }
  if (body.whatsappSenderCompanyId !== undefined) {
    partial.whatsappSenderCompanyId = Number(body.whatsappSenderCompanyId);
  }

  const billing = await UpsertSystemBillingSettingsService(partial);
  return res.json(billing);
};

export const getSmtpSettings = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const smtp = await GetSmtpSettingsService();
  return res.json(smtp);
};

export const upsertSmtpSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const body = req.body as Record<string, unknown>;
  const partial: UpsertSmtpSettingsInput = {};

  if (body.enabled !== undefined) {
    partial.enabled = Boolean(body.enabled);
  }
  if (body.host !== undefined) {
    partial.host = String(body.host ?? "");
  }
  if (body.port !== undefined) {
    partial.port = Number(body.port);
  }
  if (body.user !== undefined) {
    partial.user = String(body.user ?? "");
  }
  if (body.clearPassword === true) {
    partial.clearPassword = true;
  } else if (body.password !== undefined && body.password !== null) {
    const p = String(body.password);
    if (p.length > 0) {
      partial.password = p;
    }
  }
  if (body.fromName !== undefined) {
    partial.fromName = String(body.fromName ?? "");
  }
  if (body.fromEmail !== undefined) {
    partial.fromEmail = String(body.fromEmail ?? "");
  }
  if (body.secure !== undefined) {
    partial.secure = Boolean(body.secure);
  }
  if (body.requireTls !== undefined) {
    partial.requireTls = Boolean(body.requireTls);
  }
  if (body.replyTo !== undefined) {
    partial.replyTo =
      body.replyTo == null || body.replyTo === ""
        ? ""
        : String(body.replyTo);
  }

  const smtp = await UpsertSmtpSettingsService(partial);
  return res.json(smtp);
};

export const postSmtpTestEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const to = String(req.body?.to ?? "").trim();
  await SendSmtpTestEmailService(to);
  return res.status(200).json({ ok: true, code: "SMTP_TEST_SENT" });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const rows = await SystemSetting.findAll({ order: [["key", "ASC"]] });
  const settings: Record<string, string> = {};
  rows.forEach((r) => {
    if (r.key === SMTP_SETTING_KEYS.password) return;
    settings[r.key] = r.value ?? "";
  });
  const branding = await GetPublicBrandingService();
  return res.json({ settings, branding });
};

export const upsert = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as {
    branding?: Partial<PublicBranding>;
    onesignal?: {
      appId?: string;
      restApiKey?: string | null;
      enabled?: boolean;
      environment?: "production" | "development";
    };
  };
  if (body.branding && typeof body.branding === "object") {
    await UpsertBrandingService(body.branding);
  }
  if (body.onesignal && typeof body.onesignal === "object") {
    await UpsertOneSignalSettingsService({
      appId: body.onesignal.appId,
      restApiKey: body.onesignal.restApiKey,
      enabled: body.onesignal.enabled,
      environment: body.onesignal.environment
    });
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

  const publicWhatsAppNumberRaw = req.body?.publicWhatsAppNumber;
  const publicWhatsAppMessageRaw = req.body?.publicWhatsAppMessage;
  if (publicWhatsAppNumberRaw !== undefined) {
    partial.publicWhatsAppNumber =
      typeof publicWhatsAppNumberRaw === "string"
        ? publicWhatsAppNumberRaw.replace(/\D/g, "")
        : "";
  }
  if (publicWhatsAppMessageRaw !== undefined) {
    partial.publicWhatsAppMessage =
      typeof publicWhatsAppMessageRaw === "string"
        ? publicWhatsAppMessageRaw.trim()
        : "";
  }

  const login = files?.loginLogo?.[0];
  const loginDark = files?.loginLogoDark?.[0];
  const menu = files?.menuLogo?.[0];
  const menuDark = files?.menuLogoDark?.[0];
  const favicon = files?.favicon?.[0];

  const before = await GetPublicBrandingService();

  if (login) {
    if (before.loginLogoUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.loginLogoUrl);
    }
    partial.loginLogoUrl = `/public/branding/${login.filename}`;
  }
  if (loginDark) {
    if (before.loginLogoDarkUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.loginLogoDarkUrl);
    }
    partial.loginLogoDarkUrl = `/public/branding/${loginDark.filename}`;
  }
  if (menu) {
    if (before.menuLogoUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.menuLogoUrl);
    }
    partial.menuLogoUrl = `/public/branding/${menu.filename}`;
  }
  if (menuDark) {
    if (before.menuLogoDarkUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.menuLogoDarkUrl);
    }
    partial.menuLogoDarkUrl = `/public/branding/${menuDark.filename}`;
  }
  if (favicon) {
    if (favicon.size > FAVICON_MAX_BYTES) {
      try {
        if (favicon.path && fs.existsSync(favicon.path)) fs.unlinkSync(favicon.path);
      } catch {
        /* ignore */
      }
      return res.status(400).json({
        error: "FAVICON_TOO_LARGE",
        message: "Favicon: tamanho máximo 1 MB."
      });
    }
    if (before.faviconUrl?.startsWith("/public/branding/")) {
      unlinkPublicAsset(before.faviconUrl);
    }
    partial.faviconUrl = `/public/branding/${favicon.filename}`;
  }

  if (Object.keys(partial).length === 0) {
    return res.status(400).json({ error: "NOTHING_TO_UPDATE" });
  }

  await UpsertBrandingService(partial);
  const branding = await GetPublicBrandingService();
  return res.json(branding);
};
