# AgentOS V2.10 Wave 5 — Production Readiness

## Objetivo
Transformar o AgentOS em Release Candidate operacionalmente controlável.
**Não autoriza ativação Live global.** Defaults: tudo OFF / rollout `DISABLED`.

## Arquitetura de rollout
Estados: `DISABLED | INTERNAL_ONLY | SHADOW | TENANT_ALLOWLIST | CANARY | CONTROLLED_PRODUCTION | SUSPENDED | ROLLBACK`

State machine: `production/RolloutStateMachine.ts`  
Transições inseguras (ex.: DISABLED → CONTROLLED_PRODUCTION) são rejeitadas.

## Kill switch / Emergency stop
Hierarquia Global → Component → Provider → Tenant → Resource.  
APIs: `/automation/kill-switches`, `/automation/emergency-stop`

## Capability gates
`production/CapabilityGates.ts` — decisões por capability (live, tool/mcp write, coordinator, etc.)

## Preflight / Release readiness
Obrigatório antes de TENANT_ALLOWLIST / CANARY / CONTROLLED_PRODUCTION.

## DB-first
Hydrate Multi-Agent / MCP / Learning via `DbFirstHydration.ts` (lazy, idempotente).

## Bull
Fila `AgentOS` em `libs/agentOsQueue.ts`, workers iniciados em `startQueueProcess`.

## RBAC
`requireAgentOsPermission` + catálogo `AGENTOS_PRODUCTION_PERMISSIONS`.
Support não bypassa ações críticas.

## Canary / Auto rollback
Canary determinístico. Auto rollback **desabilitado por padrão**.

## Runbooks
Ver `docs/agentos/runbooks/`.

## Compatibility matrix
Ver `docs/agentos/COMPATIBILITY_MATRIX.md`.

## Staging / Go-live
1. Validar readiness `READY` ou `READY_WITH_WARNINGS`
2. Checklist go-live sem FAIL
3. Shadow apenas
4. Aprovação humana do RC (nunca automática)
5. Sem deploy automático desta wave

## Rollback
`POST /automation/rollout/rollback` + kill switch + incident. Audit preservado.
