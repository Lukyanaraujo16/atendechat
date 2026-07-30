# AI Agent Product API — Contrato (Fase 2.0)

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 2.0 |
| **Status** | Contrato inicial + hardening 2.0.1 (auth comercial + semântica paused) |
| **Referência normativa** | `ARCHITECTURE_LOCK.md` v1.0 (**congelado**) |
| **Inventário** | `AI_AGENT_PRODUCT_API_INVENTORY.md` |

---

## 1. Namespace

```
/product/ai-agent/*
```

Alinhado ao padrão do projeto (`/inventory/*`, `/ai-agents/*`), **sem** prefixo `/automation/*` ou `/technical-console/*`.

| Endpoint | Fase 2.0 | Notas |
|----------|----------|-------|
| `GET /product/ai-agent/summary` | **Implementado** | Visão agregada da empresa ativa |
| `GET /product/ai-agent/readiness` | **Implementado** | Mesmo resolver; subset serializado |
| `GET /product/ai-agent/simulator` | **Implementado (2.5)** | Bootstrap do simulador comercial |
| `GET /product/ai-agent/agents` | Conceitual | Não migrar CRUD nesta fase |
| `GET /product/ai-agent/agents/:id` | Conceitual | Idem |

Clientes HTTP existentes continuam em `/ai-agents/*`.

---

## 2. O que pertence à Product API

* disponibilidade do produto (plano + acesso do usuário);
* status comercial do Agente de IA;
* modo comercial (`off` / `shadow` / `live` / `paused`);
* readiness e checks limitados;
* próxima ação recomendada (enum estável);
* resumo do agente principal e da conexão vinculada.

## 3. O que não pertence

* traces, evidence, replay, execution sessions;
* rollout / kill-switch / incidents / security internals;
* planning / tools / memory / MCP internals;
* prompts de sistema completos;
* apiKeys / credenciais / tokens;
* permission keys de plataforma;
* payloads AgentOS brutos;
* elegibilidade por mensagem individual.

---

## 4. Fluxo obrigatório (Architecture Lock)

```
Controller (Product API — fino)
  ↓
GetAiAgentProductSummaryService (Experience)
  ↓
AgentReadinessService (única fonte de readiness)
  ↓
Serviços / models existentes (ListAiAgents, Whatsapp, Profile, Credential meta)
  ↓
serializeAiAgentProductSummary / serializeAiAgentReadiness
```

A Product API **não** substitui a Experience Layer.
A Experience Layer **não** modifica AgentOS / Shadow / Live runtime.

---

## 5. Status comerciais (`AgentProductStatus`)

Alinhado ao Architecture Lock §11.

### 5.1 Matriz de prioridade (determinística)

Ordem de avaliação (1 = maior prioridade). Uma configuração produz **sempre** o mesmo status.

| Prioridade | Status | Condições necessárias | Condições que impedem | Next action típica |
|------------|--------|----------------------|----------------------|--------------------|
| 1 | `unavailable` | Plano `automation.ai_agent` off **ou** (no compute) `accessibleByUser=false`* | — | `upgrade_plan` |
| 2 | `not_created` | Plano ok + zero agentes na empresa | Plano off | `create_agent` |
| 3 | `setup_incomplete` | Agente existe + falta provider **ou** instructions **ou** connection | Setup completo | conforme check pendente |
| 4 | `attention_required` | Setup completo + (modo shadow/live com WA ≠ CONNECTED) **ou** (`enabled=false` com conexão em modo ativo) | Sem inconsistência operacional | `fix_connection` |
| 5 | `paused` | **Somente** `explicitlyPaused=true` (sinal inequívoco futuro) | Sem pausa explícita | `resume_agent` |
| 6 | `active` | Setup completo + modo `shadow` ou `live` (incl. `dry_run`→shadow comercial) | attention / paused | `none` |
| 7 | `ready_to_activate` | Setup completo + modo `off` | Modo ativo / attention / paused | `activate_shadow` |

\*Na HTTP Product API, `accessibleByUser=false` com plano on resulta em **403** (Estratégia A), não em body `unavailable`. O ramo `unavailable` no compute cobre plano off (e testes unitários do resolver).

### 5.2 Semântica de `AiAgent.enabled`

| Pergunta | Resposta auditada |
|----------|-------------------|
| `enabled=false` significa paused? | **Não** |
| Significa agente inativo no runtime? | **Sim** — Shadow/Live skip (`NOT_ELIGIBLE`) |
| Significa “nunca ativado”? | **Não distinguível** — não há histórico de ativação |
| Existe `liveStatus` no agente? | Não (só em logs de execução) |
| Pause por conexão? | Não — modo na conexão (`aiAgentMode`) |
| Pause por ticket? | Sim (`Ticket.aiAgentPaused`) — **não** entra no readiness global |
| Campo comercial de pausa global? | **Ausente** nesta fase |

