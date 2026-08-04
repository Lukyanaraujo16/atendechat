# AI Agent — Multimodal: áudio e imagem (Fase 2.17 + 2.20 + 2.20.1)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — 2.17 / 2.20 / 2.20.1 |
| **Status** | Implementado |
| **Commit 2.17** | `feat(ai-agent): adiciona compreensão de áudio e imagem` |
| **Commit 2.20** | `fix(ai-agent): corrige transcrição de áudio no Live` |
| **Commit 2.20.1** | `fix(ai-agent): corrige processamento real de áudio do WhatsApp` |

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
| Formatos | OGG/Opus (incl. `.oga`), MPEG, MP4/M4A, WAV, WebM, AAC |
| MIME | Normalizado (strip `codecs=…`; `application/ogg` → `audio/ogg`) |
| Limite | 25 MB |
| OpenAI | Whisper (`executeOpenAiTranscription`) com filename compatível |
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

### Correção 2.20 (produção)

Sintoma: áudio no Live iniciava “digitando…”, processava ~30–40s, encerrava typing **sem** resposta e **sem** fallback.

Causa raiz: no fallback de mídia, `claimLiveSending` exige `liveStatus=generated`, mas o log ainda estava `queued` → claim falhava e o cliente não recebia nada.

Correção: antes do claim de envio, o Live grava `GENERATED` + `suggestionSource=media_fallback` e só então faz o claim `SENDING`.

### Correção 2.20.1 (transcrição real)

Sintoma pós-2.20: fallback chega ao cliente, mas áudios válidos do WhatsApp ainda caem no fallback.

Causas técnicas confirmadas:

1. **Multipart quebrado (regressão 2.20):** sobrescrever `stream.path` com apenas o basename faz o `form-data` tentar `open()`/`stat()` nesse path relativo → `ENOENT` e falha da Whisper.
2. **Persistência WhatsApp:** `Buffer.from(media.data, "base64")` sobre Buffer já binário do Baileys era frágil; download falho ainda criava Message sem arquivo.

Correções:

- Whisper via `FormData.append(file, { filename, contentType, knownLength })` **sem** alterar `stream.path`;
- `coerceWhatsAppMediaBuffer` + falha explícita se write/download falhar;
- códigos técnicos distinguíveis (`audio_provider_auth_failed`, `audio_file_missing`, …) nos logs;
- inspeção por magic bytes (OggS, etc.);
- script local `diagnoseAiAgentAudioTranscription.ts` (exige `AI_AGENT_AUDIO_DIAG=1`, não é HTTP).

Fallback comercial permanece; logs mostram a causa técnica real.

**Conversão ffmpeg:** não necessária — Whisper aceita OGG/Opus do WhatsApp quando o multipart está correto.

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

> Fase 2.20 não altera o pipeline de imagem, salvo helpers MIME compartilhados.

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
| áudio | download Baileys | download Meta | `public/` (ex. `.oga`) | sim (WA) | transcrição |
| imagem | download Baileys | download Meta | `public/` | sim (WA) | visão |
| vídeo/doc | — | — | sim | bloqueado sem caption | não |

Instagram continua fora do runtime do AI Agent (`unsupported_channel`).

## 6. Live / Shadow / Simulator

- **Live**: prepara multimodal → gera → assina → envia; falha de mídia envia fallback assinado (após `GENERATED` → `SENDING`).
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
