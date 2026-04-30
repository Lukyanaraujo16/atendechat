import SystemSetting from "../../models/SystemSetting";
import { SMTP_SETTING_KEYS } from "../SystemSettingService/smtpSettingKeys";

export type ResolvedSmtpSendConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromAddress: string;
  replyTo?: string;
  secure: boolean;
  requireTls: boolean;
  source: "database" | "environment";
};

function parseBool(v: string | undefined, defaultVal = false): boolean {
  if (v == null || v === "") return defaultVal;
  return v === "true" || v === "1";
}

function buildFromAddress(fromName: string, fromEmail: string): string {
  const name = String(fromName || "").trim();
  const email = String(fromEmail || "").trim();
  if (name) return `${name} <${email}>`;
  return email;
}

async function fetchSmtpSettingsMap(): Promise<Record<string, string>> {
  const keys = Object.values(SMTP_SETTING_KEYS) as string[];
  const rows = await SystemSetting.findAll({ where: { key: keys } });
  const m: Record<string, string> = {};
  rows.forEach((r) => {
    m[r.key] = r.value ?? "";
  });
  return m;
}

function tryParseDatabase(
  m: Record<string, string>
): ResolvedSmtpSendConfig | null {
  if (!parseBool(m[SMTP_SETTING_KEYS.enabled])) {
    return null;
  }
  const host = String(m[SMTP_SETTING_KEYS.host] || "").trim();
  const fromEmail = String(m[SMTP_SETTING_KEYS.fromEmail] || "").trim();
  const portRaw = String(m[SMTP_SETTING_KEYS.port] || "").trim();
  const port = portRaw ? parseInt(portRaw, 10) : NaN;
  const user = String(m[SMTP_SETTING_KEYS.user] || "").trim();
  const pass = String(m[SMTP_SETTING_KEYS.password] || "");
  if (!host || !fromEmail || !Number.isFinite(port) || port <= 0 || port > 65535) {
    return null;
  }
  if (user && !pass.trim()) {
    return null;
  }
  const secure = parseBool(m[SMTP_SETTING_KEYS.secure]);
  const requireTls = parseBool(m[SMTP_SETTING_KEYS.requireTls]);
  const fromName = String(m[SMTP_SETTING_KEYS.fromName] || "").trim();
  const replyToRaw = String(m[SMTP_SETTING_KEYS.replyTo] || "").trim();
  return {
    host,
    port,
    user,
    pass,
    fromAddress: buildFromAddress(fromName, fromEmail),
    replyTo: replyToRaw || undefined,
    secure,
    requireTls,
    source: "database"
  };
}

function tryParseEnvironment(): ResolvedSmtpSendConfig | null {
  const host = String(process.env.MAIL_HOST || "").trim();
  const user = String(process.env.MAIL_USER || "").trim();
  const pass = String(process.env.MAIL_PASS || "");
  const fromEmail = String(process.env.MAIL_FROM || user || "").trim();
  if (!host || !user || !pass.trim() || !fromEmail) {
    return null;
  }
  const port = Number(process.env.MAIL_PORT || "465");
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }
  const secure = port === 465;
  return {
    host,
    port,
    user,
    pass,
    fromAddress: fromEmail,
    secure,
    requireTls: false,
    source: "environment"
  };
}

/**
 * Configuração efetiva para envio: registos SMTP na BD com `smtp_enabled`, senão variáveis MAIL_*.
 */
async function resolveSmtpSendConfig(): Promise<ResolvedSmtpSendConfig | null> {
  const m = await fetchSmtpSettingsMap();
  const fromDb = tryParseDatabase(m);
  if (fromDb) {
    return fromDb;
  }
  return tryParseEnvironment();
}

export async function isSmtpSendConfigured(): Promise<boolean> {
  const c = await resolveSmtpSendConfig();
  return c != null;
}

export default resolveSmtpSendConfig;
