/** Mensagem segura para o cliente (sem credenciais). */
export function smtpSendErrorToClientMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("authentication failed") || lower.includes("535")) {
    return "Falha de autenticação no servidor SMTP. Verifique utilizador e senha.";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo")
  ) {
    return "Não foi possível ligar ao servidor SMTP. Verifique host, porta e rede.";
  }
  if (lower.includes("certificate") || lower.includes("ssl") || lower.includes("tls")) {
    return "Erro de TLS/SSL na ligação SMTP. Ajuste as opções seguras ou o certificado do servidor.";
  }
  return "Não foi possível enviar o e-mail. Verifique a configuração SMTP.";
}

/** Evita vazar segredos em logs acidentais. */
export function redactSmtpHints(msg: string): string {
  return msg.replace(/\b(pass|password)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}
