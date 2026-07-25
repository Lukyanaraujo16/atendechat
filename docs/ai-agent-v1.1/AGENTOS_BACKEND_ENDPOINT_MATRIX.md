# AgentOS Backend Endpoint Matrix — Fase 1.4

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 1.4 + hardening 1.4.1 |
| **Status** | Contrato de proteção backend + ownership por entidade |
| **Referência** | Architecture Lock v1.0 (congelado) + AGENTOS_ROUTE_MATRIX.md |

## Classificação

```ts
type BackendSurface =
  | "commercial"
  | "technical_read"
  | "technical_write"
  | "shared"
  | "internal_runtime";
```

## Gate de plataforma (entrada técnica)

```
isAuth
→ isInternalUser + agentOS.console.view
→ tenant context (empresa da sessão; rejeita companyId arbitrário)
→ features de plano do tenant (capacidade; após tenant ativo)
→ mutation gate (chave específica em writes / GET replay)
→ confirmation (ops sensíveis)
→ controller
→ ownership HTTP (quando store Orchestrator não filtra por companyId)
```

`supportMode` **não** autoriza. Fornece apenas `companyId` ativo após o grant.

**Features / internos:** `requireEffectiveModule` trata `isInternalUser` como `isPlatformSuperUser` e **bypassa** feature de plano. Entrada no Console = identidade interna + `console.view`. Capacidades comerciais do tenant não bloqueiam o Console. Ordem intencional pós-1.4.1: tenant **antes** da feature (empresa ativa correta em supportMode, se feature for avaliada para não-interno).

## Contagens exatas (auditoria 1.4.1)

Inventário por declaração de rota (sem “aprox.”).

| Classificação | Qtd | Escopo |
|---------------|-----|--------|
| commercial | **25** | `/ai-agents` CRUD, profile, simulator, shadow-suggestions, KB attach/settings/retrieval |
| technical_read | **157** | 143 GET `/automation/*` + 14 GET analytics/shadow-evaluations |
| technical_write | **155** | 148 mutações `/automation/*` (incl. 2 GET replay com side-effect: execution/mcp) + 7 mutações analytics/shadow-fc |
| shared | **0** | nenhum endpoint HTTP com consumidor comercial **e** técnico |
| internal_runtime | **0** (HTTP) | Shadow/Live/inbound **não** são rotas deste inventário |

| Subconjunto | read | write | total |
|-------------|------|-------|-------|
| 16× `automation*Routes` | 143 | 148 | **291** |
| `aiAgentRoutes` técnico | 14 | 7 | **21** |
| `aiAgentRoutes` comercial | — | — | **25** |
| HTTP técnico total | 157 | 155 | **312** |
| HTTP auditado (técnico + comercial) | | | **337** |

Classificação **não** é por prefixo `/automation/*`: cada router aplica `agentOsStacks` por grupo; analytics/shadow-fc usam `techRead`/`techManage` em `aiAgentRoutes`. Runtime automático não entra neste HTTP.

## Política de permissões

| Superfície | Permissão |
|------------|-----------|
| technical_read | `agentOS.console.view` |
| technical_write genérico | view + `agentOS.console.manage` |
| replay (GET/POST path `/replay`) | view + `agentOS.replay.execute` |
| rollout / live settings / kill-switch | view + `agentOS.rollout.manage` |
| production emergency / hydrate | view + `agentOS.production.manage` |
| incident ack/resolve | view + `agentOS.incidents.manage` |

## Stack alterado

`agentOsAdminStack` (antes: `requireTenantAdminOrSupport`) agora usa:

- `requireAgentOsConsole`
- `requireAgentOsTenantContext`
- `requireAgentOsMutationGate`

Arquivo legado `requireAgentOsPermission.ts` (RBAC admin tenant) **não** é mais usado nas rotas production; mantido no repo por compatibilidade de imports/testes históricos.

## Matriz por módulo

### automationOrchestratorRoutes