**Regra `paused`:** não emitir com base isolada em `enabled=false`. Completo + `enabled=false` + modo off → `ready_to_activate`.

### 5.3 Significado resumido

| Status | Significado | i18n key | Transições |
|--------|-------------|----------|------------|
| `unavailable` | Produto indisponível no plano | `aiAgentProduct.status.unavailable` | → not_created |
| `not_created` | Nenhum agente | `…not_created` | → setup_incomplete |
| `setup_incomplete` | Faltam etapas estruturais | `…setup_incomplete` | → ready_to_activate |
| `attention_required` | Setup ok com atenção operacional | `…attention_required` | → active / ready |
| `paused` | Pausa explícita (reservado) | `…paused` | → ready / active |
| `active` | Shadow/Live/dry_run comercial | `…active` | → attention / ready |
| `ready_to_activate` | Pronto; modo off | `…ready_to_activate` | → active |

---

## 5b. Autorização comercial (hardening 2.0.1)

### Regra atual do módulo (evidência)

| Camada | Regra |
|--------|-------|
| Menu | `profile === "admin"` + `canUseAiAgent` (plano + user feature) |
| Rotas `/ai-agent`, wizard, simulator | `isAdmin` (**somente admin**, não supervisor) + feature + `AiAgentRouteGuard` |
| CRUD legado `GET/POST /ai-agents` | `isAuth` + `requireEffectiveModule("automation.ai_agent")` (**sem** admin) |
| supportMode | Não autoriza o módulo; admin em suporte usa `companyId` da sessão |
| AgentOS grants | Irrelevantes para o produto comercial |

### Estratégia Product API — **A (endpoint protegido)**

```
isAuth
→ requireAiAgentProductView (profile === "admin")
→ Experience service
```

| Caso | Resultado |
|------|-----------|
| Não autenticado | 401 |
| Não-admin (supervisor/user) | 403 `ERR_AI_AGENT_PRODUCT_ACCESS_DENIED` |
| Admin + user feature off | 403 `ERR_AI_AGENT_PRODUCT_ACCESS_DENIED` |
| Admin + plano off | 200 summary **reduzido** `unavailable` (sem agente/conexão) |
| Admin + plano on + feature on | 200 summary completo |
| Grant AgentOS sem admin | 403 |
| supportMode sem admin | 403 |
| `companyId` query/body | 403 contexto inválido |

Não usar Estratégia B com detalhes parciais para usuário sem acesso.

---

## 6. Modos comerciais

| Comercial | Técnico (persistido) | Notas |
|-----------|----------------------|-------|
| `paused` | Reservado — só `explicitlyPaused` | **Não** derivado de `enabled=false` |
| `live` | `Whatsapp.aiAgentMode === "live"` | Ativação automática |
| `shadow` | `shadow` **ou** `dry_run` | `shadow` = Shadow Mode; `dry_run` = observação legada (Orchestrator), **não** pipeline `AiAgentShadowService` |
| `off` | `disabled` / sem modo ativo | |

Prioridade do modo agregado (conexões do agente principal):

`paused` (explícito) > `live` > `shadow` (incl. dry_run) > `off`

Fonte oficial por conexão: `resolveWhatsappAiAgentRuntimeMode`.

Pause **por ticket** não altera o modo do produto.

---

## 7. Checks comerciais

| key | complete quando | pending / blocked / warning |
|-----|-----------------|----------------------------|
| `plan` | Feature `automation.ai_agent` no plano | blocked se off |
| `agent` | Existe ≥1 agente | pending se nenhum |
| `provider` | Credencial enabled do agente **ou** default da empresa | pending se ausente |
| `instructions` | Prompt de negócio resolvível (`generatedPrompt` guided ou `systemPrompt`) | pending |
| `connection` | ≥1 WhatsApp com `aiAgentId` do agente principal | pending |
| `mode` | Modo shadow/live (incl. dry_run→shadow) | pending se off e ready; warning se paused |

Knowledge **não** é check bloqueante nesta fase (opcional no runtime).

Conflitos chatbot/flow/integração são **elegibilidade por mensagem**, não readiness estrutural.

---

## 8. Next actions (`AiAgentNextAction`)

```ts
type AiAgentNextAction =
  | "upgrade_plan"
  | "create_agent"
  | "configure_agent"
  | "configure_provider"
  | "connect_whatsapp"
  | "fix_connection"
  | "resolve_conflict"
  | "activate_shadow"
  | "activate_live"
  | "resume_agent"
  | "none";
```

* Backend devolve **apenas o tipo**.
* Frontend mapeia label + path via mapper centralizado (sem URL arbitrária de input do usuário).
* `resolve_conflict` reservado; não emitido enquanto conflitos forem só por ticket.

