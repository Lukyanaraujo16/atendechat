# AgentOS Console UI Matrix — Fase 1.6

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience / Fase 1.6 |
| **Status** | Matriz visual/operacional do Console Técnico |
| **Referência** | Architecture Lock v1.0 + AGENTOS_BACKEND_ENDPOINT_MATRIX.md |

Permissões (backend = autoridade):

| Chave | Uso |
|-------|-----|
| `agentOS.console.view` | Entrada + leitura |
| `agentOS.console.manage` | Mutações genéricas |
| `agentOS.replay.execute` | Qualquer path `/replay` (GET/POST) |
| `agentOS.rollout.manage` | Rollout / live / kill-switch |
| `agentOS.production.manage` | emergency-stop / hydrate |
| `agentOS.incidents.manage` | ack/resolve incidentes |
| `agentOS.security.view` | Detalhes de segurança (sem superfície dedicada nesta fase) |

Legenda **Regra frontend**: hide = ocultar botão; disable = desabilitar; view = só leitura.

---

## Monitor — `/technical-console/agentos/monitor`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Atualizar execuções | `/automation/orchestrator/executions` | GET | view | view | Nenhum execução no contexto | scroll X tabela | ok |
| Simular plano | `/automation/orchestrator/simulate` | POST | manage | hide/disable | — | ok | gate manage |
| Replay | `/automation/orchestrator/executions/:id/replay` | GET | replay.execute | hide | — | ok | gate replay |
| Salvar settings | `/automation/orchestrator/settings` | PUT | manage | hide | — | ok | gate manage |
| Dashboards | vários `/dashboard` | GET | view | view | — | ok | — |

## Observability — `.../observability`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Atualizar | `/automation/observability/dashboard` | GET | view | view | Sem eventos no contexto | scroll | ok |
| Probe | `.../probe` | POST | manage | hide | — | ok | gate manage |
| Ops health | `.../ops` | POST | manage | hide | — | ok | gate manage |
| Export | `.../export` | GET | view | view | — | ok | — |

## Execution Sessions — `.../execution-sessions`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Create/Start/Advance/Pause/Resume/Abort | `/automation/execution/*` | POST | manage | hide | Sem sessões no contexto | ok | gate manage |
| Simulate transition/recovery / graph | `.../simulate*` `.../graph` | POST | manage | hide | — | ok | gate manage |
| Replay | `.../execution/replay` | POST | replay.execute | hide | — | ok | gate replay |
| Salvar config | `.../execution/config` | PUT | manage | hide | — | ok | gate manage |

## Runtime — `.../runtime`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Preview/Execute/Inspect/Simulate | `/automation/runtime/*` | POST | manage | hide | Sem requests no contexto | ok | gate manage |
| Replay | `.../runtime/replay` | POST | replay.execute | hide | — | ok | gate replay |
| Salvar config | `.../runtime/config` | PUT | manage | hide | — | ok | gate manage |
| List requests | `.../runtime/requests` | GET | view | view | Sem requests | scroll | empty copy |

## Actions — `.../actions`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Simulate/Inspect/Execute | `/automation/actions/*` | POST | manage | hide | Sem results | ok | gate manage |
| Replay | `.../actions/replay` | POST | replay.execute | hide | — | ok | gate replay |
| Salvar config | `.../actions/config` | PUT | manage | hide | — | ok | gate manage |
| List results | `.../actions/results` | GET | view | view | Sem resultados de ação | scroll | empty |

## Analytics — `.../analytics`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Ignorar gap / Aceitar/Rejeitar suggestion | PATCH analytics/* | PATCH | manage (techManage) | hide | Nenhum gap/sugestão/replay | scroll | gate manage |
| Prompt diff / open replay | GET | GET | view | view | — | ok | — |

## Evaluation — `.../evaluation`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Evaluate / Diff / Simular | `/automation/planning/evaluate` `.../diff` | POST | manage | hide | Sem evaluations | ok | gate manage |
| Salvar config | `.../evaluation/config` | PUT | manage | hide | — | ok | gate manage |
| List | GET evaluations | GET | view | view | Sem avaliações | ok | empty |

## Evidence — `.../evidence`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Salvar thresholds | PUT `.../thresholds` | PUT | manage | hide | Nenhum report | scroll | gate manage |
| Abrir report | GET reports | GET | view | view | Nenhuma evidência registrada | ok | empty copy |

## Feedback — `.../feedback`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Simulate/Process | POST feedback/* | POST | manage | hide | Sem feedback | ok | gate manage |
| Replay | POST `.../feedback/replay` | POST | replay.execute | hide | — | ok | gate replay |
| Salvar config | PUT config | PUT | manage | hide | — | ok | gate manage |
| List | GET | GET | view | view | Nenhum feedback no contexto | ok | empty |