| Método | Rota | Classificação | Permissão futura | Ação Fase 1.4 |
|--------|------|---------------|------------------|---------------|
| GET | `/automation/orchestrator/dashboard` | technical_read | console.view | stack Console |
| GET | `/automation/orchestrator/executions` | technical_read | console.view | stack |
| GET | `/automation/orchestrator/executions/:id` | technical_read | console.view | stack |
| GET | `/automation/orchestrator/executions/:id/replay` | technical_write | replay.execute | mutation gate |
| POST | `/automation/orchestrator/executions/:id/continue` | technical_write | console.manage | mutation gate |
| GET | `/automation/orchestrator/actions` | technical_read | console.view | stack |
| POST | `/automation/orchestrator/simulate` | technical_write | console.manage | mutation gate |
| GET/PUT | `/automation/orchestrator/settings` | read / write | view / manage | stack + gate |
| GET | `/automation/orchestrator/validations` | technical_read | console.view | stack |
| GET | `/automation/orchestrator/activation-metrics` | technical_read | console.view | stack |

Consumidores: páginas Automation* / monitor (frontend técnico). Runtime automático **não** passa por estas rotas.

### automationObservabilityRoutes / Scalability / Evidence / Tools

Todos os paths `/automation/observability/*`, `/automation/scalability/*`, `/automation/evidence/*`, `/automation/tools/*`:

- GET → technical_read (console.view)
- POST/PUT → technical_write (manage; replay paths → replay.execute)

### automationLiveRolloutRoutes / automationProductionRoutes

