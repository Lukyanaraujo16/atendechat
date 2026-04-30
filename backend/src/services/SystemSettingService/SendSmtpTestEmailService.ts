import AppError from "../../errors/AppError";
import resolveSmtpSendConfig from "../Mail/resolveSmtpSendConfig";
import createMailTransportFromResolved from "../Mail/createMailTransportFromResolved";
import {
  smtpSendErrorToClientMessage,
  redactSmtpHints
} from "../Mail/smtpClientSafeMessage";

const TEST_SUBJECT = "Teste de SMTP - StreamHUB Chat";
const TEST_BODY =
  "Se você recebeu este e-mail, a configuração SMTP está funcionando.";

function normalizeEmail(email: string): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Usa a mesma resolução que convites/recuperação (BD ativa → senão MAIL_*).
 */
const SendSmtpTestEmailService = async (toRaw: string): Promise<void> => {
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
      "SMTP não configurado. Ative e preencha os dados na plataforma ou defina MAIL_* no ambiente."
    );
  }

  const transporter = createMailTransportFromResolved(cfg);
  try {
    await transporter.sendMail({
      from: cfg.fromAddress,
      to,
      subject: TEST_SUBJECT,
      text: TEST_BODY,
      html: `<p>${TEST_BODY}</p>`,
      ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {})
    });
  } catch (err) {
    const safe = smtpSendErrorToClientMessage(err);
    console.error(
      "[SMTP test] Falha:",
      redactSmtpHints(err instanceof Error ? err.message : String(err))
    );
    throw new AppError("ERR_SMTP_TEST_FAILED", 502, safe);
  }
};

export default SendSmtpTestEmailService;
