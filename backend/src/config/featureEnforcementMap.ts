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
    menu: "Campanhas",
    frontendRoutes: ["/campaigns", "/campaign/*"],
    backendRoutes: ["/campaigns/*"]
  },
  {
    feature: "campaigns.lists",
    menu: "Campanhas → Listas",
    frontendRoutes: ["/contact-lists"],
    backendRoutes: ["/contact-lists/*", "/contact-list-items/*"]
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
    feature: "contacts.crm",
    menu: "Tags",
    frontendRoutes: ["/tags"]
  },
  {
    feature: "contacts.files",
    menu: "Ficheiros",
    frontendRoutes: ["/files"]
  }
];
