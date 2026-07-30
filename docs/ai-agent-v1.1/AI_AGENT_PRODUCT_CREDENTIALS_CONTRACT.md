# AI Agent Product Credentials — Contrato (Fase 2.7)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 2.7 |
| **Status** | Implementado |
| **Referência normativa** | `ARCHITECTURE_LOCK.md` v1.0 (**congelado** — não alterado) |
| **API contract pai** | `AI_AGENT_PRODUCT_API_CONTRACT.md` |
| **Estratégia** | B — camada Product sobre `AiProviderCredential` existente |

---

## 1. Namespace

```
/product/ai-agent/credentials/*
```

Auth: `isAuth` + `requireAiAgentProductView` (admin comercial).

Tenant sempre da sessão. Body/query com `companyId` → `ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID`.

### Dívida técnica (temporária)

O CRUD legado `/ai-provider-credentials` continua com `requireEffectiveModule("automation.ai_agent")` (sem exigir admin), usado pela Knowledge Base. A Product Experience **não** consome esse CRUD.

---

## 2. Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/product/ai-agent/credentials` | Lista (enabled + disabled) |
| POST | `/product/ai-agent/credentials` | Cria |
| GET | `/product/ai-agent/credentials/:credentialRef` | Detalhe |
| PUT | `/product/ai-agent/credentials/:credentialRef` | Atualiza nome/provider/chave/default |
| POST | `.../:credentialRef/test` | Testa com o provedor |
| POST | `.../:credentialRef/enable` | Habilita |
| POST | `.../:credentialRef/disable` | Desabilita (com guards) |

**Não existe** `DELETE` Product.

---

## 3. Referências e campos proibidos

Superfície comercial usa apenas `credentialRef` (internamente `String(id)`, alinhado a Options).

Body rejeitado se presente (mesmo null):

`id`, `credentialId`, `aiProviderCredentialId`, `companyId`, `apiKeyEncrypted`, `apiKeyMasked`, `maskedKey`, `enabled`

`enabled` só via enable/disable.

---

## 4. Serializer

Allow-list:

```json
{
  "credentialRef": "12",
  "name": "Produção",
  "provider": "openai",
  "maskedKey": "sk-…XXXX",
  "enabled": true,
  "isDefault": false,
  "usage": { "aiAgent": false, "knowledgeEmbedding": false }
}
```

Nunca retorna: `apiKey`, `apiKeyEncrypted`, `id`, `companyId`, `credentialId`.

---

## 5. Create / Update

**Create:** `name`, `provider` (openai|gemini via capabilities), `apiKey` obrigatória, `isDefault?`. Inicia `enabled=true`. Não vincula agente. Não ativa conexões.

**Update:** campos opcionais. `apiKey` omitida ou `""` → preserva chave. Nova `apiKey` substitui e atualiza máscara.

**Troca de provider:** se a credencial estiver vinculada a qualquer `AiAgent` (`aiProviderCredentialId`) → `ERR_AI_AGENT_CREDENTIAL_PROVIDER_IN_USE`.

---

## 6. Disable

Bloqueia se:

- `AiKnowledgeEmbeddingSettings.credentialId` no tenant → `ERR_AI_AGENT_CREDENTIAL_KNOWLEDGE_IN_USE`
- Qualquer WhatsApp vinculado em `shadow|live|dry_run` → `ERR_AI_AGENT_CREDENTIAL_ACTIVE_AGENT_IN_USE`

Permite se:

- sem uso;
- vinculada somente a agente Off (todas as conexões Off), **mesmo** com `AiAgent.enabled=true`.

O flag `AiAgent.enabled` sozinho **não** bloqueia. A decisão usa o estado operacional das conexões.

Disable **não** remove vínculo, **não** altera modo/conexões/agente — só `enabled=false` na credencial.

Não exclui fisicamente.

---

## 7. Test

`{ "success": boolean, "provider": string, "message": string }`

Sem segredo, sem payload bruto do provider.

---

## 8. Product Options / Hub / Wizard

Mutações refletem em `GET .../configuration/options` (sem cache).

Hub: CTA Adicionar / Gerenciar credenciais → modal Product; refetch summary.

Wizard: CTA abre o mesmo modal; refetch options; pode auto-selecionar `credentialRef` se provider compatível; preserva step e dirty state.

---

## 9. Knowledge Base e Runtime

- KB continua em `/ai-provider-credentials` + `credentialId`.
- Credenciais Product usam o mesmo model → aparecem na listagem KB.
- Runtime / `company_default` / `resolveAiAgentApiCredential*` **não** alterados.
- Product Readiness e Simulator continuam exigindo vínculo explícito.

---

## 10. Storage compartilhado

Mesmo `AiProviderCredential` para AI Agent, Embeddings e runtime. Sem novo model / migration.