---

## 9. Resposta `GET /product/ai-agent/summary`

```ts
{
  availability: {
    enabledByPlan: boolean;
    accessibleByUser: boolean;
  };
  status: AgentProductStatus;
  mode: "off" | "shadow" | "live" | "paused";
  agent: {
    exists: boolean;
    id?: number;
    name?: string;
    enabled?: boolean;
  };
  connection: {
    linked: boolean;
    name?: string;
    connected?: boolean;
  };
  readiness: {
    ready: boolean; // status ∈ { ready_to_activate, active }
    status: AgentProductStatus;
    mode: AiAgentProductMode;
    nextAction: AiAgentNextAction;
    checks: Array<{
      key: string;
      status: "complete" | "pending" | "blocked" | "warning";
      labelKey: string; // i18n semântico
    }>;
  };
}
```

Textos longos **não** são acoplados em PT-BR no service de domínio; usam `labelKey` / status codes.

`ready === true` significa: configuração estrutural completa **e** status `ready_to_activate` ou `active` (pode ativar ou já está ativo).
`setup_incomplete` / `paused` / `attention_required` / `unavailable` / `not_created` → `ready: false`.

---

## 10. Resposta `GET /product/ai-agent/readiness`

Subset do summary (`readiness` + `status` + `mode` + `availability`), **mesmo** `AgentReadinessService`. Sem duplicar regra.

---

## 11. Autorização

Ver §5b (hardening 2.0.1). Resumo:

| Camada | Regra |
|--------|-------|
| Auth | `isAuth` + `requireAiAgentProductView` (admin) |
| Plano off | 200 `unavailable` reduzido |
| User feature off | 403 |
| Plataforma AgentOS | **Proibida** |
| Tenant | Somente `req.user.companyId` |
| Query/body `companyId` | Rejeitado |

---

## 12. Erros comerciais

| Código | HTTP | Uso |
|--------|------|-----|
| `ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID` | 403 | Sem `companyId` de sessão |
| `ERR_AI_AGENT_PRODUCT_ACCESS_DENIED` | 403 | Autenticação/autorização insuficiente (reservado) |
| `ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE` | 403 | Reservado para negação dura futura |

Seguir `AppError`. Sem stack / permission keys / traces.

---

## 13. Serializers

* `serializeAiAgentProductSummary`
* `serializeAiAgentReadiness`

Deny-list explícita: `apiKey`, `apiKeyEncrypted`, `systemPrompt`, `generatedPrompt`, `credential`, traces, planning, execution, `platformPermissions`, `companyId` de terceiros.

---

## 14. Cache / polling

**Não** nesta fase: sem Redis, sem cache de summary, sem polling imposto.

---

## 15. Frontend 2.0 (mínimo)

* `frontend/src/services/aiAgentProductApi.js` — chama Product API
* `frontend/src/utils/aiAgentProductMapper.js` — statuses + nextAction → i18n/path
* Sem redesenho da página; FE **não** recalcula readiness

---

## 16. Decisões explícitas da fase

1. Status comerciais = contrato do Architecture Lock (não o enum ilustrativo do prompt 10).
2. `dry_run` → modo comercial `shadow` como observação **legada**; Shadow Mode técnico continua `aiAgentMode === "shadow"`.
3. KB não bloqueia readiness.
4. Conflitos de ticket não bloqueiam readiness estrutural.
5. CRUD `/ai-agents` permanece até fases futuras.
6. AgentOS / Console / Orchestrator intactos.
7. **2.0.1:** Product API exige `admin` (mesmo gate visual); `enabled=false` ≠ `paused`; serializer allowlist.

---

## 17. Comandos comerciais (Fase 2.2)

### Namespace

```
POST /product/ai-agent/commands
Body: { "command": "activate_shadow" | "activate_live" | "deactivate" }
```

Não aceitar `companyId` / `agentId` / `whatsappId` no body — o backend resolve o agente principal e as conexões vinculadas da empresa da sessão.

### Enum

```ts
type AiAgentProductCommand =
  | "activate_shadow"
  | "activate_live"
  | "deactivate";
```

`resume_agent` **não** é comando — não há pausa global de agente no domínio.

### Matriz de transições

