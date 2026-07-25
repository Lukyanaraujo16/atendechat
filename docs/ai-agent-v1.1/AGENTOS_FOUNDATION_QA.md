# AgentOS Foundation QA — Fase 1.7

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 1.7 |
| **Status** | QA integrado e fechamento da fundação do Console Técnico |
| **Referência normativa** | `ARCHITECTURE_LOCK.md` v1.0 (**congelado — não alterado**) |
| **Matrizes** | `PLATFORM_PERMISSIONS.md`, `AGENTOS_ROUTE_MATRIX.md`, `AGENTOS_BACKEND_ENDPOINT_MATRIX.md`, `AGENTOS_CONSOLE_UI_MATRIX.md` |

Este documento **não** duplica as matrizes. Consolida contratos verificados e resultados do QA.

---

## 1. Contratos verificados

### Segurança

| Contrato | Fonte | Resultado QA |
|----------|-------|--------------|
| Identidade interna (`isInternalUser`) | Fase 1.1 + `requirePlatformPermission` | OK — cliente sem flag não passa gate |
| `agentOS.console.view` | `PLATFORM_PERMISSIONS.md` | OK — entrada obrigatória |
| Grants específicos (manage / replay / rollout / production / incidents / security) | Backend matrix + UI matrix | OK — alinhados na UI 1.6; BE autoridade final |
| Probe `GET /technical-console/access` | Fase 1.1/1.3 | OK — deny-closed em rede/403; 401 → denied |
| Deny-closed | Guard + probe | OK — conteúdo não renderiza antes do probe; error ≠ allowed |
| Tenant context | `requireAgentOsTenantContext` | OK — testes `resolveRequestCompanyContext` |
| Ownership HTTP | `agentOsTenantOwnership` + controllers | OK — testes ownership + cross-tenant |
| Aliases protegidos | Route matrix + Guard | OK — redirect canônico após gate |
| Runtime automático | Orchestrator / inbound | OK — sem `isAuth` / Console / probe |

### Navegação

| Contrato | Resultado QA |
|----------|--------------|
| Drawer comercial sem módulos AgentOS | OK (Fase 1.2 + testes phase12) |
| Entrada única “Console Técnico” | OK — `canShowTechnicalConsoleNav` |
| Rotas canônicas `/technical-console/agentos/*` | OK — 18 módulos + landing |
| Shell interno (sidebar / drawer) | OK — layout 1.5; testes phase15 |
| Grupos (operation / quality / intelligence / tools / delivery) | OK |
| Mobile: botão módulos + fechar ao navegar | OK — `onNavigate={closeMobile}` |
| Breadcrumbs / 404 interna | OK — shell + `TechnicalConsoleNotFound` |

### Operação

| Contrato | Resultado QA |
|----------|--------------|
| Somente leitura útil com `console.view` | OK — banners + botões hide/disable |
| Replay exige `replay.execute` | OK — FE gate + MutationGate |
| Rollout / Live exige `rollout.manage` | OK |
| Production emergency exige `production.manage` | OK — Production também usa rollout para ações de rollout na mesma página |
| Mutações genéricas → `console.manage` | OK |
| Erros 403 sanitizados | OK — `toastAgentOsActionError` (sem permission key) |
| Confirmações Kill / Rollback / Emergency | OK — tenant no texto |
| Loading / empty states | OK — cobertura 1.6 |
| Overflow tabelas/JSON | OK — containment CSS compartilhado no shell |

---

## 2. Matriz integrada de usuários

Legenda: **D** = deny / ausente · **A** = allow / presente · **R** = leitura · **W** = escrita conforme grant · **SM** = supportMode (contexto apenas)

| Perfil | Drawer | Rota raiz | Módulo | Alias | Probe | API read | API write | Tenant | Ação UI | 403 |
|--------|--------|-----------|--------|-------|-------|----------|-----------|--------|---------|-----|
| Admin cliente | D | D | D | D | D | 403 | 403 | N/A | D | restrito |
| Admin cliente + SM | D | D | D | D | D | 403 | 403 | empresa SM | D | restrito |
| Interno sem grant | D | D | D | D | D | 403 | 403 | N/A | D | restrito |
| Interno sem grant + SM | D | D | D | D | D | 403 | 403 | empresa SM **não autoriza** | D | restrito |
| Interno somente leitura | A | A | R | A→canônico | A | R | 403 | ativo | hide/disable write | localizado |
| Interno somente leitura + SM | A | A | R | A | A | R | 403 | empresa SM | hide/disable | localizado |
| Interno operador | A | A | R/W | A | A | R | W se grant | ativo | conforme grant | — |
| Interno operador + SM | A | A | R/W | A | A | R | W se grant | empresa SM | conforme grant | — |

