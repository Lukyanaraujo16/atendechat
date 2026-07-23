# Runbook: MCP indisponível

## Sintomas
- Alertas/erros relacionados a: MCP indisponível
- Health/preflight/readiness degradados

## Impacto
- Possível bloqueio de operações AgentOS no tenant afetado
- Live/WRITE já devem permanecer OFF por padrão

## Severidade
high

## Diagnóstico
1. `GET /automation/production` e `GET /automation/release-readiness`
2. `GET /automation/observability/health` e `/automation/scalability/health`
3. Verificar kill switches: `GET /automation/kill-switches`
4. Verificar rollout: `GET /automation/rollout`
5. Logs estruturados AgentOS (sem secrets)

## Consultas / endpoints
- `/automation/production`
- `/automation/rollout/preflight`
- `/automation/incidents`
- `/automation/scalability/queue-health`

## Ação imediata
1. Não ativar Live
2. Se risco ativo: `POST /automation/emergency-stop` com confirm+reason
3. Abrir/ack incidente

## Mitigação
- Suspender tenant (`POST /automation/rollout/suspend`)
- Ativar kill switch escopo adequado
- Reduzir canary/sampling

## Rollback
- `POST /automation/rollout/rollback` (quando transição válida)
- Retornar a `SHADOW` ou `DISABLED`
- Preservar audit/replay

## Evidências a preservar
- traceId, incidentId, readiness JSON, audit events, job/DLQ ids

## Critérios de resolução
- Health não Critical
- Preflight sem FAIL para retomada
- Kill switch revisado
- Incidente RESOLVED com resolução

## Responsável
- On-call AgentOS / admin tenant (operações tenant-scoped)

## Pós-incidente
- Atualizar checklist go-live
- Revisar canary thresholds
- Dry-run de cleanup se aplicável