| Estado atual (mode) | Ação | Estado esperado | Campos alterados | Service / helper | Readiness exigido | Permitido? |
|---------------------|------|-----------------|------------------|------------------|-------------------|------------|
| off | activate_shadow | active / shadow | `AiAgents.enabled=true`; WhatsApp vinculados: `aiAgentMode=shadow`, `aiAgentEnabled=true`, `aiAgentId` | Product command (tx + locks) | Setup estrutural completo + WA CONNECTED | Sim |
| off | activate_live | active / live | idem com `aiAgentMode=live` | idem | idem | Sim |
| shadow (ou dry_run comercial) | activate_live | active / live | mode → live; `enabled=true` | idem | idem | Sim |
| live | activate_shadow | active / shadow | mode → shadow; `enabled=true` | idem | idem | Sim |
| shadow | deactivate | ready_to_activate / off | `enabled=false`; WA: `aiAgentMode=disabled`, `aiAgentEnabled=false` (mantém `aiAgentId`) | update transacional | Agente existe | Sim |
| live | deactivate | ready_to_activate / off | idem | idem | Agente existe | Sim |
| off | deactivate | ready_to_activate / off | no-op / `changed:false` | — | — | Idempotente |
| shadow | activate_shadow | active / shadow | no-op se já shadow técnico | — | — | Idempotente |
| live | activate_live | active / live | no-op | — | — | Idempotente |
| * | resume_agent | — | — | — | — | **Não** (sem domínio) |

`activate_shadow` grava **`aiAgentMode = "shadow"`** (pipeline Shadow real), não `dry_run`.

### Autorização dos comandos

`isAuth` + `requireAiAgentProductView` (admin) + feature `automation.ai_agent` efetiva no service.

### Resposta

```json
{
  "command": "activate_live",
  "changed": true,
  "affectedConnections": {
    "scope": "all_linked",
    "count": 2,
    "names": ["WhatsApp Principal", "WhatsApp Secundário"],
    "fromMode": "off",
    "toMode": "live"
  },
  "summary": { "...serializeAiAgentProductSummary incluindo connectionScope" }
}
```

### Erros

| Código | Quando |
|--------|--------|
| `ERR_AI_AGENT_PRODUCT_ACCESS_DENIED` | Perfil/user feature |
| `ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE` | Plano off |
| `ERR_AI_AGENT_PRODUCT_NOT_READY` | Setup incompleto |
| `ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED` | Comando inválido |
| `ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE` | Sem vínculo **ou** qualquer vinculada desconectada (activate) |
| `ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID` | companyId ausente / IDs arbitrário no body |

---

## 18. Escopo de conexões (Hardening 2.2.1)

### Cardinalidade comprovada

| Relação | Cardinalidade | Evidência |
|---------|---------------|-----------|
| Empresa → AiAgent | 0..N | sem unique por company |
| AiAgent → WhatsApp | 0..N | `Whatsapps.aiAgentId` sem UNIQUE |
| WhatsApp → AiAgent | 0..1 | coluna singular `aiAgentId` |

### Regra comercial oficial — **Opção A**

Comandos comerciais atuam no **agente principal** da empresa e em **todas** as conexões WhatsApp vinculadas (`aiAgentId = agent.id`).

Não há comando por conexão nesta fase. Não há campo de “conexão principal” no domínio — o summary escolhe uma conexão de **exibição** de forma determinística.

### Escopo por comando

| Comando | Escopo | Entidades afetadas | Múltiplas conexões | Conexão desconectada |
|---------|--------|--------------------|--------------------|----------------------|
| `activate_shadow` | `all_linked` | `AiAgents.enabled=true` + todas WA vinculadas → `aiAgentMode=shadow`, `aiAgentEnabled=true` | Normaliza **todas** para shadow | **Falha total** se **qualquer** vinculada ≠ CONNECTED |
| `activate_live` | `all_linked` | idem com `aiAgentMode=live` | Normaliza **todas** para live | **Falha total** se qualquer vinculada ≠ CONNECTED |
| `deactivate` | `all_linked` + agente | `AiAgents.enabled=false` + todas WA → `disabled` / `aiAgentEnabled=false` (mantém `aiAgentId`) | Desliga **todas** | Desliga mesmo desconectadas (sem exigir CONNECTED) |

Não há sucesso parcial silencioso: activate é atômico (transação) ou falha antes de alterar.

### `connectionScope` no summary

```ts
connectionScope: {
  type: "all_linked";
  count: number;
  connectedCount: number;
  disconnectedCount: number;
  names: string[]; // comerciais, ordenados por id ASC
}
```

`connection` (singular) permanece como **preview** determinístico:
1. conexões vinculadas ordenadas por `id ASC`;
2. primeira `CONNECTED`, senão a primeira da lista.

### Estado misto

O domínio legado **permite** A=live e B=shadow. O Product API:

* agrega mode (`live` > `shadow` > `off`);
* marca `attention_required` quando há modos ativos distintos;
* comandos **normalizam** todas as vinculadas para um único modo.

### Invariantes runtime

| agent.enabled | WA enabled | WA mode | Runtime naquela conexão | Estado Product válido? |
|---------------|------------|---------|-------------------------|------------------------|
| false | * | * | não executa | off / ready_to_activate (ou attention se WA ativa) |
| true | false / disabled | disabled | não executa | off |
| true | true | shadow | Shadow | active / shadow |
| true | true | live | Live | active / live |

