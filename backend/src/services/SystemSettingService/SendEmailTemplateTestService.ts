import AppError from "../../errors/AppError";
import resolveSmtpSendConfig from "../Mail/resolveSmtpSendConfig";
import createMailTransportFromResolved from "../Mail/createMailTransportFromResolved";
import {
  smtpSendErrorToClientMessage,
  redactSmtpHints
} from "../Mail/smtpClientSafeMessage";
import {
  composeTemplatedEmailBodies,
  renderEmailTemplate
} from "../Mail/renderEmailTemplate";
import GetEmailTemplatesService from "./GetEmailTemplatesService";
import GetPublicBrandingService from "./GetPublicBrandingService";

function normalizeEmail(email: string): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function buildResetLink(email: string, token: string, baseRaw: string): string {
  const base = baseRaw.replace(/\/$/, "");
  const q = new URLSearchParams({ email, token });
  return `${base}/forgetpsw?${q.toString()}`;
}

function defaultFrontendBase(templatesLoginUrl: string): string {
  const fromTpl = String(templatesLoginUrl || "").trim();
  if (fromTpl) return fromTpl.replace(/\/$/, "");
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

export type EmailTemplateTestKind = "welcome" | "passwordReset";

/**
 * E-mail de teste com dados fictícios (não usa credenciais reais).
 */
const SendEmailTemplateTestService = async (
  toRaw: string,
  kind: EmailTemplateTestKind
): Promise<void> => {
  const to = normalizeEmail(toRaw);
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new AppError(
      "ERR_SMTP_INVALID_TEST_EMAIL",
      400,
      "Indique um endereço de e-mail válido para o teste."
    );
  }

  const cfg = await resolveSmtpSendConfig();
  if (!cfg) {
    throw new AppError(
      "ERR_SMTP_NOT_CONFIGURED",
      503,
      "SMTP não configurado. Configure o servidor de e-mail antes de testar modelos."
    );
  }

  const templates = await GetEmailTemplatesService();
  const branding = await GetPublicBrandingService();
  const systemName =
    String(branding.systemName || "").trim() ||
    process.env.SYSTEM_NAME ||
    "AtendeChat";
  const base = defaultFrontendBase(templates.loginUrl);
  const sampleVars: Record<string, string> = {
    companyName: "Empresa de Demonstração Ltda.",
    userName: "Administrador de Teste",
    userEmail: to,
    temporaryPassword: "********",
    resetLink: buildResetLink(to, "token-de-exemplo-somente-para-visualizacao", base),
    loginUrl: base,
    systemName,
    supportEmail: templates.supportEmail || "suporte@exemplo.com"
  };

  const subjectTpl =
    kind === "welcome"
      ? templates.welcomeSubject
      : templates.passwordResetSubject;
  const bodyTpl =
    kind === "welcome" ? templates.welcomeBody : templates.passwordResetBody;

  const subject = renderEmailTemplate(subjectTpl, sampleVars, {
    escapeValues: true
  })
    .replace(/\s+/g, " ")
    .trim();
  const { html, text } = composeTemplatedEmailBodies(bodyTpl, sampleVars);

  const transporter = createMailTransportFromResolved(cfg);
  try {
    await transporter.sendMail({
      from: cfg.fromAddress,
      to,
      subject: `[Teste] ${subject}`,
      text,
      html,
      ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {})
    });
  } catch (err) {
    const safe = smtpSendErrorToClientMessage(err);
    console.error(
      "[Email template test] Falha:",
      redactSmtpHints(err instanceof Error ? err.message : String(err))
    );
    throw new AppError("ERR_SMTP_TEST_FAILED", 502, safe);
  }
};

export default SendEmailTemplateTestService;