| Grupo | Classificação | Permissão write |
|-------|---------------|-----------------|
| GET production/rollout/incidents/readiness | technical_read | view |
| POST rollout/* / live kill / live settings | technical_write | rollout.manage |
| POST emergency-stop / hydrate | technical_write | production.manage |
| POST incidents ack/resolve | technical_write | incidents.manage |

### Planning / Execution / Actions / Runtime / Feedback / Memory / MCP / Learning / Multi-Agent

Consumidores exclusivos das páginas técnicas do Console (Fase 1.3). Classificados como technical_read/write conforme método. Mutation gate cobre writes. **Não** são runtime automático de mensagens.

### aiAgentRoutes — técnico

| Método | Rota | Classificação | Ação 1.4 |
|--------|------|---------------|----------|
| GET | `/ai-agents/analytics/*` | technical_read | requireAgentOsConsole |
| PATCH/POST | gaps/suggestions/prompt-diff | technical_write | + console.manage |
| GET | `/ai-agents/shadow-evaluations*` | technical_read | Console |
| PUT | `/ai-agents/shadow-fc/*` | technical_write | + manage |
| PUT | `/ai-agents/:id/shadow-fc/setting` | technical_write | + manage |

### aiAgentRoutes — comercial (preservado)

| Rotas | Classificação | Gate |
|-------|---------------|------|
| `/ai-agents` CRUD, profile, simulator, KB attach | commercial | isAuth + automation.ai_agent (+ KB) |
| `/ai-agents/shadow-suggestions*` | commercial | isAuth + ai_agent (revisão operacional) |

### internal_runtime (não gateado por Console)

- Workers / filas AgentOS
- Processamento inbound Shadow/Live
- Webhooks WhatsApp
- Sockets
- Jobs de execução automática

Estes **não** usam `agentOsAdminStack` nem sessão humana de Console.

## Tenant context

Helper: `resolveRequestCompanyContext(req)`

- Fonte: `req.user.companyId` (sessão; em supportMode = tenant ativo)
- Rejeita `query/body.companyId` ≠ sessão → `ERR_AGENTOS_TENANT_ACCESS_DENIED`
- Sem empresa → `ERR_AGENTOS_TENANT_CONTEXT_REQUIRED`
- **Não basta sozinho:** ownership por entidade é obrigatório quando o service faz lookup só por ID

## Ownership por entidade (1.4.1)

Helper HTTP: `backend/src/helpers/agentOsTenantOwnership.ts`  
(`assertRecordOwnedByCompany`, `filterRecordsOwnedByCompany`, índice `actionId` por tenant)

| Endpoint | ID recebido | Entidade | Como companyId é validado | Cross-tenant bloqueado? | Evidência |
|----------|-------------|----------|---------------------------|-------------------------|-----------|
| `GET /automation/execution/sessions/:id` | sessionId | execution session | `find(companyId, id)` no store tenant-keyed | Sim | Orchestrator `GetExecutionSessionService` |
| `GET /automation/actions/results/:id` | actionId | action result | índice HTTP `assertCompanyOwnsActionId` (store global sem companyId) | Sim | `agentOsTenantOwnership` + controller |
| `GET /automation/feedback/:id` | feedbackId | feedback | `assertRecordOwnedByCompany` pós-fetch | Sim | controller filter/assert |
| `GET /automation/runtime/requests/:id` | requestId | runtime request | `assertRecordOwnedByCompany` pós-fetch | Sim | controller filter/assert |
| `GET /automation/evidence/reports/:id` | evidenceId | evidence report | `where: { id, companyId }` | Sim | `GetEvidenceReportService` |
| `GET /automation/memory/:id` | memoryId | memory object | `engine.get(companyId, id)` | Sim | `GetMemoryService` |
| `PUT /automation/live/agents/:agentId` | agentId | AiAgent → live setting | `AiAgent.findOne({ id, companyId })` antes do service | Sim | `AutomationLiveRolloutController.agentSetting` |
| `PUT /automation/live/connections/:whatsappId` | whatsappId | Whatsapp | `Whatsapp.findOne({ id, companyId })` no service | Sim | `UpsertLiveFcConnectionSettingService` |
| `GET/POST /automation/incidents/:id*` | incidentId | incident | pós-fetch exige `companyId` estrito (= sessão); `null` negado | Sim | controller assert (Orchestrator aceitava `null`) |
| `GET /ai-agents/shadow-evaluations/:id` | id | shadow evaluation | service com `companyId` | Sim | `GetShadowEvaluationService` |
| analytics replays / agents | id | analytics rows | services com `companyId` da sessão | Sim | AiAgentAnalytics* |

Cadeia sem `companyId` próprio: action results (store global) → ownership via índice preenchido em execute/replay/simulate do mesmo processo.

## Prova de shared = 0

Buscas: `axios`, `api.get/post/put/delete`, `/automation/`, `/ai-agents/` em frontend, backend workers, queues, sockets, webhooks, testes, cron.

| Superfície | Consumidor de `/automation/*` | Dados equivalentes comerciais |
|------------|-------------------------------|-------------------------------|
| Console / páginas `Automation*` + `AiAgentShadowFc` (evidence) | `frontend/src/services/automation*Api.js` | N/A — só técnico |
| Produto comercial (Agente de IA) | **não** chama `/automation/*` | `/ai-agents` CRUD, simulator, shadow-suggestions, KB |
| FlowBuilder / KB / Prompts | sem hits `/automation/` | APIs próprias |
| Runtime Shadow/Live | `wbotMessageListener` → services (não HTTP admin) | inbound automático |
| Workers/queues AgentOS | internos Orchestrator | não reutilizam controllers HTTP do stack |

Nenhum endpoint HTTP auditado tem consumidor comercial **e** técnico simultâneo → **shared = 0**.

## Aplicação do `agentOsAdminStack`

- **Não** no router Express global.
- **Por grupo de rotas:** cada `automation*Routes.ts` espalha `...agentOsStacks.*( )` em cada rota (16/16).
- Nenhum `/automation/*` HTTP fora do stack.
- Nenhum handler comercial nem runtime automático dentro desses routers.
- Analytics/shadow-fc: stack paralelo `techRead`/`techManage` (mesmos gates Console + tenant).

## Aliases backend canônicos

Nesta fase **não** foram criados `/technical-console/agentos/*` no backend.

Rotas `/automation/*` existentes permanecem como aliases protegidos (mesmo stack). Remoção futura: após shell Console estável (Fase 1.5+) e migração do frontend services.

## Auditoria de escrita

Log estruturado pino: `event=agentos.technical_write` com userId, permissionKey, companyContextId, route, targetId, status, duration. Sem credenciais/payloads/PII.

Persistência em tabela dedicada: **dívida** — fase futura se necessário (SupportAccessLog é só support mode).

## Endpoints comerciais / Flow / KB / Prompts

Não alterados nesta fase (fora do stack AgentOS Console).

## RBAC legado

`requireAgentOsPermission.ts` (admin tenant) **não** é importado por rotas técnicas atuais. Código legado / docs AgentOS antigos. Não confundir com `requirePlatformPermission` / `agentOS.*`.