### Idempotência

`changed: false` somente se **todo** o escopo já estiver no estado alvo (agente + **todas** as WA). Estado misto sob `activate_live` → `changed: true` e normalização.

### Concorrência

Locks `UPDATE` com `ORDER BY id ASC` em agentes da empresa e WA vinculadas. Summary da resposta é lido **após** commit.

---

## 19. Resolução do agente comercial (Hardening 2.2.2)

### Cardinalidade

Empresa → AiAgent = **0..N** · AiAgent → WhatsApp = **0..N** · WhatsApp → AiAgent = **0..1**.

Não existe campo `isPrimary` / soft delete em `AiAgents`.

### Agente elegível

Todos os `AiAgent` com `companyId` da sessão. **`enabled=false` permanece elegível** (pode estar pronto para ativar). Sem filtro por vínculo WhatsApp, `createdAt` ou nome.

### Resolução multiagente (Fase 2.9A)

Uma empresa pode possuir **múltiplos** agentes comerciais. Operações agent-scoped usam `agentRef` explícito (identificador comercial opaco).

| Candidatos | Sem `agentRef` (compat frontend singular) | Com `agentRef` |
|------------|-------------------------------------------|----------------|
| 0 | `not_created` | 404 `AGENT_NOT_FOUND` se ref inválida |
| 1 | resolve esse agente | opera no ref (validado na empresa) |
| ≥2 | `ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED` | opera no agente informado |

Criação (`POST /product/ai-agent/configuration`) **permite** o segundo (e N-ésimo) agente. Não há mais bloqueio `ERR_AI_AGENT_PRODUCT_ALREADY_EXISTS` por “já existe um agente”.

Listagem: `GET /product/ai-agent/agents` — retorna todos os agentes; nunca `ambiguous`.

### Resolver central

- Operações Product: `resolveAiAgentProductAgentForOperation` (`aiAgentProductAgentRef` / `ResolveAiAgentProductAgentService`)
- Readiness puro sobre snapshot: `resolveAiAgentProductAgentContext` (quando o snapshot já está filtrado a um agente)

### `agentScope`

```ts
agentScope: { type: "none" | "single" | "ambiguous"; count: number }
```

`ambiguous` permanece no tipo apenas por compatibilidade de serialização; operações comerciais não usam mais ambiguous como estado permanente.

### Erro

| Código | Quando |
|--------|--------|
| `ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED` | ≥2 agentes e operação agent-scoped sem `agentRef` |
| `ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND` | `agentRef` inexistente ou de outra empresa (sem enumeração) |
| `ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID` | 0 agentes em activate/update (ou IDs arbitrários no body) |
| `ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS` | legado; não é o caminho operacional 2.9A |

---

## 20. Product Configuration API

### Namespace

`/product/ai-agent/configuration` e `/product/ai-agent/configuration/*`

### Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/product/ai-agent/configuration` | Configuração editável |
| POST | `/product/ai-agent/configuration` | Criação comercial |
| PUT | `/product/ai-agent/configuration` | Atualização comercial |
| GET | `/product/ai-agent/configuration/options` | Opções disponíveis |
| PUT | `/product/ai-agent/configuration/connections` | Vincular/desvincular conexões |
| POST | `/product/ai-agent/configuration/preview` | Preview do prompt (sem agentId) |

### Autorização

- `isAuth` + `requireAiAgentProductView` (admin only)
- Feature `automation.ai_agent` validada por operação
- `supportMode` não autoriza
- Permissões AgentOS não autorizam

### Contexto do agente (multiagente 2.9A)

- 0 agentes → tipo `"none"` → criação permitida
- 1 agente → tipo `"single"` → leitura/atualização sem `agentRef` (compat)
- ≥2 agentes → exigir `agentRef` (`ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED`)
- Rotas preferenciais: `/product/ai-agent/agents/:agentRef/configuration`

### Campos comerciais editáveis (allowlist)

**Identidade:** `name`, `description`, `fallbackMessage`, `handoffMessage`

**Modelo:** `model`, `temperature`, `maxTokens`

**Profile (instructions):** todos os campos do AiAgentProfile exceto `generated*`, `setupMode`, `schemaVersion`

**Provider:** `credentialRef` (referência opaca)

**Conexões:** `connectionRefs[]` (referências opacas)

### Campos nunca aceitos no payload

`companyId`, `agentId`, `enabled`, `mode`, `dry_run`, `aiAgentEnabled`, `aiAgentMode`, `apiKey`, `secret`, `token`, `platformPermissions`, `systemPrompt`, `generatedPrompt`, `status`, `readiness`

### GET `/product/ai-agent/configuration`

Retorna:

```json
{
  "agentScope": { "type": "single", "count": 1 },
  "configuration": {
    "identity": { "name": "...", "description": "..." },
    "messages": { "fallbackMessage": "...", "handoffMessage": "..." },
    "model": { "name": "gpt-4o-mini", "temperature": 0.3, "maxTokens": 512 },
    "profile": { "companyName": "...", "attendantName": "...", "tone": "friendly" },
    "instructions": { "configured": true, "preview": "..." },
    "provider": { "configured": true, "type": "openai", "label": "..." },
    "credential": { "configured": true, "label": "...", "maskedKey": "sk-...XXX" },
    "connections": [{ "ref": "...", "name": "...", "status": "CONNECTED", "selected": true }]
  },
  "editableWhileActive": false,
  "summary": { }
}
```

Para `agentScope.type === "none"`:

```json
{
  "agentScope": { "type": "none", "count": 0 },
  "configuration": null,
  "summary": { }
}
```

Para `agentScope.type === "ambiguous"`:

→ `409 ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS`

### GET `/product/ai-agent/configuration/options`

```json
{
  "providers": [
    { "value": "openai", "label": "OpenAI", "available": true },
    { "value": "gemini", "label": "Google Gemini", "available": true }
  ],
  "models": [
    { "value": "gpt-4o-mini", "label": "gpt-4o-mini", "provider": "openai" },
    { "value": "gemini-2.5-flash", "label": "gemini-2.5-flash", "provider": "gemini" }
  ],
  "credentials": [{ "ref": "...", "name": "...", "provider": "openai", "maskedKey": "...", "enabled": true, "isDefault": true }],
  "connections": [{ "ref": "...", "name": "...", "status": "CONNECTED", "selected": true, "eligible": true, "ineligibleReason": null }]
}
```

### Providers comerciais (Hardening 2.3.1)

Fonte única: `aiAgentProductProviderCapabilities` (reutiliza IDs de `aiProviderModels`).

| Provider | Label | Shadow | Live | Credencial própria | Modelos |
|----------|-------|--------|------|--------------------|---------|
| `openai` | OpenAI | sim | sim | sim | `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo-1106` |
| `gemini` | Google Gemini | sim | sim | sim | `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` |

Regras:

- `credential.provider` deve ser igual ao `provider` comercial selecionado.
- Modelo deve pertencer à allowlist do provider (`isModelAllowedForProvider`).
- Combinações cruzadas (`gemini` + `gpt-*`, `openai` + `gemini-*`) → `ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID` ou `ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID`.
- Provider desconhecido persistido: GET preserva `type` original com `label: "Não suportado"` — **nunca** converte para `openai`.
- Troca de provider só em Off (Estratégia C). Sem nova credencial compatível → limpa `credentialRef` e aplica modelo default do novo provider (`setup_incomplete`).
- Payload aceita `provider` na allowlist comercial (create/update).

### Readiness provider/credencial/modelo (Hardening 2.3.2)

Fonte: `resolveAiAgentProductProviderCompatibility` (mesmo módulo de capabilities).

| Situação | Checks | Status comercial |
|----------|--------|------------------|
| Credencial selecionada ausente | provider/credential/model → `pending` | `setup_incomplete` |
| Provider desconhecido | provider → `blocked` | `attention_required` |
| Credencial disabled | credential → `blocked` | `attention_required` |
| Credencial incompatível / cross-tenant (tratada como ausente ou inválida) | blocked/pending | `attention_required` ou `setup_incomplete` |
| Modelo incompatível | model → `blocked` | `attention_required` |
| OpenAI/Gemini válidos + demais checks | complete | `ready_to_activate` / `active` |

Regras:

- Readiness usa **somente** a credencial vinculada (`aiProviderCredentialId`), filtrada por `companyId`.
- Outra credencial válida da empresa **não** mascara a selecionada inválida/ausente.
- Runtime Shadow/Live ainda pode fazer fallback — Product API é mais estrita para liberar activate.
- `activate_shadow` / `activate_live` falham com `ERR_AI_AGENT_PRODUCT_NOT_READY` antes de mutar.
- `deactivate` permanece permitido com configuração inválida (redução de risco).
- Checks comerciais: `provider`, `credential`, `model` (além dos existentes). Sem IDs, secrets ou companyId.

#### Wizard comercial (Fase 2.4 — concluída; Hardening 2.4.2)

- Wizard consome exclusivamente `/product/ai-agent/configuration*` (sem `/ai-agents*` nem `/ai-provider-credentials`).
- Hidratação guiada via `configuration.profile` (allowlist comercial; sem `generatedPrompt`).
- Provider, modelos e credenciais vêm de `GET .../options` (`providers` + `models` + `credentials`).
- Preview usa `POST .../configuration/preview` com payload de profile (sem `agentId`).
- Credencial exibida somente quando vinculada ao agente (`aiProviderCredentialId` + tenant); sem fallback da credencial default da empresa.
- Create e edição estrutural Off exigem `provider` + `model` + `credentialRef` no Review (validação local antes do POST/PUT).
- Com `editableWhileActive === false`, o Wizard entra em modo dedicado de
  identidade: não renderiza steps, Review ou preview estruturais; envia somente
  identity (`name`, `description`, `fallbackMessage`, `handoffMessage`) e
  **não** chama PUT connections.
