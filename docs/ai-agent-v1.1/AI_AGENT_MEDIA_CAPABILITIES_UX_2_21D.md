# AI Agent — Media Capabilities UX (Fase 2.21D)

| Campo | Valor |
|-------|-------|
| **Fase** | 2.21D |
| **Status** | Implementado |
| **Migration** | Não |

## Causa

O backend já envia `supportsVision` / `supportsAudioTranscription` na Product options.
`normalizeModel()` no mapper do wizard descartava esses flags. O painel Inteligência
lia `=== true` e caía em “indisponível — modelo incompatível”.

## Correção

- Preservar flags no mapper.
- Visão: motivo = modelo.
- Áudio: motivo = pipeline/provider STT, não o modelo de chat.
- Registry canônica permanece `backend/src/config/aiModelMediaCapabilities.ts`.

## Resultado esperado (OpenAI + gpt-4o-mini)

Texto disponível · Imagens disponível · Áudio disponível.
