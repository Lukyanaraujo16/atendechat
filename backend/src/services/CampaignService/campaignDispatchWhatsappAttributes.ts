/**
 * 12.5-B — atributos mínimos do Whatsapp no include de Campaign Dispatch.
 *
 * Sem connectionProvider o Sequelize devolve instância parcial e
 * resolveWhatsAppConnectionProvider cai no default Baileys.
 * Não serializar provider no job Bull: reidratar no consumer.
 */
export const CAMPAIGN_DISPATCH_WHATSAPP_ATTRIBUTES = [
  "id",
  "name",
  "connectionProvider",
  "status",
  "companyId"
] as const;
