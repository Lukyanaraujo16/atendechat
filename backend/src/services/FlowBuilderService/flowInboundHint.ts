/** Dados provider-neutral para o executor de Flow (sem proto/WASocket). */
export type FlowInboundHint = {
  remoteJid?: string | null;
  body?: string | null;
};
