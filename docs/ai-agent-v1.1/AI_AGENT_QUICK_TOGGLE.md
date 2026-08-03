# AI Agent — Toggle rápido no card (Fase 2.19)

## Objetivo

Permitir ativar e desativar um agente comercial diretamente no card do Hub `/ai-agent`,
sem abrir o detalhe, usando exclusivamente os commands oficiais da Product API com `agentRef`.

## Diferença entre estados

| Conceito | Campo / origem | Significado |
|---|---|---|
| Habilitado | `agent.enabled` | Toggle ligado/desligado |
| Modo operacional | `agent.operationMode` (`off` / `shadow` / `live` / `paused`) | Shadow vs Live vs off |
| Pronto | `agent.ready` + readiness Product | Pode tentar ativar |
| Status comercial | `agent.status` | Badges (setup, attention, active…) |
| Conexão | `connectionCount` + runtime WhatsApp | Vínculo e conectividade |

O toggle **não** usa apenas a cor do badge nem `readiness.status` como estado visual do switch.
O switch reflete **somente** `enabled`.

## Commands

| Ação | Command Product | Escopo |
|---|---|---|
| Ativar (padrão Product / shadow) | `activate_shadow` | `POST .../agents/:agentRef/commands` |
| Ativar live | `activate_live` | idem |
| Desativar | `deactivate` | idem |

Nenhuma rota legada é reaberta. Runtime / Orchestrator não são alterados.

## Preservação do modo operacional

O toggle **não** é seletor de modo.

Estratégia de ativação (`resolveAiAgentQuickActivateCommand`):

1. Memória de sessão SPA do último modo (`live`/`shadow`) gravada ao desativar pelo card;
2. Se `operationMode` ainda for `live` ou `shadow`, reutiliza esse modo;
3. Caso contrário, aplica a regra oficial Product quando `off`: **`activate_shadow`**.

Limitações:

- A memória de sessão não sobrevive a reload completo da página (sem migration / campo persistido);
- Após reload com agente desabilitado, a reativação usa `activate_shadow`;
- Live permanente após reload continua disponível em Detalhe / Configurações / commands comerciais.

## Ativação

1. Valida `canManageAiAgentProduct` no frontend;
2. Se `ready !== true`, **não** chama API: modal comercial + CTA “Revisar configuração”;
3. Se pronto, chama o command resolvido com `agentRef`;
4. Backend valida plano, tenant, readiness, provider, credencial, modelo, instruções e conexões;
5. Sem optimistic update definitivo: loading no toggle; estado final vem do refresh da lista;
6. Toast: “Agente ativado.”

## Desativação

1. Confirmação obrigatória;
2. Command `deactivate`;
3. Preserva configurações, conexões, Knowledge, credencial e histórico;
4. Interrompe apenas a operação automática (`enabled=false` + modo off nas conexões vinculadas);
5. Toast: “Agente desativado.”

## Permissões / supportMode

Usa `canManageAiAgentProduct`:

- Admin do tenant: sim;
- Super Admin em `supportMode`: sim;
- Super Admin fora do suporte no tenant alvo: não (sessão);
- Supervisor / User: somente leitura (toggle disabled).

Backend permanece autoridade final.

## Multiagente

- Cada card usa o próprio `agentRef`;
- `busyAgentRef` isola loading por agente;
- Erro/sucesso em A não altera B;
- `notifyAiAgentProductAgentsChanged` recarrega a listagem do Hub;
- Sem seleção implícita do primeiro agente.

## Cache e stale

- Após sucesso: `notifyAiAgentProductAgentsChanged` + `onRetry` (reload da lista);
- Sequência por `agentRef` ignora respostas stale;
- Detalhe continua sincronizado via mesma Product API / invalidação existente.

## Acessibilidade e mobile

- `aria-label` Ativar/Desativar agente;
- `aria-checked` / `aria-busy`;
- Labels “Ativo” / “Desativado”;
- Área de toque ≥ 44px;
- `stopPropagation` no toggle;
- Grid responsivo sem overflow horizontal.

## Arquivos principais

- `frontend/src/components/AiAgentCard/index.js`
- `frontend/src/components/AiAgentHubPage/index.js`
- `frontend/src/utils/aiAgentQuickToggle.js`
- `frontend/src/services/__tests__/aiAgentCardQuickTogglePhase219.test.js`
