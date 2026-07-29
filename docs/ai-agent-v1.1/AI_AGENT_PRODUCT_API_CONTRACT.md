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
