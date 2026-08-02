# AI Agent — Identidade pública, assinatura e transição segura (Fase 2.16)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — 2.16 |
| **Status** | Implementado |
| **Commit** | `feat(ai-agent): adiciona assinatura e transição segura` |

## 1. Identidade pública

- Campo canônico: **`AiAgent.name`** (etapa Identificação / Product identity).
- Não há segundo campo de assinatura.
- `AiAgentProfile.attendantName` permanece no prompt guiado; a assinatura determinística usa `AiAgent.name`.
- Fallback se o nome estiver vazio/branco: `Assistente`.

## 2. Formato da assinatura

```
Eduardo:
Olá! Como posso ajudar?
```

Helper: `formatAiAgentSignedMessage({ agentName, content })`.

- Uma assinatura no início;
- dedupe se o modelo já prefixou `Nome:` ou `*Nome*:`;
- sanitização de quebras;
- **não** altera mensagens humanas (`MessageInput` continua com `*user.name:*\n`).

### Decisão multi-parte / streaming

Assinar **apenas a primeira** mensagem do conjunto enviado. Fragmentos seguintes não repetem o nome. (Hoje o Live envia uma mensagem por geração.)

## 3. Onde a assinatura é aplicada

Ponto final: `sendAiAgentWhatsappMessage` (antes de WhatsApp + persistência).

Também:

- transição de handoff (`executeAiAgentHandoffWithTransition`);
- Simulator (conteúdo assistente persistido já assinado).

Não depender do modelo lembrar o prefixo.

## 4. Transparência

- Pode usar o nome comercial e conversar naturalmente.
- Não afirmar ser humano.
- Se perguntado se é IA/bot/pessoa: informar que é o **assistente virtual da empresa**.
- Não inventar cargo, sobrenome ou biografia.

## 5. Vocabulário de transferência

Proibido ao cliente (diferenciação do próximo atendente):

- humano / atendente humano / pessoa real / operador humano;
- bot / robô / inteligência artificial / sair da IA (quando só para contrastar).

Preferir: outro atendente, atendente da equipe, setor responsável.

## 6. Mensagem obrigatória pré-transferência

Ordem:

1. decidir handoff;
2. construir transição (`buildAiAgentHandoffTransitionMessage`);
3. assinar;
4. persistir/enviar;
5. **somente então** `applyAiAgentHandoffToTicket`;
6. logs `ai_agent.handoff_*`.

Se o envio falhar → **não** transferir (bloqueia transferência silenciosa).

Idempotência: `ticket.aiAgentHandoffRequested` + claim de envio do Live log.

## 7. Causas corrigidas

| Problema | Causa | Correção |
|----------|-------|----------|
| “atendente humano” | Prompt `HANDOFF_RULES` e labels de profile | Vocabulário novo + sanitize |
| Transferência silenciosa | Handoff em resposta inválida/vazia ou após send fail sem mensagem | `executeAiAgentHandoffWithTransition` exige envio OK |

## 8. Tons (2.15)

A transição respeita formal / professional / friendly / casual / custom **sem** anular os requisitos obrigatórios.

## 9. Canais

- Live atual: WhatsApp via `SendWhatsAppMessage`.
- Instagram: mesmo contrato de texto se o transporte compartilhado for usado; sem mudança de transportadores.

## 10. Áreas protegidas

Orchestrator: apenas passa `agent` ao safety handoff (sem reescrita).  
Sem migration. Runtime de elegibilidade preservado (`whatsapp.aiAgentId`).

## 11. Logs sanitizados

- `ai_agent.message_signed`
- `ai_agent.handoff_decided`
- `ai_agent.handoff_transition_sent`
- `ai_agent.handoff_completed`
- `ai_agent.handoff_failed`

Sem texto completo do cliente, prompt, secrets.
