# AI Agent — Inventário de Configuração Comercial (Product API)

Inventário dos campos de configuração do AI Agent, baseado nos modelos reais do backend. Classifica cada campo quanto à exposição na Product Configuration API.

---

## Classificações

| Classificação | Significado |
|---------------|-------------|
| `commercial_editable` | Pode ser alterado pelo admin via Product API |
| `commercial_readonly` | Visível mas não editável via Product API |
| `technical_internal` | Não exposto, uso interno |
| `secret` | Nunca exposto em nenhuma API |
| `deprecated` | Reservado / não utilizado |
| `runtime_managed` | Alterado por comandos de ativação/desativação, não por configuração |

---

## AiAgent model

| Campo | Tipo | Classificação | Pode entrar na Product API? |
|-------|------|---------------|-----------------------------|
| `id` | INTEGER PK | `technical_internal` | Não |
| `companyId` | FK | `technical_internal` | Não |
| `name` | STRING(120) | `commercial_editable` | Sim |
| `description` | TEXT NULL | `commercial_editable` | Sim |
| `enabled` | BOOLEAN default false | `runtime_managed` | Não (comandos) |
| `model` | STRING(64) default `'gpt-4o-mini'` | `commercial_editable` | Sim |
| `temperature` | FLOAT default 0.3 | `commercial_editable` | Sim |
| `maxTokens` | INTEGER default 512 | `commercial_editable` | Sim |
| `systemPrompt` | TEXT NULL | `technical_internal` | Não (compilado do profile) |
| `fallbackMessage` | TEXT NULL | `commercial_editable` | Sim |
| `handoffMessage` | TEXT NULL | `commercial_editable` | Sim |
| `aiProviderCredentialId` | FK NULL | `commercial_editable` | Via referência segura |
| `allowAudioInput` | BOOLEAN | `deprecated` | Não |
| `allowAudioOutput` | BOOLEAN | `deprecated` | Não |
| `createdAt` / `updatedAt` | DATE | `technical_internal` | Não |

---

## AiAgentProfile model

| Campo | Tipo | Classificação | Pode entrar? |
|-------|------|---------------|--------------|
| `id` | PK | `technical_internal` | Não |
| `companyId` / `aiAgentId` | FK | `technical_internal` | Não |
| `schemaVersion` | INTEGER | `runtime_managed` | Não |
| `setupMode` | STRING default `'guided'` | `commercial_readonly` | Não (sempre guided) |
| `companyName` | STRING(100) | `commercial_editable` | Sim |
| `businessSegment` | STRING(64) | `commercial_editable` | Sim |
| `customBusinessSegment` | STRING(100) | `commercial_editable` | Sim |
| `departments` | JSON `string[]` | `commercial_editable` | Sim |
| `attendantName` | STRING(100) | `commercial_editable` | Sim |
| `attendantRole` | STRING(120) | `commercial_editable` | Sim |
| `tone` | STRING(32) | `commercial_editable` | Sim |
| `customTone` | STRING(200) | `commercial_editable` | Sim |
| `clientAddressStyle` | STRING(64) | `commercial_editable` | Sim |
| `emojiLevel` | STRING(16) | `commercial_editable` | Sim |
| `responseLength` | STRING(16) | `commercial_editable` | Sim |
| `allowedActions` | JSON `string[]` | `commercial_editable` | Sim |
| `forbiddenActions` | JSON `string[]` | `commercial_editable` | Sim |
| `handoffRules` | JSON `string[]` | `commercial_editable` | Sim |
| `companyDescription` | TEXT | `commercial_editable` | Sim |
| `productsAndServices` | TEXT | `commercial_editable` | Sim |
| `serviceArea` | STRING(200) | `commercial_editable` | Sim |
| `businessHours` | TEXT | `commercial_editable` | Sim |
| `pricingPolicy` | TEXT | `commercial_editable` | Sim |
| `negotiationPolicy` | TEXT | `commercial_editable` | Sim |
| `schedulingPolicy` | TEXT | `commercial_editable` | Sim |
| `frequentlyAskedQuestions` | JSON `AiAgentProfileFaqItem[]` | `commercial_editable` | Sim |
| `importantInformation` | TEXT | `commercial_editable` | Sim |
| `customInstructions` | TEXT | `commercial_editable` | Sim |
| `sourceWebsite` | STRING(500) | `commercial_editable` | Sim |
| `generatedPrompt` | TEXT | `secret` | Nunca |
| `generatedPromptVersion` | STRING | `runtime_managed` | Não |
| `generatedAt` | DATE | `runtime_managed` | Não |
| `createdAt` / `updatedAt` | DATE | `technical_internal` | Não |

---

## AiProviderCredential

