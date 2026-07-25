# AgentOS Route Matrix — Fase 1.3

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 1.3 |
| **Status** | Contrato de migração (não substitui Architecture Lock) |
| **Referência** | `docs/ai-agent-v1.1/ARCHITECTURE_LOCK.md` v1.0 (congelado) |

## Classificação

```ts
type RouteSurface =
  | "commercial_automation"
  | "commercial_ai_agent"
  | "commercial_compatibility"
  | "technical_agentos";
```

## Gate futuro (técnico)

```
isInternalUser === true
AND
platformPermissions inclui "agentOS.console.view"
AND
GET /technical-console/access → allowed
```

`supportMode` **não** autoriza. Features comerciais (`automation.ai_agent`, `automation.ai_tools`, `automation.knowledge_base`) **não** são entrada do Console.

## Matriz

| Rota atual | Componente | Classificação | Regra comercial atual | Gate futuro | Rota canônica futura | Alias temporário |
|------------|------------|---------------|----------------------|-------------|----------------------|------------------|
| `/flowbuilders` | FlowBuilder | commercial_automation | admin + `automation.chatbot` | — | — | — |
| `/flowbuilder/:id?` | FlowBuilderConfig | commercial_automation | admin + `automation.chatbot` | — | — | — |
| `/phrase-lists` | CampaignsPhrase | commercial_automation | admin + `automation.keywords` | — | — | — |
| `/queue-integration` | QueueIntegration | commercial_automation | admin + `automation.integrations` | — | — | — |
| `/ai-agent` | AiAgent | commercial_ai_agent | admin + `automation.ai_agent` + UI flag | — | — | — |
| `/ai-agent/wizard` | AiAgentWizardPage | commercial_ai_agent | idem + AiAgentRouteGuard | — | — | — |
| `/ai-agent/wizard/:agentId` | AiAgentWizardPage | commercial_ai_agent | idem | — | — | — |
| `/ai-agent/:agentId/simulator` | AiAgentSimulatorPage | commercial_ai_agent | idem | — | — | — |
| `/ai-agent/:agentId` | *(não existe rota dedicada)* | commercial_ai_agent | N/A — detalhe via listagem/wizard | — | — | — |
| `/prompts` | Prompts | commercial_compatibility | admin + `automation.openai` | — | — | — |
| `/knowledge-base` | KnowledgeBase | commercial_compatibility | admin + KB feature + UI | — | — | — |
| `/knowledge-base/:baseId` | KnowledgeBaseDetail | commercial_compatibility | idem | — | — | — |
| `/quick-messages` | QuickMessages | commercial_compatibility | `automation.quick_replies` | — | — | — |
| `/ai-agent/analytics` | AiAgentAnalyticsPage | technical_agentos | *antes:* admin + ai_agent + KB | Console | `/technical-console/agentos/analytics` | `/ai-agent/analytics` |
| `/ai-agent/shadow-fc` | AiAgentShadowFcPage | technical_agentos | *antes:* admin + ai_tools | Console | `/technical-console/agentos/shadow-fc` | `/ai-agent/shadow-fc` |
| `/automation/monitor` | AutomationMonitorPage | technical_agentos | *antes:* admin + ai_agent + KB | Console | `/technical-console/agentos/monitor` | `/automation/monitor` |
| `/automation/observability` | AutomationObservabilityPage | technical_agentos | idem | Console | `/technical-console/agentos/observability` | `/automation/observability` |
| `/automation/production` | AutomationProductionPage | technical_agentos | idem | Console | `/technical-console/agentos/production` | `/automation/production` |
| `/automation/tools` | AutomationToolsPage | technical_agentos | *antes:* admin + ai_tools | Console | `/technical-console/agentos/tools` | `/automation/tools` |
| `/automation/evidence` | AutomationEvidencePage | technical_agentos | ai_tools | Console | `/technical-console/agentos/evidence` | `/automation/evidence` |
| `/automation/live-rollout` | AutomationLiveRolloutPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/rollout` | `/automation/live-rollout` |
| `/automation/planning` | AutomationPlanningPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/planning` | `/automation/planning` |
| `/automation/plan-evaluation` | AutomationPlanEvaluationPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/evaluation` | `/automation/plan-evaluation` |
| `/automation/execution-sessions` | AutomationExecutionSessionsPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/execution-sessions` | `/automation/execution-sessions` |
| `/automation/action-execution` | AutomationActionExecutionPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/actions` | `/automation/action-execution` |
| `/automation/runtime-integration` | AutomationRuntimeIntegrationPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/runtime` | `/automation/runtime-integration` |
| `/automation/execution-feedback` | AutomationExecutionFeedbackPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/feedback` | `/automation/execution-feedback` |
| `/automation/cognitive-memory` | AutomationCognitiveMemoryPage | technical_agentos | ai_tools | Console | `/technical-console/agentos/memory` | `/automation/cognitive-memory` |
| `/automation/mcp-runtime` | AutomationMcpRuntimePage | technical_agentos | ai_tools (+ feature MCP na página) | Console | `/technical-console/agentos/mcp` | `/automation/mcp-runtime` |
| `/automation/learning-engine` | AutomationLearningEnginePage | technical_agentos | ai_tools (+ learning na página) | Console | `/technical-console/agentos/learning` | `/automation/learning-engine` |
| `/automation/multi-agent` | AutomationMultiAgentPage | technical_agentos | ai_tools (+ multi_agent na página) | Console | `/technical-console/agentos/multi-agent` | `/automation/multi-agent` |
| `/technical-console/agentos` | TechnicalConsoleLanding | technical_agentos | — | Console | `/technical-console/agentos` | — |

## Notas de classificação `/ai-agent/*`

### `/ai-agent/analytics`

Conteúdo misto: métricas/gaps de conhecimento (potencial comercial) + replay, health, prompt diff (técnico AgentOS).

**Decisão Fase 1.3:** `technical_agentos` (classificação dominante mais segura). Separação comercial futura documentada; página **não** reescrita nesta fase.

### `/ai-agent/shadow-fc`

Dashboard de Function Calling Shadow + evidências de avaliação shadow. **Claramente técnico** → `technical_agentos`.

### Demais `/ai-agent` (lista, wizard, simulador)

Permanecem `commercial_ai_agent`. Não recebem `agentOS.console.view`.

## Estratégia de alias (Fase 1.3)

1. URL antiga técnica → `AgentOsRouteGuard` → se allowed, `Redirect` para canônica preservando `search` e `hash`.
2. URL canônica → `AgentOsRouteGuard` → renderiza o mesmo componente lazy existente.
3. URLs antigas **não** removidas.

## Probe / cache

- Endpoint: `GET /technical-console/access`
- Uma chamada por `userId` por ciclo de sessão em memória (promise compartilhada)
- Sem polling; sem cache persistente (`localStorage`)
- Revogação efetiva: reload completo ou mudança de usuário; remount com cache de sessão pode manter denied/allowed até reload
- Campos serializados (`isInternalUser`, `platformPermissions`): menu + early-deny + loading; **não** liberam conteúdo sem probe

## Escopo backend (pendente — Fase 1.4)

Proteção em massa de `/automation/*` APIs **não** feita nesta fase. Ver relatório da Fase 1.3.