- `identity.name`/`identity.description` são hidratados separadamente de
  `profile.attendantName`/`profile.companyName`; profile antigo não sobrescreve
  identidade no reload e permanece intacto no update ativo.
- Success e toast do modo ativo são específicos e confirmam que o agente
  continua ativo.
- `setup_incomplete` permanece autoridade do backend; o Wizard não recalcula readiness.
- Rota `/ai-agent/wizard/:agentId` é residual de navegação; o param não resolve agente nem entra em payload.
- AiAgentModal avançado foi **removido** na Fase 2.8A; WhatsAppModal **não** configura AI (Fase 2.6).

### POST `/product/ai-agent/configuration` (criação)

- Somente quando `agentScope.type === "none"`
- Payload: allowlist comercial
- Agente criado com `enabled: false`
- Resposta: `{ "created": true, "configuration": {...}, "summary": {...} }`
- Se agente já existe: criação de **novo** agente permitida (multiagente); retorna `agentRef`
- Se ambíguo: `409 ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS`

### PUT `/product/ai-agent/configuration` (atualização)

- Somente quando `agentScope.type === "single"`
- Payload parcial: somente campos presentes são atualizados
- Idempotência: `changed: false` se valores iguais
- Agente ativo (shadow/live): somente identity (`name`, `description`, `fallbackMessage`, `handoffMessage`) permitidos → outros campos retornam `ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE`
- Resposta: `{ "changed": true|false, "configuration": {...}, "summary": {...} }`

### POST `/product/ai-agent/configuration/preview`

- Não exige `agentId` nem agente persistido
- Payload: campos de profile da allowlist comercial (mesmos de create/update)
- Resposta: `{ "preview": "..." }` — prompt compilado a partir do profile
- Não persiste agente, profile nem credencial
- Campos proibidos rejeitados como nas demais mutações de configuração

### PUT `/product/ai-agent/configuration/connections`

- Somente quando `agentScope.type === "single"`
- Payload: `{ "connectionRefs": ["ref1", "ref2"] }` (estado desejado completo)
- Validações: ownership, elegibilidade, cross-tenant, já atribuída a outro agente
- Conexão vinculada: `aiAgentId=agente`, `aiAgentEnabled=false`, `aiAgentMode=disabled`
- Desvinculada: `aiAgentId=null`, `aiAgentEnabled=false`, `aiAgentMode=disabled`
- Agente ativo: `409 ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE`
- Resposta: `{ "changed": true|false, "configuration": {...}, "summary": {...} }`

### Transação e locks

- Operações multi-entidade usam transação
- Lock `UPDATE` com `ORDER BY id ASC`
- Rollback completo em falha

### Concorrência

- Re-resolve `agentContext` dentro da transação
- Se ambiguidade surgir durante tx → rollback + erro

### Erros comerciais

| Código | HTTP | Quando |
|--------|------|--------|
| `ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID` | 400 | Payload inválido |
| `ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED` | 409 | ≥2 agentes sem `agentRef` |
| `ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND` | 404 | `agentRef` inexistente / outra empresa |
| `ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID` | 400 | Provider não suportado |
| `ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID` | 400 | Credencial inválida/incompatível/cross-tenant |
| `ERR_AI_AGENT_PRODUCT_CONNECTION_INVALID` | 400 | Conexão inexistente/cross-tenant |
| `ERR_AI_AGENT_PRODUCT_CONNECTION_ALREADY_ASSIGNED` | 409 | Conexão vinculada a outro agente |
| `ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE` | 409 | Alteração estrutural com agente ativo |
| `ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE` | 403 | Plano off |
| `ERR_AI_AGENT_PRODUCT_ACCESS_DENIED` | 403 | Não admin |

### Idempotência

- PUT com mesmos valores → `changed: false`
- POST com agente existente → `409` (não duplica)
- Vincular conexão já vinculada ao mesmo agente → no-op

### Auditoria

- Não existe padrão de audit log para configurações no projeto
- Risco residual documentado
- Usar `logger.info` para rastreabilidade mínima

### Knowledge Base

- Não migrada nesta fase
- `configuration.instructions.configured` indica presença de prompt compilado

---

## 14. Simulator comercial (Fase 2.5)

Contrato detalhado: `AI_AGENT_PRODUCT_SIMULATOR_CONTRACT.md`.

### Namespace

```
/product/ai-agent/simulator/*
```

