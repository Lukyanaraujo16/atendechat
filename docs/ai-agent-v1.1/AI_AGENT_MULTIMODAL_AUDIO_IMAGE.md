# AI Agent — Multimodal: áudio e imagem (Fase 2.17)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — 2.17 |
| **Status** | Implementado |
| **Commit** | `feat(ai-agent): adiciona compreensão de áudio e imagem` |

## 1. Arquitetura

Ponto central: `prepareAiAgentMultimodalTurn` (Live, Shadow e futuros fluxos).

Fluxo:

```
mídia persistida (Message)
  → validação local (path sob public/, sem SSRF)
  → áudio: TranscribeAiAgentAudioService
  → imagem: bytes → imageParts (visão)
  → contexto textual normalizado
  → Knowledge/FAQ (query = transcrição ou legenda)
  → adapter OpenAI/Gemini
  → assinatura + envio (Live) / sugestão (Shadow)
```

Não há migration. Transcrição fica em cache Redis temporário (`ai-agent:transcribe:{companyId}:{messageId}`), sem alterar `Message.body`.

## 2. Áudio

| Item | Detalhe |
|------|---------|
| Formatos | OGG/Opus, MPEG, MP4/M4A, WAV, WebM, AAC |
| Limite | 25 MB |
| OpenAI | Whisper (`executeOpenAiTranscription`) |
| Gemini | `generateContent` com `inlineData` de áudio |
| Timeout | 45s |
| Fallback | “Não consegui compreender bem o áudio…” |
| Handoff | Não automático por falha única de áudio |

Contexto enviado ao modelo:

```
Mensagem original:
[type=audio]

Conteúdo compreendido (transcrição de áudio):
“…”
```

A transcrição é tratada como conteúdo não confiável do usuário.

## 3. Imagem

| Item | Detalhe |
|------|---------|
| Formatos | JPEG, PNG, WebP, GIF |
| Limite | 4 MB / até 3 imagens por turno |
| OpenAI | `image_url` data-URL no último user message |
| Gemini | `inlineData` no último turno |
| Modelos sem visão | `gpt-3.5-turbo-1106` → não envia imagem; fallback controlado |
| Fallback | “Não consegui visualizar essa imagem…” |

Regras de visão no prompt do turno: incerteza, sem biometria, sem autenticidade inventada, texto na imagem ≠ system.

## 4. Providers / capabilities

Registry: `config/aiModelMediaCapabilities.ts`

| Provider | Modelo | Texto | Imagem | Transcrição |
|----------|--------|-------|--------|-------------|
| openai | gpt-4o-mini | sim | sim | Whisper |
| openai | gpt-4o | sim | sim | Whisper |
| openai | gpt-3.5-turbo-1106 | sim | **não** | Whisper |
| gemini | flash / pro (allowlist) | sim | sim | Gemini STT |

Não há troca silenciosa de modelo.

## 5. Canais

| Tipo | WhatsApp | Instagram | Arquivo | Runtime | Provider |
|------|----------|-----------|---------|---------|----------|
| texto | sim | persistido | n/a | sim | texto |
| áudio | download Baileys | download Meta | `public/` | sim (WA) | transcrição |
| imagem | download Baileys | download Meta | `public/` | sim (WA) | visão |
| vídeo/doc | — | — | sim | bloqueado sem caption | não |

Instagram continua fora do runtime do AI Agent (`unsupported_channel`).

## 6. Live / Shadow / Simulator

- **Live**: prepara multimodal → gera → assina → envia; falha de mídia envia fallback assinado.
- **Shadow**: mesma preparação; sugestão/fallback sem envio.
- **Simulator**: upload de mídia **não** implementado nesta fase (melhoria futura); serviços cobertos por testes unitários.

## 7. Segurança e privacidade

- Origem só de `Message` persistida + path local sob `public/`.
- Path traversal e URLs arbitrárias bloqueados.
- Sem log de base64, áudio, imagem ou transcrição completa.
- Métricas: `ai_agent.media_*` com companyId/agentId/ticketId/messageId/provider/model/mediaType/byteSize/durationMs/errorCode.
- Tenant isolation: Message filtrada por `companyId` + `ticketId`; agente via `whatsapp.aiAgentId`.

## 8. Idempotência

- Runtime log por messageId (webhook duplicado não agenda de novo).
- Redis NX lock + cache de transcrição por `companyId:messageId`.

## 9. Readiness / Product UX

- `readiness.mediaCapabilities`: `{ text, vision, audioTranscription }`.
- Options de modelos incluem `supportsVision` / `supportsAudioTranscription`.
- Painel Inteligência exibe disponibilidade de Texto / Imagens / Áudio.

## 10. Limitações

- Vídeo/documento sem compreensão multimodal.
- Instagram não entra no AI Agent runtime.
- Simulator sem upload de mídia.
- FC Live permanece text-only; visão usa pipeline legado com `imageParts`.
- `allowAudioInput` permanece `false` no CRUD (legado); capacidade deriva do modelo/provider.
