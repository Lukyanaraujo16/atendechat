import resolveSmtpSendConfig, {
  isSmtpSendConfigured
} from "../Mail/resolveSmtpSendConfig";
import createMailTransportFromResolved from "../Mail/createMailTransportFromResolved";
import { redactSmtpHints } from "../Mail/smtpClientSafeMessage";

export type PasswordResetMailParams = {
  to: string;
  token: string;
  userName: string;
  /** `invite` = conta aprovada; mesmo link `/forgetpsw` para definir palavra-passe. */
  kind?: "reset" | "invite";
};

/** Indica se o envio SMTP está disponível (BD ativa com `smtp_enabled` ou variáveis MAIL_*). */
export async function isPasswordResetMailConfigured(): Promise<boolean> {
  return isSmtpSendConfigured();
}

function buildResetLink(email: string, token: string): string {
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const q = new URLSearchParams({
    email,
    token
  });
  return `${base}/forgetpsw?${q.toString()}`;
}

/**
 * Envia e-mail com link e código de recuperação (nodemailer).
 * Usa SystemSettings SMTP quando ativo; caso contrário MAIL_*.
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

  const link = buildResetLink(params.to, params.token);
  const appName = process.env.SYSTEM_NAME || "AtendeChat";
  const isInvite = params.kind === "invite";
  const subject = isInvite
    ? `${appName} — Conta aprovada: defina a sua palavra-passe`
    : `${appName} — Recuperação de palavra-passe`;

  const transporter = createMailTransportFromResolved(cfg);

  const html = isInvite
    ? `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #222;">
  <p>Olá${params.userName ? `, ${params.userName}` : ""},</p>
  <p>O seu pedido de registo em <strong>${appName}</strong> foi <strong>aprovado</strong>.</p>
  <p>Para ativar a conta do administrador, defina a sua palavra-passe com o código abaixo ou pelo link (válido 72 horas):</p>
  <p><strong>Código:</strong> <code style="font-size:16px;">${params.token}</code></p>
  <p><a href="${link}">${link}</a></p>
  <p>Se não esperava este e-mail, ignore-o.</p>
</body>
</html>`
    : `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #222;">
  <p>Olá${params.userName ? `, ${params.userName}` : ""},</p>
  <p>Recebemos um pedido para redefinir a palavra-passe da sua conta em <strong>${appName}</strong>.</p>
  <p><strong>Código de verificação:</strong> <code style="font-size:16px;">${params.token}</code></p>
  <p>Ou abra o link (válido por 1 hora):<br/>
  <a href="${link}">${link}</a></p>
  <p>Se não foi você, ignore este e-mail.</p>
</body>
</html>`;

  const text = isInvite
    ? `Conta aprovada em ${appName}. Código: ${params.token}\nLink: ${link}`
    : `Código: ${params.token}\nLink: ${link}`;

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