Evidência: testes middleware (`requirePlatformPermission`, `agentOsConsoleStackPhase14`, `requireAgentOsMutationGate`), testes FE phase12–17, ownership/cross-tenant.

---

## 3. Autorização frontend

Condição efetiva de conteúdo:

```
isInternalUser
AND agentOS.console.view (sessão serializada + DB no probe)
AND GET /technical-console/access → allowed
```

| Check | Resultado |
|-------|-----------|
| Conteúdo não aparece antes do probe | OK — `AgentOsRouteGuard` loading |
| Admin cliente não vê item | OK — `canShowTechnicalConsoleNav` |
| `supportMode` não altera condição | OK — phase17 |
| `enabled=false` / permissão ausente | OK — BE; sessão sem key → early deny |
| Troca de userId não reutiliza cache | OK — phase17 |
| Logout / sessão inválida limpa cache | OK — correção 1.7 em `useAuth` |
| Erro de rede → deny-closed | OK — state `error` ≠ allowed |
| Probe 401/403 → denied | OK |

**Risco residual:** grant mid-session no **mesmo** `userId` sem reload pode reutilizar `cacheOutcome` até logout/reset. Backend permanece autoridade em cada API.

---

## 4. Autorização backend (amostra)

| Cenário | Read (monitor/obs/execution/evidence/analytics/shadow) | Write (manage/replay/rollout/production) |
|---------|--------------------------------------------------------|------------------------------------------|
| Não autenticado | 401 | 401 |
| Admin cliente | 403 | 403 |
| Interno sem view | 403 | 403 |
| Somente view | 200 | 403 |
| Grant específico sem view | 403 | 403 |
| View + grant correto | 200 | 200 |
| Grant `enabled=false` | 403 | 403 |

Evidência: `requirePlatformPermission.spec.ts`, `requireAgentOsMutationGate.spec.ts`, `agentOsConsoleStackPhase14.spec.ts`.

---

## 5. Tenant e ownership (1.4.1)

| Cenário | A→A | A→B |
|---------|-----|-----|
| Action result | permitido | 403/404 seguro |
| Feedback | permitido | bloqueado |
| Runtime request | permitido | bloqueado |
| Incident | permitido | bloqueado |
| Live agent setting | `AiAgent.findOne({id,companyId})` | bloqueado |
| Execution / evidence / memory / rollout / replay | stack + ownership onde aplicável | bloqueado |

Confirmações: controller não executa no cross-tenant; `companyId` body/query não substitui contexto; supportMode usa empresa ativa; empresa-base do interno não sobrescreve tenant atendido.

Evidência: `agentOsTenantOwnership.spec.ts`, `agentOsCrossTenantControllers.spec.ts`, `resolveRequestCompanyContext.spec.ts`.

---

## 6. Runtime Shadow / Live

Cadeia inbound → listener / serviços → `LiveFunctionCallingService` / Shadow FC em `AutomationOrchestrator` e `AiAgentService/shadowFc`.

| Dependência proibida | Presente? |
|----------------------|-----------|
| `isAuth` | Não no caminho inbound |
| `requireAgentOsConsole` | Não |
| `requirePlatformPermission` | Não |
| Probe frontend | Não |
| Usuário interno conectado | Não |
| `supportMode` | Não |

**Nota:** `backend/src/services/AutomationOrchestrator/**` **não** foi alterado nesta fase (diff vazio).

---

## 7. Navegação comercial

| Área | Status |
|------|--------|
| Automações (Fluxos / Gatilhos / Integrações) | Preservada |
| Agente de IA comercial | Preservada |
| Compatibilidade (Prompts / KB / Respostas rápidas) | Preservada |
| Módulos AgentOS no drawer comercial | Ausentes |
| Console = item único | OK |
| Wizard / Simulator sem nav AgentOS | OK |
| Tabs comerciais só em paths corretos | OK (phase12) |

---

## 8. Rotas canônicas

18 itens em `AGENTOS_CONSOLE_NAV_ITEMS` ↔ `AGENTOS_TECHNICAL_ROUTE_ENTRIES`.

Cada um: path único, página real, grupo, i18n, ativo/breadcrumb no shell, sem collision de prefixo indevido (testes phase15/17).

Replay **frontend**: rotas de página; replay **API** (GET/POST `/replay`) é endpoint com side-effect — distinto de rota SPA.

---

## 9. Aliases

Todos os 18 aliases da route matrix: Guard → redirect canônico → shell → página.

Casos especiais auditados:

| Alias | Destino |
|-------|---------|
| `/automation/execution/replay/:id` | API (não rota SPA de página) — proteção MutationGate |
| `/automation/mcp/replay/:id` | Idem API |
| `/ai-agent/analytics` | `/technical-console/agentos/analytics` |
| `/ai-agent/shadow-fc` | `/technical-console/agentos/shadow-fc` |