| Campo | Classificação | Pode entrar? |
|-------|---------------|--------------|
| `id` | `technical_internal` | Apenas como referência opaca |
| `companyId` | `technical_internal` | Não |
| `name` | `commercial_editable` | Sim (readonly na config API) |
| `provider` | `commercial_editable` | Sim (readonly na config API) |
| `apiKeyEncrypted` | `secret` | Nunca |
| `apiKeyMasked` | `commercial_readonly` | Sim (`maskedKey`) |
| `enabled` | `commercial_editable` | Sim (para elegibilidade) |
| `isDefault` | `commercial_editable` | Sim |
| `createdAt` / `updatedAt` | `technical_internal` | Não |

---

## Whatsapp (campos AI)

| Campo | Classificação | Pode entrar? |
|-------|---------------|--------------|
| `aiAgentId` | `runtime_managed` | Não (via comando de conexões) |
| `aiAgentEnabled` | `runtime_managed` | Não |
| `aiAgentMode` | `runtime_managed` | Não |
| `functionCallingShadow` | `technical_internal` | Não |
| `functionCallingLive` | `technical_internal` | Não |

---

## Estratégia de edição em modos ativos

**Estratégia C:** toda alteração estrutural (provider, credential, connections, instructions/profile) exige agente Off.

- Campos de identidade (`name`, `description`, `fallbackMessage`, `handoffMessage`) podem ser editados em qualquer modo.
- Justificativa: o runtime consome `generatedPrompt` e `resolveAiAgentApiCredential` imediatamente — não existe mecanismo de draft/publish.

### Matriz de edição

| Campo/grupo | Off | Shadow | Live |
|-------------|-----|--------|------|
| `name` | permitido | permitido | permitido |
| `description` | permitido | permitido | permitido |
| `fallbackMessage` | permitido | permitido | permitido |
| `handoffMessage` | permitido | permitido | permitido |
| `model` | permitido | bloqueado | bloqueado |
| `temperature` | permitido | bloqueado | bloqueado |
| `maxTokens` | permitido | bloqueado | bloqueado |
| profile (instructions) | permitido | bloqueado | bloqueado |
| credential | permitido | bloqueado | bloqueado |
| connections | permitido | bloqueado | bloqueado |
| `provider` | permitido | bloqueado | bloqueado |

---

## Providers comerciais (Hardening 2.3.1)

Fonte única: `backend/src/services/AiAgentProductService/aiAgentProductProviderCapabilities.ts`
IDs canônicos: `backend/src/config/aiProviderModels.ts`

| Provider | Runtime Shadow | Runtime Live | Simulator | Credencial | Modelos (allowlist real) |
|----------|----------------|--------------|-----------|------------|--------------------------|
| `openai` | sim | sim | sim | `AiProviderCredential.provider=openai` | `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo-1106` |
| `gemini` | sim | sim | sim | `AiProviderCredential.provider=gemini` | `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` |

### Regras Product API

- Options lista **ambos** quando `available: true`.
- `provider` + `credentialRef` devem coincidir (`credential.provider === provider`).
- Modelo validado por provider; incompatível → erro comercial.
- Provider desconhecido no GET: preserva `type`, `label: "Não suportado"` — sem conversão silenciosa para OpenAI.
- Troca de provider: somente Off; sem credencial compatível → limpa vínculo e aplica default do novo provider.

### Readiness (Hardening 2.3.2)

| Campo | Ausente | Incompatível / inválido |
|-------|---------|-------------------------|
| Credencial selecionada | `pending` → `setup_incomplete` | disabled/unknown/cross-tenant → `blocked` → `attention_required` |
| Provider | derivado da credencial selecionada | desconhecido → `blocked` |
| Modelo | `pending` | cruzado com provider → `blocked` → `attention_required` |

- Sem fallback para outras credenciais da empresa na Product API.
- Dados legados **não** são corrigidos automaticamente em GET/readiness.
- Activate bloqueado; deactivate permitido.

### Wizard legado (não migrado nesta tarefa)

- Wizard guiado não escolhe provider; cria com modelo OpenAI default e `aiProviderCredentialId: null`.
- Filtro de modelos por provider da credencial permanece na Product Configuration / Wizard (o antigo AiAgentModal foi removido na Fase 2.8A).
- Divergência para Fase 2.4: Wizard deve consumir options da Product API.

---

## Escopo company vs agent (Fase 2.9A)

| Recurso | Escopo | Motivo |
|---------|--------|--------|
| AiAgent (config, profile, prompt, commands, readiness, simulator) | **agent-scoped** (`agentRef`) | Company 1:N AiAgent |
| WhatsApp link (`aiAgentId`) | **agent-scoped** | Conexão 0..1 agente |
| AiProviderCredential | **company-scoped** | Compartilhável entre agentes |
| Knowledge Base / embedding settings | **company ou agent conforme contrato existente** | Não alterado nesta fase sem necessidade |
| Runtime inbound | **por `whatsapp.aiAgentId`** | Sem mudança |
