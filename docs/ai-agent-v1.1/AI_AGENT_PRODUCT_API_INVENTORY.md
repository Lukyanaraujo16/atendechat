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
| Associação WhatsApp | Colunas `aiAgentId` / `aiAgentMode` / `aiAgentEnabled` (leitura GET; mutação só Product) | Conexões WhatsApp | Product connections + commands | Persistência na conexão | WhatsApp create/update rejeitam campos AI (2.6) | Product: `connection` + `mode` comercial |
| Knowledge Base link | `GET/PUT /ai-agents/:id/knowledge-bases` | Knowledge panel | Sync/List KB services | Links | KB **opcional** no runtime; FE pode sugerir sem bloquear | Check opcional futuro; não bloqueia readiness 2.0 |
| Knowledge settings | `GET/PUT .../knowledge-settings` | Panel | Upsert/Show settings | Settings | Técnico demais para home do produto | Permanecer / Console analytics |
| Knowledge retrieval test | `POST .../knowledge-retrieval/test` | Panel | Retrieve service | Hits | Operacional | Permanecer |
| Shadow suggestions | `GET /ai-agents/shadow-suggestions*` | `pages/AiAgent` | Shadow suggestion services | Logs/sugestões | Observabilidade embutida na página comercial | Futuro: Experience metrics leves; técnico → Console |
| Simulator | `/ai-agents/:id/simulator/*` | Simulator page (legado) | `AiAgentSimulationService` | Sessões/mensagens | Credential-check no FE | **Product 2.5:** `/product/ai-agent/simulator/*` (legado permanece) |
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

---

## Fase 2.2 — Mutações e CRUD legado

### Product API de comandos (nova)

| Comando | Endpoint | Quem usa |
|---------|----------|----------|
| activate_shadow / activate_live / deactivate | `POST /product/ai-agent/commands` | Experience Layer `/ai-agent` |

### Endpoints legados que alteram `enabled` / modo

| Endpoint | Campos | Auth atual | Ainda necessário? | Experience Layer 2.2 |
|----------|--------|------------|-------------------|----------------------|
| `PUT /ai-agents/:id` | `enabled` | `isAuth` + feature (sem admin) | Wizard / edição | **Não** usar |
| `PUT /whatsapp/:id` | `aiAgentId`, `aiAgentMode`, `aiAgentEnabled` | `isAuth` apenas; feature dentro do resolver | Conexões WhatsApp UI | **Não** usar |
| `POST /whatsapp` | idem na criação | `isAuth` + delinquency | Conexões | **Não** usar |

### Hardening futuro (recomendação)

1. Exigir `admin` em `PUT /whatsapp` quando campos AI forem enviados.
2. Exigir `admin` em `PUT /ai-agents/:id` (alinhar à UI).
3. Migrar Wizard gradualmente para Product API de configuração (Fase 2.3).

### Hardening 2.2.1 — escopo de conexões

| Decisão | Valor |
|---------|-------|
| Regra | **Opção A** — comando no agente + todas as WA vinculadas |
| Activate + desconectada | **Falha total** (sem sucesso parcial) |
| Estado misto | Legado permitido; Product marca `attention_required`; comandos normalizam |
| Summary | `connection` preview determinístico (id ASC) + `connectionScope` |
| Resposta comando | `affectedConnections` (count, names, fromMode, toMode) |

### Hardening 2.2.2 — resolução do agente

| Decisão | Valor |
|---------|-------|
| Estratégia | **A** — no máximo um agente comercial; ≥2 → ambíguo |
| Resolver | `ResolveAiAgentProductContextService` (único) |
| Elegível | todos os AiAgent do tenant (incl. `enabled=false`) |
| Commands ambíguos | bloqueados (`ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS`) |
| Deactivate ambíguo | **não** desliga em massa |
| `agentScope` | `none` \| `single` \| `ambiguous` + `count` |

---

## Matriz de migração progressiva (Fase 2.3)

