/** Chaves em `SystemSettings` (valores string). */
export const SMTP_SETTING_KEYS = {
  enabled: "smtp_enabled",
  host: "smtp_host",
  port: "smtp_port",
  user: "smtp_user",
  password: "smtp_password",
  fromName: "smtp_from_name",
  fromEmail: "smtp_from_email",
  secure: "smtp_secure",
  requireTls: "smtp_require_tls",
  replyTo: "smtp_reply_to"
} as const;
