/**
 * Mapa de referência: feature → superfícies do produto (menus/rotas/API).
 * Runtime usa `requireAnyPlanFeature` / `requireEffectiveModule` nas rotas — isto é documentação viva.
 */
export const FEATURE_ENFORCEMENT_MAP: Array<{
  feature: string;
  menu?: string;
  frontendRoutes?: string[];
  backendRoutes?: string[];
  notes?: string;
}> = [
  { feature: "dashboard.main", frontendRoutes: ["/"], backendRoutes: ["GET /dashboard"] },
  {
    feature: "dashboard.reports",
    frontendRoutes: ["/relatorios"],
    backendRoutes: ["GET /dashboard/ticketsUsers", "GET /dashboard/ticketsDay"]
  },
  {
    feature: "attendance.kanban",
    menu: "Atendimento → Kanban",
    frontendRoutes: ["/kanban"],
    backendRoutes: ["GET /ticket/kanban", "GET /tags/kanban"]
  },
  {
    feature: "attendance.internal_chat",
    menu: "Chat interno",
    frontendRoutes: ["/chats", "/chats/:id"],
    backendRoutes: ["/chats/*"]
  },
  {
    feature: "attendance.schedules",
    menu: "Agendamentos",
    frontendRoutes: ["/schedules"],
    backendRoutes: ["/schedules/*"]
  },
  {
    feature: "automation.chatbot",
    menu: "Automação → Fluxos",
    frontendRoutes: ["/flowbuilders", "/flowbuilder/:id"],
    backendRoutes: ["/flowbuilder/*", "/flowbuilders/*"]
  },
  {
    feature: "automation.keywords",
    menu: "Automação → Gatilhos",
    frontendRoutes: ["/phrase-lists"],
    backendRoutes: ["/flowcampaign/*"]
  },
  {
    feature: "automation.openai",
    menu: "Automação → Prompts",
    frontendRoutes: ["/prompts"],
    backendRoutes: ["/prompts/*"]
  },
  {
    feature: "automation.integrations",
    menu: "Automação → Integrações de fila",
    frontendRoutes: ["/queue-integration"],
    backendRoutes: ["/queueIntegration/*"]
  },
  {
    feature: "automation.quick_replies",
    menu: "Automação → Respostas rápidas",
    frontendRoutes: ["/quick-messages"],
    backendRoutes: ["/quick-messages/*"]
  },
  {
    feature: "agenda.calendar",
    menu: "Agenda",
    frontendRoutes: ["/agenda"],
    backendRoutes: ["/appointments/*"]
  },
  {
    feature: "agenda.appointments",
    notes: "Agendamentos de envio (legado useSchedules); partilha gating com attendance.schedules",
    frontendRoutes: ["/schedules"],
    backendRoutes: ["/schedules/*"]
  },
  {
    feature: "campaigns.sends",
    menu: "Campanhas → Disparos em massa",
    frontendRoutes: ["/campaigns", "/campaign/*", "/campaigns-config"],
    backendRoutes: ["/campaigns/*"],
    notes: "Criação, configuração e disparo de campanhas (não inclui listas de destinatários)."
  },
  {
    feature: "campaigns.lists",
    menu: "Campanhas → Listas de destinatários",
    frontendRoutes: ["/contact-lists", "/contact-list-items"],
    backendRoutes: ["/contact-lists/*", "/contact-list-items/*"],
    notes: "Listas de destinatários para campanhas — distinto do cadastro geral de contatos."
  },
  {
    feature: "team.users",
    menu: "Equipe",
    frontendRoutes: ["/users", "/setores"],
    backendRoutes: ["POST/PUT/DELETE /users/*"]
  },
  {
    feature: "team.queues",
    menu: "Equipe → Setores",
    frontendRoutes: ["/setores", "/queues"],
    backendRoutes: ["POST/PUT/DELETE /queue/*"]
  },
  {
    feature: "team.groups",
    menu: "Atendimento → Grupos",
    frontendRoutes: ["/group-manager"],
    backendRoutes: ["/groups/*"]
  },
  {
    feature: "team.ratings",
    menu: "Avaliações",
    frontendRoutes: ["/avaliacao"],
    backendRoutes: ["/rating-templates/*", "/user-ratings/*"]
  },
  {
    feature: "finance.subscription",
    menu: "Financeiro / Subscrição",
    frontendRoutes: ["/subscription"],
    backendRoutes: ["POST /subscription"]
  },
  {
    feature: "finance.invoices",
    menu: "Financeiro",
    frontendRoutes: ["/financeiro"],
    notes: "UI; faturas podem exigir perfil super"
  },
  {
    feature: "settings.api",
    menu: "Configurações → API",
    frontendRoutes: ["/messages-api"],
    backendRoutes: ["POST /api/messages/send"]
  },
  {
    feature: "contacts.tags",
    menu: "Tags de contatos",
    frontendRoutes: ["/tags"],
    backendRoutes: ["/tags/*", "GET /ticket/kanban"],
    notes: "Etiquetas para contatos, tickets e Kanban."
  },
  {
    feature: "contacts.files",
    menu: "Biblioteca de arquivos",
    frontendRoutes: ["/files"],
    backendRoutes: ["/files/*"],
    notes: "Biblioteca de arquivos do sistema (menu Arquivos), não listas de campanha."
  },
  {
    feature: "crm.pipeline",
    menu: "CRM",
    frontendRoutes: ["/crm"],
    backendRoutes: ["/crm/*"]
  },
  {
    feature: "settings.instagram_integration",
    menu: "Configurações → Instagram",
    frontendRoutes: ["/connections (aba Instagram)"],
    backendRoutes: ["/instagram-accounts/*", "POST /instagram-accounts/*/oauth/*"]
  },
  {
    feature: "inventory.sales",
    menu: "Estoque e Vendas",
    frontendRoutes: ["/inventory-sales"],
    backendRoutes: ["(futuro) /inventory/*"]
  }
];
