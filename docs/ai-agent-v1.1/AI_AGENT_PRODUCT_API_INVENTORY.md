# AI Agent Product API — Inventário comercial atual

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 2.0 |
| **Status** | Inventário (não remove endpoints) |
| **Referência** | `ARCHITECTURE_LOCK.md` v1.0 (congelado) |

Este inventário descreve o que o produto comercial usa **hoje**, antes da Product API. Endpoints técnicos do Console (`techRead` / `techManage`) estão listados só para separação — **não** são destino do frontend comercial.

---

## Legenda

| Coluna | Significado |
|--------|-------------|
| Destino futuro | Product API / Experience Layer / permanece legado / técnico (Console) |

---

## Matriz

| Área comercial | Endpoint atual | Consumidor | Service | Dados retornados | Problema atual | Destino futuro |
|----------------|----------------|------------|---------|------------------|----------------|----------------|
| Lista de agentes | `GET /ai-agents` | `pages/AiAgent`, Wizard | `ListAiAgentsService` | Sequelize `AiAgent[]` (campos técnicos + `aiProviderCredentialId`) | FE decide chip ativo/inativo por `enabled`; sem status comercial | Product: summary + futuros `GET /product/ai-agent/agents` |
| Detalhe agente | `GET /ai-agents/:id` | Modal, Wizard, Simulator | `ShowAiAgentService` | Modelo completo | Exposição de IDs internos; sem view model comercial | Product serializer futuro |
| Criação | `POST /ai-agents` | Modal / Wizard | `CreateAiAgentService` | Agente criado | CRUD legado OK; fora do escopo 2.0 | Permanecer até migração CRUD |
| Edição | `PUT /ai-agents/:id` | Modal / Wizard | `UpdateAiAgentService` | Agente atualizado | Idem | Permanecer |
| Exclusão | `DELETE /ai-agents/:id` | `pages/AiAgent` | `DeleteAiAgentService` | — | Bloqueia se binding WhatsApp | Permanecer |
| Profile guiado | `GET/PUT /ai-agents/:id/profile` | Wizard | `Show/UpsertAiAgentProfileService` | Profile completo | Setup incompleto calculado no FE (wizard steps) | Experience: checks `instructions` |
| Preview prompt | `POST /ai-agents/:id/profile/preview` | Wizard | `GenerateAiAgentPromptPreviewService` | Preview | Comercial OK | Permanecer |
| Credenciais provider | `/ai-provider-credentials*` | `pages/AiAgent` | AiProviderCredential services | Lista/CRUD/test | Página mistura agentes + credenciais; FE não sabe se “pronto” | Product: check `provider` no readiness |
| Associação WhatsApp | Campos em create/update WhatsApp (`aiAgentId`, `aiAgentMode`, `aiAgentEnabled`) | Conexões WhatsApp | `resolveAiAgentWhatsappFields` | Persistência na conexão | Modo técnico (`shadow`/`live`/`dry_run`) exposto na UI de conexão; produto não tem resumo | Product: `connection` + `mode` comercial |
| Knowledge Base link | `GET/PUT /ai-agents/:id/knowledge-bases` | Knowledge panel | Sync/List KB services | Links | KB **opcional** no runtime; FE pode sugerir sem bloquear | Check opcional futuro; não bloqueia readiness 2.0 |
| Knowledge settings | `GET/PUT .../knowledge-settings` | Panel | Upsert/Show settings | Settings | Técnico demais para home do produto | Permanecer / Console analytics |
| Knowledge retrieval test | `POST .../knowledge-retrieval/test` | Panel | Retrieve service | Hits | Operacional | Permanecer |
| Shadow suggestions | `GET /ai-agents/shadow-suggestions*` | `pages/AiAgent` | Shadow suggestion services | Logs/sugestões | Observabilidade embutida na página comercial | Futuro: Experience metrics leves; técnico → Console |
| Simulator | `/ai-agents/:id/simulator/*` | Simulator page | `AiAgentSimulationService` | Sessões/mensagens | Credential-check no FE | Permanecer; readiness não exige simulator |
| Pause / resume ticket | `POST /tickets/:id/ai-agent/pause\|resume` | Ticket controls | Pause/Resume services | Ticket flags | Pause é **por ticket**, não do agente global | Não marcar agente “paused” só por ticket |
| Handoff | Runtime + profile `handoffRules` / `handoffMessage` | Live/Shadow | `applyAiAgentHandoffToTicket` | Ticket | Elegibilidade por mensagem | Runtime only; não readiness estrutural |
| Estado na listagem | — (derivado no FE) | `pages/AiAgent` | — | Chip `enabled` | **FE calcula estado** | Product summary/status |
| Analytics / health | `/ai-agents/analytics/*` | Console Técnico | Analytics services | Dashboards | Já classificado técnico | Console only |
| Shadow FC admin | `/ai-agents/shadow-evaluations*`, `shadow-fc/*` | Console | ShadowFcAdminServices | FC shadow | Técnico | Console only |

---

## Regras atualmente no cliente (duplicações)

| Regra | Onde | Problema |
|-------|------|----------|
| Ativo vs inativo | `agent.enabled` → chip i18n | Não reflete Shadow/Live/conexão |
| Validação wizard por passo | `aiAgentWizardValidation.js` | Não é readiness global; OK para formulário |
| Acesso ao módulo | `canUseAiAgent` + planFlags | Correto no FE para menu; readiness de ativação deve ser BE |
| Shadow labels | `aiAgentShadowObservability.js` | Observabilidade comercial misturada |
| KB observability em suggestions | utils + page | Técnico na superfície comercial |

---

## Critérios reais auditados (código) para readiness

| Critério | Fonte | Estrutural (readiness)? | Por mensagem (runtime)? |
|----------|-------|-------------------------|-------------------------|
| Feature `automation.ai_agent` | Plan + user feature | Sim | Sim (gate) |
| Agente existe | `AiAgents` | Sim | — |
| `agent.enabled` | modelo | Sim (pause comercial) | Sim |
| Credencial | `aiProviderCredentialId` ou default empresa | Sim (existência enabled) | Resolve + decrypt no runtime |
| Instruções | `systemPrompt` ou profile guided `generatedPrompt` | Sim | — |
| Modelo | `model` default sempre presente | Não bloqueia se default | — |
| WhatsApp vinculado | `Whatsapp.aiAgentId` | Sim | — |
| Modo `aiAgentMode` | conexão | Sim (mode comercial) | — |
| Conexão `status` | WhatsApp | Atenção se modo ativo e ≠ CONNECTED | — |
| Knowledge Base | settings default off | Não obrigatório | Decisão runtime |
| Chatbot / flow / integração | ticket | **Não** | Sim (`AiAgentOrchestrator` / Live) |
| Pause / handoff ticket | ticket | **Não** | Sim |
| Grupo / áudio / userId | ticket / flags | **Não** (áudio = config) | Sim |

---

## Feature e autorização comercial atuais

| Item | Valor |
|------|-------|
| Feature plano | `automation.ai_agent` |
| Middleware CRUD | `isAuth` + `requireEffectiveModule("automation.ai_agent")` |
| Admin dedicado | Não nas rotas `/ai-agents` |
| Platform AgentOS | **Não** no comercial; só analytics/shadow-fc |
| supportMode | Usa `companyId` da sessão; não autoriza Console |

---

## Lacuna que a Fase 2.0 fecha

Não existia:

* namespace Product API;
* `AgentReadinessService` / status comercial estável;
* serializer sem vazamento;
* endpoint de summary.

Endpoints `/ai-agents*` **não são removidos** nesta fase.
