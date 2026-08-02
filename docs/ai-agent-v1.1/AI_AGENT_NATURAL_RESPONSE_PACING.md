# AI Agent — Natural Response Pacing e indicador “digitando” (Fase 2.18)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — 2.18 |
| **Status** | Implementado |
| **Commit** | `feat(ai-agent): adiciona ritmo natural e indicador de digitação` |

## 1. Objetivo

Tornar a resposta do AI Agent mais natural no WhatsApp:

1. mostrar o indicador real “digitando…” no canal do cliente;
2. aplicar ritmo (pacing) proporcional ao conteúdo, descontando o tempo já gasto;
3. evitar resposta instantânea mecânica sem criar atrasos excessivos;
4. preservar assinatura, tom, multimodal e handoff seguro;
5. **não** afirmar que o agente é humano — se perguntado, continua sendo o assistente virtual da empresa.

## 2. Auditoria do typing legado

| Fluxo | Inicia typing | Para typing | Delay | Serviço |
|-------|---------------|-------------|-------|---------|
| Chatbot / flows | `composing` / `recording` | `paused` após 5s fixos | `delay(5000)` bloqueante | `typeSimulation` em `SendWhatsAppMediaFlow` |
| Typebot | `presenceSubscribe` + `composing` | `paused` | delay do Typebot | `typebotListener` |
| Atendimento humano | (canal nativo do device) | — | — | fora do AI Agent |
| AI Agent Live (antes) | não | — | — | — |
| AI Agent Live (2.18) | `composing` ao claim | `paused` no `finally` | pacing restante | `startAiAgentTypingPresence` + `calculateAiAgentResponsePacing` |
| Handoff Live | mantém typing | após transição | pacing `handoff` | mesma sessão de presence |
| Shadow | **não** | — | — | sem presence falsa |
| Simulator | **não** | — | preview só | `pacingPreview` em metadata |

O AI Agent **não** reutiliza `typeSimulation` (bloqueia 5s e não renova). Reutiliza a mesma infraestrutura de canal: `GetTicketWbot`, `getTicketRemoteJid`, `sendPresenceUpdate`, flag `isWhatsAppDisableAllReadAndPresenceSideEffects`.

## 3. Typing real (WhatsApp)

Helper: `startAiAgentTypingPresence`

- inicia `composing` no JID do ticket/contato;
- renova a cada ~3,5s (Baileys/WhatsApp expira composing rapidamente);
- teto de segurança: 60s → `paused` automático;
- `stop()` idempotente → `paused` + clear de timers;
- falha ao iniciar **não** bloqueia a resposta;
- valida `ticket.whatsappId === whatsapp.id` (não escolhe conexão arbitrariamente);
- Instagram: fora de escopo (`unsupported_channel` na 2.17).

## 4. Fórmula de pacing

Serviço: `calculateAiAgentResponsePacing`

```
target ≈ base(bucket|kind) + componente_leve_por_caracteres (só normal)
target = clamp(min absoluto, max absoluto)  // normal / handoff
remainingDelay = max(0, targetComJitter − processingDurationMs)
```

| Bucket / kind | Alvo de referência |
|---------------|--------------------|
| curto (≤80 chars) | ~2,5s |
| médio (≤250) | ~4s |
| longo | ~6,5s |
| mínimo absoluto | 1,5s |
| máximo geral | 9s |
| handoff | ~3s |
| fallback técnico | ~1,2s |
| error | ~0,8s |

- **Jitter:** ±500ms (normal/handoff); ±200ms (fallback/error). Injetável via `jitterRng` nos testes.
- **Provider lento conta:** se o provider já levou 2,8s e o alvo é 4s, aguarda ~1,2s — não soma delays.
- Não há streaming falso nem envio palavra a palavra.

## 5. Live

Ordem:

1. claim / lock / idempotência
2. **iniciar typing**
3. multimodal → Knowledge → provider
4. assinar / validar
5. **calcular atraso restante** → aguardar
6. enviar (ou handoff com transição)
7. **parar typing** (`finally`)

Webhook duplicado não passa do claim → não inicia segundo typing efetivo de envio. Cleanup sempre no `finally`.

## 6. Shadow

Shadow **não** envia mensagem ao cliente e **não** mostra “digitando”. Presence falsa é proibida. Typing só entraria se um fluxo oficial futuro converter sugestão em envio automático Live.

## 7. Simulator

Não executa presence real nem aguarda o delay completo. Grava `metadata.pacingPreview` com buckets/tempos e `appliedInSimulator: false` para inspeção.

## 8. Multimodal (áudio / imagem)

Typing começa **antes** de transcrição, visão e provider. O tempo real de Whisper/Gemini/visão/Knowledge entra em `processingDurationMs` e é descontado do pacing. Cleanup se mídia falhar (fallback com pacing curto + `finally`).

## 9. Handoff

1. typing permanece ativo;
2. mensagem de transição construída e assinada;
3. pacing `handoff` (curto);
4. envio da transição;
5. transferir;
6. typing encerrado no `finally`.

Se a transição falhar: typing para; não transferir silenciosamente (contrato 2.16).

## 10. Concorrência e cancelamento

- Chave por `executionId` / ticket / lock Redis existente.
- Sessions de presence são locais ao handle (não há registry global que cancele outro ticket).
- Cancelamento efetivo: eligibility re-check (humano assumiu, agente off, ticket fechado) → return early → `finally` para typing; resposta antiga não envia se claim/eligibility falhar.

## 11. Falhas

| Falha | Comportamento |
|-------|----------------|
| iniciar presence | log `typing_failed`; segue resposta |
| renovar / paused | log; timers limpos no stop |
| provider / envio | typing no `finally`; contrato Live atual |
| WhatsApp offline | started=false; resposta tenta envio normal |

## 12. Observabilidade

Eventos sanitizados (sem texto/prompt/tokens/credenciais):

- `ai_agent.typing_started|renewed|stopped|failed`
- `ai_agent.pacing_calculated|pacing_wait_completed|pacing_cancelled`

Campos: `companyId`, `ticketId`, `agentId`, `whatsappId`, `executionId`, durações, `responseLengthBucket`, `reason`, `result`.

## 13. Configuração / UX

Nesta fase: política central “Natural” em código. Sem migration, sem campo de banco.

Melhoria futura (Product UX): Instantânea / Natural / Mais pausada — ou min/max amigáveis, sem expor ms técnicos sem necessidade.

## 14. Transparência

Ritmo natural **não** significa fingir ser humano. Perguntas sobre identidade continuam respondidas como assistente virtual da empresa (regras de tom/assinatura das fases anteriores).

## 15. Limitações

- Instagram: fora de escopo.
- Grupos: JID via `isGroup` / remoteJid quando disponível; AI Agent Live já restringe elegibilidade de grupos conforme runtime atual.
- Presence depende do adapter Baileys; se `sendPresenceUpdate` ausente, typing é skipped sem bloquear.
- Sem personalização por agente no banco nesta fase.
