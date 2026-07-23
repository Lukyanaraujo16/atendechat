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
    feature: "automation.ai_agent",
    menu: "Automação → Agente de IA",
    frontendRoutes: ["/ai-agent"],
    backendRoutes: [
      "GET /ai-agents",
      "GET /ai-agents/:id",
      "POST /ai-agents",
      "PUT /ai-agents/:id",
      "DELETE /ai-agents/:id"
    ],
    notes: "CRUD administrativo do agente (fase 1.0); sem runtime de mensagens."
  },
  {
    feature: "automation.knowledge_base",
    menu: "Automação → Base de Conhecimento",
    frontendRoutes: ["/knowledge-base"],
    backendRoutes: [
      "GET /knowledge-bases",
      "GET /knowledge-bases/:id",
      "POST /knowledge-bases",
      "PUT /knowledge-bases/:id",
      "DELETE /knowledge-bases/:id",
      "GET /knowledge-bases/:id/documents",
      "POST /knowledge-bases/:id/documents"
    ],
    notes:
      "CRUD de bases e documentos (fase 1.5.2A); sem RAG, embeddings ou extração."
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
    notes: "Feature do plano (obrigatória). Permissões granulares por utilizador abaixo.",
    frontendRoutes: ["/inventory-sales"],
  },
  {
    feature: "inventory.sales.view",
    notes: "Plano inventory.sales + permissão view",
    backendRoutes: [
      "GET /inventory/categories",
      "GET /inventory/products",
      "GET /inventory/products/:id",
      "GET /inventory/sales",
      "GET /inventory/sales/:id",
    ],
  },
  {
    feature: "inventory.sales.manageProducts",
    backendRoutes: [
      "POST/PUT/DELETE /inventory/categories/*",
      "POST/PUT/DELETE /inventory/products/*",
    ],
  },
  {
    feature: "inventory.sales.manageStock",
    backendRoutes: ["POST /inventory/stock-movements"],
  },
  {
    feature: "inventory.sales.manageStock | inventory.sales.view",
    backendRoutes: [
      "GET /inventory/stock-movements",
      "GET /inventory/products/low-stock",
      "GET /inventory/products/:id/stock-movements",
    ],
  },
  {
    feature: "inventory.sales.createSale",
    backendRoutes: [
      "POST /inventory/sales",
      "PUT /inventory/sales/:id",
      "POST/PUT/DELETE /inventory/sales/:id/items/*",
      "POST /inventory/sales/:id/complete",
    ],
  },
  {
    feature: "inventory.sales.cancelSale",
    backendRoutes: [
      "DELETE /inventory/sales/:id",
      "POST /inventory/sales/:id/cancel",
    ],
  },
  {
    feature: "inventory.sales.managePayments",
    backendRoutes: ["PUT /inventory/sales/:id/payment"],
  },
  {
    feature: "inventory.sales.viewReports",
    backendRoutes: [
      "GET /inventory/reports/summary",
      "GET /inventory/reports/sellers",
      "GET /inventory/reports/products",
      "GET /inventory/reports/customers",
    ],
  },
  {
    feature: "inventory.sales.manageSettings",
    backendRoutes: [
      "GET/PUT /inventory/settings",
      "GET/POST/PUT/DELETE /inventory/seller-profiles/*",
    ],
  },
  {
    feature: "automation.ai",
    notes: "AgentOS Wave 2 — núcleo; alias de superfície automation.ai_agent",
    backendRoutes: ["/automation/*"]
  },
  {
    feature: "automation.memory",
    frontendRoutes: ["/automation/cognitive-memory"],
    backendRoutes: ["/automation/memory/*"],
    notes: "Cognitive Memory — RBAC + plano + tenant (Wave 2)"
  },
  {
    feature: "automation.learning",
    frontendRoutes: ["/automation/learning-engine"],
    backendRoutes: ["/automation/learning/*"],
    notes: "Learning consultivo; sem auto-promotion (Wave 2)"
  },
  {
    feature: "automation.mcp",
    frontendRoutes: ["/automation/mcp-runtime"],
    backendRoutes: ["/automation/mcp/*"],
    notes: "MCP Runtime — credentials masked; fail-closed plan (Wave 2)"
  },
  {
    feature: "automation.multi_agent",
    frontendRoutes: ["/automation/multi-agent"],
    backendRoutes: ["/automation/agents/*"],
    notes: "Multi-Agent simulation only; Live desabilitado (Wave 2)"
  },
  {
    feature: "automation.runtime",
    frontendRoutes: ["/automation/runtime-integration"],
    backendRoutes: ["/automation/runtime/*", "/automation/execution/*"]
  },
  {
    feature: "automation.replay",
    backendRoutes: ["*/replay*", "/automation/orchestrator/executions/:id/replay"],
    notes: "Replay administrativo protegido"
  },
  {
    feature: "automation.monitor",
    frontendRoutes: ["/automation/monitor", "/automation/observability"],
    backendRoutes: ["/automation/evidence/*", "/automation/monitor*", "/automation/observability/*"]
  },
  {
    feature: "automation.dashboard",
    backendRoutes: ["/automation/*/dashboard", "/automation/orchestrator/*"]
  },
  {
    feature: "automation.tester",
    frontendRoutes: ["/automation/tools"],
    backendRoutes: ["/automation/tools/*", "*/simulate*"],
    notes: "Tester/simulation — sem alteração de produção"
  },
];