## Shadow FC — `.../shadow-fc`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Toggles empresa/agente/conexão | PUT shadow-fc/* | PUT | manage | disable | Nenhum agente/conexão/avaliação | ok | gate manage |
| Detalhe avaliação | GET shadow-evaluations | GET | view | view | Nenhuma avaliação | scroll | — |

## Planning — `.../planning`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Analyze/Generate/Deps/Validate/Recovery/Evaluate | POST planning/* | POST | manage | hide | — | ok | gate manage |
| Replay | POST `.../planning/replay` | POST | replay.execute | hide | — | ok | gate replay |

## Memory — `.../memory`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Build/Create/Query | POST memory/* | POST | manage | hide | Sem objetos de memória | ok | gate manage |
| Replay | POST `.../memory/replay` | POST | replay.execute | hide | — | ok | gate replay |
| List | GET | GET | view | view | Nenhuma memória no contexto | ok | empty |
| Salvar config | PUT | PUT | manage | hide | — | ok | gate manage |

## Learning — `.../learning`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Analyze/Evaluate/Approve/Reject/Promote/Shadow/Simulate | POST learning/* | POST | manage | hide | Sem candidatos | ok | gate manage + confirm alto impacto |
| Rollback artifact | POST `.../artifacts/:id/rollback` | POST | manage | hide | — | ok | gate + confirm |
| Replay | GET `.../learning/replay/:id` | GET | replay.execute | hide | — | ok | gate replay |
| Salvar config | PUT | PUT | manage | hide | — | ok | gate manage |

## Multi-Agent — `.../multi-agent`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| CRUD lifecycle / simulate / preview / coordination | POST/PUT agents/* | * | manage | hide | Sem agentes | ok | gate manage |
| Replay | GET `.../agents/replay/:id` | GET | replay.execute | hide | — | ok | gate replay |
| List | GET | GET | view | view | Nenhum agente técnico | ok | empty |

## Tools — `.../tools`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Test tool / FC / Evidence | POST tools/test* evidence/test | POST | manage | hide | Nenhuma execução | ok | gate manage |
| Test Live | POST `/automation/live/test` | POST | rollout.manage (+ manage extra BE) | hide | — | ok | gate rollout |
| Replay planning | POST planning/replay | POST | replay.execute | hide | — | ok | gate replay |
| Salvar política | PUT policies | PUT | manage | hide | — | ok | gate manage |

## MCP — `.../mcp`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Create/Connect/Sync/Execute/Simulate | POST mcp/* | POST | manage | hide | Sem servers | ok | gate manage |
| Replay | POST/GET mcp/replay | * | replay.execute | hide | — | ok | gate replay |
| Salvar config | PUT | PUT | manage | hide | — | ok | gate manage |

## Rollout — `.../rollout`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Settings / Kill / Rollback / Advance / Test | live/* live-rollout | PUT/POST | rollout.manage | hide/disable (1.5) | — | ok | + confirmação Kill/Rollback |
| Dashboard/targets | GET | GET | view | view | — | ok | — |

## Production — `.../production`

| Ação | Endpoint | Método | Permissão BE | Regra FE | Estado vazio | Mobile | Ação 1.6 |
|------|----------|--------|--------------|----------|--------------|--------|----------|
| Preflight/transition/suspend/rollback/kill | `/automation/rollout*` kill-switches | POST | rollout.manage | hide (1.5) | — | ok | confirm + tenant |
| Emergency stop | `/automation/emergency-stop` | POST | production.manage | hide (1.5) | — | ok | confirm |
| Readiness check | POST release-readiness/check | POST | manage | hide se !manage | — | ok | alinhar FE→manage |
| Evidence package | GET evidence-package | GET | view | view (corrigir over-gate 1.5) | — | ok | liberar com view |
| List incidents | GET incidents | GET | view | view | Nenhum incidente ativo | scroll | empty copy |
| Ack/Resolve | POST incidents/:id/* | POST | incidents.manage | *sem UI* | — | — | documentado; sem botão |

---

## Segurança

Nenhuma página do Console lista conteúdo classificado exclusivamente como `security.view` nesta fase. Helper `canViewAgentOsSecurity` preparado; sem endpoint UI dedicado.

## Divergências documentadas (sem alterar backend)

1. Production **Readiness check**: MutationGate → `console.manage`; FE 1.5 usava `rollout.manage` — corrigido para `manage`.
2. Production **Evidence package**: GET → view; FE 1.5 exigia `production.manage` — corrigido para view.
3. Tools **Live test**: BE exige `rollout.manage` (+ `console.manage` na rota); FE exige ambos quando aplicável.
4. Learning GET replay: MutationGate trata `/replay` como `replay.execute` mesmo em GET.
