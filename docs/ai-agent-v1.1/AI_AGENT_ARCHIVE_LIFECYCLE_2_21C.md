# AI Agent — Arquivamento seguro (Fase 2.21C)

| Campo | Valor |
|-------|-------|
| **Fase** | 2.21C |
| **Status** | Implementado |
| **Migration** | Sim (`archivedAt` em `AiAgents`) — **não executada em produção nesta fase** |
| **Deploy** | Não |

## Modelo

- Campo: `AiAgent.archivedAt` (timestamp nullable)
- Sem `paranoid` / `deletedAt`
- Sem `AiAgent.destroy()`
- `agentRef` permanece o id; não é reutilizado

## Product API

`POST /product/ai-agent/agents/:agentRef/archive`

Não reabre `DELETE /ai-agents/:id` (410 legado intacto).

## Transação

1. Lock do AiAgent (companyId do JWT)
2. Recusa se já arquivado (409)
3. Recusa se `enabled=true` (409 — desative antes)
4. Desvincula WhatsApps **deste** agente: `aiAgentId=null`, `aiAgentEnabled=false`, `aiAgentMode=disabled`
5. Marca `archivedAt`
6. COMMIT (rollback em erro)

## Preservado

Messages, RuntimeLogs, SuggestionReviews, retrievals, analytics, simulator, SupportAccessLogs, knowledge bases company-scoped, credenciais.

JOIN agent↔knowledge: preservado (sem restore nesta fase).

## AgentOS

Archive Product **não** faz purge cross-system. Referências AgentOS sem FK permanecem; fora de escopo desta fase.

## UI

- Hub lista apenas `archivedAt IS NULL`
- Detail de arquivado: 404 `ERR_AI_AGENT_PRODUCT_ARCHIVED` → redirect Hub + toast
- Configurações → Zona de perigo → confirmação pelo nome (trim, case-sensitive)
- Agente ativo: orientação para desativar primeiro

## Runtime

Live, Shadow e `buildAiAgentRuntimeContext` ignoram agente com `archivedAt`.

## Permissões

Product: admin do tenant; Super Admin em supportMode. User/supervisor não.
Support write: `ai_agent.product.archive`.
