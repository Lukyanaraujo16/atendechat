/*
 * Fase 8.3-B3 (B34-T8): nenhum teste pode abrir conexão com a Efí (sandbox ou produção).
 * Os testes mocam axios/SDK; isto é a rede de segurança caso um mock falte.
 */
const tls = require("tls");

const EFI_HOST_RE = /(^|\.)(efipay|gerencianet)\.com\.br$/i;
const originalConnect = tls.connect;

tls.connect = function guardedConnect(...args) {
  const opts = args.find(a => a && typeof a === "object") || {};
  const host = String(opts.servername || opts.host || (typeof args[1] === "string" ? args[1] : "") || "");
  if (EFI_HOST_RE.test(host)) {
    throw new Error(`[jest] conexão real com a Efí bloqueada nos testes: ${host}`);
  }
  return originalConnect.apply(this, args);
};