Query / hash / params preservados no redirect (contrato phase13).

---

## 10. Shell desktop / mobile

| Viewport | Resultado |
|----------|-----------|
| 1280 / 1440 / 1920 | Sidebar + topbar + conteúdo — utilizável (auditoria estrutural + CSS) |
| 360 / 390 / 768 | Drawer móvel; `onNavigate` fecha; safe-area classes; sem scroll duplo imposto pelo shell |
| Overflow global | Containment `.agentos-table-scroll` / `.agentos-json-scroll` |

**Risco residual:** chrome duplo (`MainContainer`/`MainHeader` dentro do shell) — cosmético, não bloqueante.

---

## 11. Grants FE ↔ BE

Comparação `AGENTOS_BACKEND_ENDPOINT_MATRIX.md` × `AGENTOS_CONSOLE_UI_MATRIX.md`:

| Domínio | Alinhamento |
|---------|-------------|
| manage genérico | OK |
| replay (incl. GET side-effect) | OK |
| rollout / live | OK |
| production emergency | OK |
| Readiness / evidence package | Documentado 1.6 (manage vs view conforme matrix) |
| incidents.manage | Sem superfície de mutação UI |
| security.view | **Sem superfície frontend nesta fundação** |

Não há divergência silenciosa conhecida entre helpers FE e MutationGate para ações visíveis.

---

## 12. Incidentes e segurança

- Listagem de incidentes (se presente em páginas): **sem** botões ack/resolve incompletos.
- `security.view`: helper existe; **nenhuma página do Console chama/exibe superfície dedicada**.
- Registro explícito: **Sem superfície frontend nesta fundação.** Não criada na 1.7.

---

## 13. Erros / loading / concorrência

| Caso | Resultado |
|------|-----------|
| 403 ação | Toast localizado; shell permanece |
| 404 entidade | Seguro (ownership) |
| 500 / rede | Sanitizado; deny-closed no probe |
| Busy / duplo clique | Gates 1.6 em ações sensíveis |
| Race comprovada | Nenhuma nova corrigida além do cache logout |
| Polling | Não adicionado |

---

## 14. Testes e builds (execução 1.7)

### Frontend

```bash
cd frontend
CI=true npm test -- --watchAll=false --testPathPattern='aiAgentNavPhase12|aiAgentConsolePhase13|aiAgentConsolePhase15|agentOsConsolePhase16|agentOsUiPhase16|agentOsFoundationPhase17'
```

**Resultado:** 6 suites, **63** tests PASS.

```bash
npm run build
```

**Resultado:** exit 0.

### Backend

```bash
cd backend
npx jest --testPathPattern='resolveRequestCompanyContext|requireAgentOsMutationGate|agentOsConsoleStackPhase14|requirePlatformPermission|agentOsTenantOwnership|agentOsCrossTenant' --coverage=false
```

**Resultado:** 6 suites, **43** tests PASS.

```bash
npm run build
```

**Resultado:** exit 0 (`tsc`).

---

## 15. Correção mínima nesta fase

| Item | Justificativa |
|------|---------------|
| `useAuth` chama `resetTechnicalConsoleAccessCache` no logout e na sessão inválida | Contrato §6 — logout deve limpar/invalidar acesso; lacuna comprovada |
| `agentOsFoundationPhase17.test.js` | Cobertura da lacuna + contratos de nav/auth |

Nenhuma feature nova. Orchestrator e Architecture Lock intactos.

---

## 16. Estado git (inspeção 1.7)

- Working tree **não limpo** ao início: Fases **1.5 + 1.6** ainda uncommitted + correção 1.7.
- Commits separados em `main` (ahead): 1.1 (`86f0ea9`), 1.2 (`fea0703`), 1.3+1.4+1.4.1 (`2e5ff6f`).
- `git diff --name-only -- backend/src/services/AutomationOrchestrator` → **vazio**
- `git diff -- docs/ai-agent-v1.1/ARCHITECTURE_LOCK.md` → **vazio**
- **Sem commit. Sem push.** nesta fase.

---

## 17. Decisão de fechamento da fundação

| Pergunta | Resposta |
|----------|----------|
| Fundação pronta para push (após commits das fases 1.5–1.7)? | **Sim**, do ponto de vista técnico de aceite |
| Bypass conhecido? | **Não** (cliente / interno sem view / write sem grant) |
| Regressão comercial conhecida? | **Não** |
| Runtime depende de sessão humana? | **Não** |
| Divergência grants FE↔BE conhecida? | **Não** nas ações visíveis; incidents/security sem UI de mutação (intencional) |

**Próxima etapa recomendada (não iniciada):** Fase 2.0 — Product API e Experience Layer do Agente de IA.