| Método | Path | Status |
|--------|------|--------|
| GET | `/product/ai-agent/simulator` | **Implementado** — bootstrap |
| POST | `/product/ai-agent/simulator/sessions` | **Implementado** |
| GET | `/product/ai-agent/simulator/sessions` | **Implementado** |
| GET | `/product/ai-agent/simulator/sessions/:sessionRef` | **Implementado** |
| POST | `/product/ai-agent/simulator/sessions/:sessionRef/messages` | **Implementado** |
| POST | `/product/ai-agent/simulator/sessions/:sessionRef/end` | **Implementado** |
| POST | `/product/ai-agent/simulator/messages/:messageRef/review` | **Implementado** |

### Regras

- Sem `agentId` / `companyId` / `aiAgentId` no contrato HTTP
- Refs: `sim_s_{id}`, `sim_m_{id}`
- `canSimulate` exige credencial **vinculada** (sem company_default)
- Sem `functionCalling` na Product API
- Endpoints legados `/ai-agents/:id/simulator/*` permanecem registrados; mutações comerciais bloqueadas (2.8B.2)
- UI canônica: `/ai-agent/simulator` (legado redireciona)

### Erros comerciais

| Código | HTTP | Quando |
|--------|------|--------|
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE` | 400 | Gate canSimulate / not_created |
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_NOT_FOUND` | 404 | Sessão inválida / outro agente |
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND` | 404 | Mensagem inválida |
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_ENDED` | 400 | Sessão já encerrada |
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_LIMIT` | 400 | Limite de mensagens |
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_OPEN_SESSION_LIMIT` | 400 | Limite de sessões abertas |
| `ERR_AI_AGENT_PRODUCT_SIMULATOR_INVALID` | 400 | Payload / review inválido |
| `ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS` | 409 | Múltiplos agentes |
| `ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID` | 403 | Ids técnicos no request |
---

## Fase 2.6 — Fonte única de verdade (Conexões)

### Autoridade comercial

| Operação | Endpoint único |
|----------|----------------|
| Vincular / desvincular conexões | `PUT /product/ai-agent/configuration/connections` |
| Shadow / Live / Off | `POST /product/ai-agent/commands` |
| Entrada UI | `/ai-agent` e `/ai-agent/wizard` |

### WhatsApp create/update

`POST /whatsapp` e `PUT /whatsapp/:id` **rejeitam** a presença de `aiAgentId`, `aiAgentMode` e `aiAgentEnabled` (inclusive `null` / `false` / `"disabled"`).

Erro: `ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API` (HTTP 400).

GET continua retornando os campos. Edição sem campos AI preserva vínculo/modo. Criação usa defaults do model.

### WhatsAppModal

Não lista agentes; não envia campos AI; status read-only + CTA → `/ai-agent`.

### Navegação Hub

- `connect_whatsapp` / `fix_connection` → `/ai-agent/wizard`
- `open_connections` → `/connections` (administrar canais; não configura IA)

### Fora desta fase (2.6)

Órfãos, Knowledge Base Product, runtime, models/migrations.

---

## Fase 2.7 — Product Credentials

Contrato detalhado: `AI_AGENT_PRODUCT_CREDENTIALS_CONTRACT.md`.

| Método | Path | Status |
|--------|------|--------|
| GET/POST | `/product/ai-agent/credentials` | **Implementado** |
| GET/PUT | `/product/ai-agent/credentials/:credentialRef` | **Implementado** |
| POST | `.../test`, `.../enable`, `.../disable` | **Implementado** |

Sem DELETE Product. Model `AiProviderCredential` compartilhado com KB. Frontend comercial não usa `/ai-provider-credentials`. Runtime/`company_default` intactos.

### Hardening 2.8B.1 — legado `/ai-provider-credentials` (services)

- DELETE (service) bloqueia uso por `AiAgent` e `AiKnowledgeEmbeddingSettings`.
- PUT (service) rejeita propriedade `enabled`; enable/disable exclusivos Product.

### Fase 2.8B.2 — bloqueio seletivo de mutações comerciais HTTP

Rotas legadas **permanecem registradas**. Mutações comerciais respondem **HTTP 410** com:

- `ERR_AI_AGENT_LEGACY_MUTATION_DISABLED` — agentes, profile, knowledge-agent, simulator legado, shadow suggestion review
- `ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED` — POST/PUT/DELETE/test de credenciais

Ordem: `isAuth` → feature gate → `rejectLegacy*` → controller **não executado**.

**Preservados:** `GET /ai-agents` (Console Analytics), `GET /ai-provider-credentials` (KB), GETs técnicos, Shadow FC / Analytics / evaluations (Console), Product API, Product Simulator, Runtime (services internos).

Logging estruturado `ai_agent.legacy_mutation_blocked` (sem secrets/payload). Remoção física = Fase 2.8B.3.
