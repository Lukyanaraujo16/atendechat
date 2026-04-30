import resolveSmtpSendConfig, {
  isSmtpSendConfigured
} from "../Mail/resolveSmtpSendConfig";
import createMailTransportFromResolved from "../Mail/createMailTransportFromResolved";
import { redactSmtpHints } from "../Mail/smtpClientSafeMessage";
import {
  composeTemplatedEmailBodies,
  renderEmailTemplate
} from "../Mail/renderEmailTemplate";
import GetEmailTemplatesService from "../SystemSettingService/GetEmailTemplatesService";
import GetPublicBrandingService from "../SystemSettingService/GetPublicBrandingService";

export type PasswordResetMailParams = {
  to: string;
  token: string;
  userName: string;
  /** `invite` = conta aprovada / primeiro acesso; usa modelo boas-vindas. */
  kind?: "reset" | "invite";
  companyName?: string;
  /** Só no fluxo com senha provisória; pode ser omitido (tag fica vazia). */
  temporaryPassword?: string;
};

/** Indica se o envio SMTP está disponível (BD ativa com `smtp_enabled` ou variáveis MAIL_*). */
export async function isPasswordResetMailConfigured(): Promise<boolean> {
  return isSmtpSendConfigured();
}

function buildResetLink(email: string, token: string, baseRaw: string): string {
  const base = baseRaw.replace(/\/$/, "");
  const q = new URLSearchParams({
    email,
    token
  });
  return `${base}/forgetpsw?${q.toString()}`;
}

function defaultFrontendBase(templatesLoginUrl: string): string {
  const fromTpl = String(templatesLoginUrl || "").trim();
  if (fromTpl) return fromTpl.replace(/\/$/, "");
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Envia e-mail (convite/boas-vindas ou recuperação de senha).
 * Modelos em SystemSettings; fallback embutido se chaves vazias.
 */
export default async function sendPasswordResetEmail(
  params: PasswordResetMailParams
): Promise<void> {
  const cfg = await resolveSmtpSendConfig();
  if (!cfg) {
    console.warn(
      "[PasswordReset] SMTP não configurado (Gestão SaaS → E-mail ou MAIL_*) — e-mail não enviado."
    );
    return;
  }

  const templates = await GetEmailTemplatesService();
  const branding = await GetPublicBrandingService();
  const systemName =
    String(branding.systemName || "").trim() ||
    process.env.SYSTEM_NAME ||
    "AtendeChat";
  const base = defaultFrontendBase(templates.loginUrl);
  const resetLink = buildResetLink(params.to, params.token, base);
  const isInvite = params.kind === "invite";

  const vars: Record<string, string> = {
    companyName: String(params.companyName ?? "").trim(),
    userName: String(params.userName ?? "").trim(),
    userEmail: params.to,
    temporaryPassword: String(params.temporaryPassword ?? ""),
    resetLink,
    loginUrl: base,
    systemName,
    supportEmail: templates.supportEmail
  };

  const subjectTpl = isInvite
    ? templates.welcomeSubject
    : templates.passwordResetSubject;
  const bodyTpl = isInvite ? templates.welcomeBody : templates.passwordResetBody;

  const subject = renderEmailTemplate(subjectTpl, vars, {
    escapeValues: true
  })
    .replace(/\s+/g, " ")
    .trim();
  const { html, text } = composeTemplatedEmailBodies(bodyTpl, vars);

  const transporter = createMailTransportFromResolved(cfg);

  try {
    await transporter.sendMail({
      from: cfg.fromAddress,
      to: params.to,
      subject,
      text,
      html,
      ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {})
    });
  } catch (err) {
    console.error(
      "[PasswordReset] Falha ao enviar:",
      redactSmtpHints(err instanceof Error ? err.message : String(err))
    );
    throw err;
  }
}
