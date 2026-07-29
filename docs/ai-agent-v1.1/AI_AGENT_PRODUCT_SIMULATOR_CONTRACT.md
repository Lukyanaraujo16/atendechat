# AI Agent Product Simulator — Contrato (Fase 2.5)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 2.5 |
| **Status** | Implementado |
| **Referência normativa** | `ARCHITECTURE_LOCK.md` v1.0 (**congelado** — não alterado) |
| **API contract pai** | `AI_AGENT_PRODUCT_API_CONTRACT.md` |

---

## 1. Namespace

```
/product/ai-agent/simulator/*
```

Rota UI canônica: `/ai-agent/simulator`
Rota UI legada (redirect): `/ai-agent/:agentId/simulator` → canônica (ignora `agentId`)

Endpoints legados `/ai-agents/:id/simulator/*` **permanecem** intactos para Console/fallback técnico.

---

## 2. Endpoints

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/product/ai-agent/simulator` | isAuth + requireAiAgentProductView | Bootstrap |
| POST | `/product/ai-agent/simulator/sessions` | idem | Cria sessão |
| GET | `/product/ai-agent/simulator/sessions` | idem | Lista sessões |
| GET | `/product/ai-agent/simulator/sessions/:sessionRef` | idem | Detalhe + mensagens |
| POST | `/product/ai-agent/simulator/sessions/:sessionRef/messages` | idem | Envia mensagem |
| POST | `/product/ai-agent/simulator/sessions/:sessionRef/end` | idem | Encerra sessão |
| POST | `/product/ai-agent/simulator/messages/:messageRef/review` | idem | Avalia resposta |

`companyId` / `agentId` / `aiAgentId` **proibidos** em body/query/params → `ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID`.

---

## 3. Bootstrap (`GET /product/ai-agent/simulator`)

```json
{
  "available": true,
  "reason": null,
  "agentScope": { "type": "single", "count": 1 },
  "agent": {
    "name": "Bot",
    "description": null,
    "status": "ready_to_activate",
    "mode": "off"
  },
  "capabilities": { "canSimulate": true, "canReview": true },
  "provider": { "label": "OpenAI", "modelLabel": "gpt-4o-mini" },
  "scenarioSegment": "retail",
  "sessions": []
}
```

### Reasons (`available: false`)

| reason | Quando |
|--------|--------|
| `not_created` | Zero agentes na empresa |
| `ambiguous` | Mais de um agente |
| `credential_not_selected` | Sem `aiProviderCredentialId` (company_default **não** habilita) |
| `credential_disabled` | Credencial vinculada desabilitada |
| `provider_unsupported` | Provider não suportado comercialmente |
| `model_incompatible` | Modelo incompatível com o provider |
| `simulator_not_configured` | Fallback genérico |

### `canSimulate`

Usa **credencial vinculada** + `resolveAiAgentProductProviderCompatibility` (mesmo critério de readiness 2.3.2).
**Não** usa `resolveAiAgentApiCredentialForSimulation` (que faz fallback `company_default`).

---

## 4. Refs opacas

| Entidade | Formato |
|----------|---------|
| Sessão | `sim_s_{id}` |
| Mensagem | `sim_m_{id}` |

Serializers comerciais **sem**: `agentId`, `companyId`, `credentialId`, `apiKey`, `systemPrompt`, tokens breakdown, FC traces, `promptTokens`, `reviewedBy`.

### Session

`ref`, `status`, `providerLabel`, `modelLabel`, `messageCount`, `startedAt`, `endedAt`, `averageResponseTimeMs`, `messages?`

### Message

`ref`, `role`, `content`, `createdAt`, `responseTimeMs` (de `latencyMs`), `handoffSuggested`, `review`

### Review

`rating`, `tags`, `note`, `reviewedAt`

---

## 5. Mutações

Create / send / end / review exigem contexto `single` + `canSimulate`.
Send **nunca** passa `functionCalling`.
Erros legado mapeados para `ERR_AI_AGENT_PRODUCT_SIMULATOR_*`.

Fluxo:

```
Controller (Product)
  → assert access + resolve agent (Experience)
  → gate canSimulate (linked credential)
  → AiAgentSimulationService (legado, interno)
  → serializeAiAgentProductSimulator*
```

---

## 6. Frontend

- Client: `aiAgentProductApi.js` (namespace `/product/ai-agent/simulator`)
- Hook: `useAiAgentProductSimulator`
- Página: `pages/AiAgentSimulator` — Product API only
- Sem toggle Function Calling
- CTA wizard/hub em estados unavailable

---

## 7. Fora de escopo

- Models / migrations
- Alteração de `ARCHITECTURE_LOCK.md`
- Runtime Shadow/Live
- Console / AgentOS
- Remoção dos endpoints legados `/ai-agents/:id/simulator/*`
