# AI Agent — Toggle rápido no card (Fase 2.19 / 2.19.1)

## Objetivo

Permitir ativar e desativar um agente comercial diretamente no card do Hub `/ai-agent`,
sem abrir o detalhe, usando exclusivamente os commands oficiais da Product API com `agentRef`.

## Diferença entre estados

| Conceito | Campo / origem | Significado |
|---|---|---|
| Habilitado | `agent.enabled` | Toggle ligado/desligado; gate principal do Runtime |
| Modo operacional | `operationMode` (derivado de `Whatsapp.aiAgentMode`) | Shadow vs Live |
| Pronto | `agent.ready` + readiness Product | Pode tentar ativar |
| Status comercial | `agent.status` | Badges (setup, attention, active, ready_to_activate…) |
| Conexão | `connectionCount` + runtime WhatsApp | Vínculo e conectividade |

O switch reflete **somente** `enabled`.
O modo Live/Shadow permanece visível mesmo com o agente desativado (“Último modo: …”).

## Persistência do modo (Fase 2.19.1)

**Backend é a autoridade.** Não há memória SPA, `localStorage` nem campo novo.

Estratégia A (sem migration):

1. Ao **desativar** (`deactivate`):
   - `AiAgent.enabled = false`
   - `Whatsapp.aiAgentEnabled = false`
   - **`Whatsapp.aiAgentMode` permanece `live` ou `shadow`**
   - `aiAgentId` preservado
2. Ao **reativar**:
   - Hub lê `operationMode` retornado pela Product API
   - chama `activate_live` ou `activate_shadow` conforme o modo persistido
3. Após reload, logout/login, outro navegador ou outro administrador:
   - o modo continua nas conexões WhatsApp
   - a listagem Product deriva `operationMode` desse estado

### Relação `enabled` × `operationMode`

Exemplo Live:

| Momento | enabled | operationMode | Runtime |
|---|---|---|---|
| Ativo | true | live | pode operar |
| Desativado | false | live | **não** opera (`AI_AGENT_DISABLED`) |
| Reativado | true | live | opera em Live |

Exemplo Shadow: análogo com `shadow` / `activate_shadow`.

### Agente legado sem modo anterior

Se `operationMode` for `off` (nunca ativado ou desativado antes da 2.19.1):

- o toggle **não** escolhe Shadow silenciosamente;
- abre diálogo: modo de testes **ou** atendimento automático.

## Commands

| Ação | Command Product | Escopo |
|---|---|---|
| Ativar (modo preservado live) | `activate_live` | `POST .../agents/:agentRef/commands` |
| Ativar (modo preservado shadow) | `activate_shadow` | idem |
| Desativar | `deactivate` | idem |

Nenhuma rota legada é reaberta. Runtime / Orchestrator não são alterados estruturalmente.

## Readiness

Com setup completo, `enabled=false` e modo `live`/`shadow` preservado:

- status: `ready_to_activate` (não `attention_required`, não `active`)
- nextAction: `activate_live` ou `activate_shadow` conforme o modo

## Runtime

O Orchestrator já nega elegibilidade quando `!agent.enabled` (`AI_AGENT_DISABLED`),
mesmo se `aiAgentMode` permanecer `live`/`shadow`. Live e Shadow generation também checam `agent.enabled`.

## Permissões / supportMode

Usa `canManageAiAgentProduct` (admin do tenant; Super Admin em `supportMode`).
Backend permanece autoridade final.

## Multiagente

Cada card usa o próprio `agentRef` e o próprio `aiAgentMode` nas conexões vinculadas.
Comercial Live e Financeiro Shadow preservam modos independentemente.

## Arquivos principais

- `backend/.../ExecuteAiAgentProductCommandService.ts`
- `backend/.../AgentReadinessService.ts`
- `frontend/src/components/AiAgentCard/index.js`
- `frontend/src/hooks/useAiAgentHubQuickToggle.js`
- `frontend/src/utils/aiAgentQuickToggle.js`
