import nodemailer from "nodemailer";
import type { ResolvedSmtpSendConfig } from "./resolveSmtpSendConfig";

export default function createMailTransportFromResolved(
  cfg: ResolvedSmtpSendConfig
) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTls,
    ...(cfg.user
      ? { auth: { user: cfg.user, pass: cfg.pass } }
      : {})
  });
}