| Operação | Endpoint legado | Nova Product API | Consumidores legado | Migração prevista |
|----------|-----------------|------------------|---------------------|-------------------|
| Wizard (fluxo guiado completo) | `/ai-agents*` + `/ai-provider-credentials` | configuração, opções, conexões e preview em `/product/ai-agent/configuration*` | Nenhum no Wizard | **Migrado (2.4)** |
| Ler configuração | `GET /ai-agents/:id` + `GET /ai-agents/:id/profile` | `GET /product/ai-agent/configuration` | AiAgentModal | Wizard migrado (2.4) |
| Criar agente | `POST /ai-agents` | `POST /product/ai-agent/configuration` | — | Wizard migrado (2.4) |
| Atualizar agente | `PUT /ai-agents/:id` | `PUT /product/ai-agent/configuration` | AiAgentModal | Fase 2.4 |
| Atualizar profile | `PUT /ai-agents/:id/profile` | `PUT /product/ai-agent/configuration` | — | Wizard migrado (2.4) |
| Atualizar credencial | `PUT /ai-agents/:id` (`aiProviderCredentialId`) | `PUT /product/ai-agent/configuration` | AiAgentModal | Fase 2.4 |
| Vincular WA | `PUT /whatsapp/:id` (**bloqueado** para AI — 2.6) | `PUT /product/ai-agent/configuration/connections` | — | **Concluído (2.6)** |
| Ativar shadow | `PUT /whatsapp/:id` (**bloqueado** — 2.6) | `POST /product/ai-agent/commands` | Nenhum novo | Concluído (2.2 + harden 2.6) |
| Ativar live | `PUT /whatsapp/:id` (**bloqueado** — 2.6) | `POST /product/ai-agent/commands` | Nenhum novo | Concluído (2.2 + harden 2.6) |
| Desativar | `PUT /whatsapp/:id` (**bloqueado** — 2.6) | `POST /product/ai-agent/commands` | Nenhum novo | Concluído (2.2 + harden 2.6) |
| Listar opções | `GET /ai-provider-credentials` | `GET /product/ai-agent/configuration/options` | AiAgentModal | Wizard migrado (2.4) |
| Knowledge Base | `GET/PUT /ai-agents/:id/knowledge-*` | Não migrada | AiAgentModal, KB modal | backlog |

### Status da redução

- **Endpoints legados não removidos** — consumidores ativos: AiAgentModal (órfão), Simulator legado (compat), CRUD credenciais (KB Embedding)
- **Product API completa** para: summary, readiness, commands, configuration (GET/POST/PUT/preview), connections, options (providers + models), simulator
- **Hardening 2.3.1:** providers comerciais `openai` + `gemini` (fonte única `aiAgentProductProviderCapabilities`); validação credential/model por provider; sem conversão silenciosa
- **Hardening 2.3.2:** readiness exige credencial **selecionada** + provider suportado + modelo compatível; conflitos → `attention_required`; activate usa o readiness corrigido
- **Fase 2.4 concluída:** Wizard migrado para Product API; ver `AI_AGENT_WIZARD_MIGRATION_INVENTORY.md`
- **Hardening 2.4.1:** edição de identidade com agente ativo; provider/model/credential obrigatórios no Review; `createMinimalAiAgentPayload` removido; testes `aiAgentWizardActiveIdentityPhase241`
- **Hardening 2.4.2:** agente ativo usa tela identity-only dedicada, sem steps/Review/preview estruturais; identidade e profile têm hidratação separada; Success específico; teste anti-descarte `aiAgentWizardActiveIdentityModePhase242`
- **Fase 2.5 concluída:** Product Simulator em `/product/ai-agent/simulator/*` + UI `/ai-agent/simulator`; ver `AI_AGENT_PRODUCT_SIMULATOR_CONTRACT.md`. Legado `/ai-agents/:id/simulator/*` permanece.
- **Fase 2.6 concluída:** WhatsAppModal e `POST/PUT /whatsapp` **não** mutam AI Agent. Autoridade única: Product connections (vínculo Off) + Product commands (modo). Erro `ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API`.
- **Fase 2.7 concluída:** Product Credentials em `/product/ai-agent/credentials*` + UI Hub/Wizard; ver `AI_AGENT_PRODUCT_CREDENTIALS_CONTRACT.md`. CRUD legado permanece para KB. Sem DELETE Product.
- **Próximo passo:** limpeza de órfãos; Knowledge Base Product
