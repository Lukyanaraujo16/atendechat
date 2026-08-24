# AI Agent — Reconfiguração pelo assistente (Fase 2.21B)

| Campo | Valor |
|-------|-------|
| **Fase** | 2.21B |
| **Status** | Implementado |
| **Migration** | Não |

## CTA

- Rótulo: Reconfigurar agente
- Local: Visão geral do Detail (`AiAgentExperiencePage`)
- Hub: sem CTA extra (evita poluir o card)

## Rota

Reutiliza o wizard existente:

`/ai-agent/:agentRef/wizard`

Não cria agente novo. Preserva `id` / `agentRef`.

## Fluxo

- Agente desativado: abre o wizard com os dados atuais.
- Agente ativo (Live ou Shadow): modal de confirmação → command Product `deactivate` → só então abre o wizard.
- Falha ao desativar: toast, sem navegação, agente continua ativo.
- Abandonar o wizard: estado local; nenhuma alteração estrutural.
- Save somente na conclusão (PUT do agente atual).
- Não reativa automaticamente. Quick toggle usa o modo anterior (Live/Shadow) persistido no backend (Fase 2.19.1).

## Permissões

`canManageAiAgentProduct`: admin do tenant; Super Admin em supportMode. User/supervisor não.
