# AgentOS Backup / Restore (Wave 5)

## Estratégia existente
O AgentOS persiste em tabelas Sequelize introduzidas na Wave 1 (`AutomationAgentOs*`)
mais Settings/Events/Audit de observabilidade. O backup do banco da aplicação
deve incluir essas tabelas automaticamente (full DB backup).

## Tabelas / módulos a validar no restore
- AgentProfiles / versions / sessions (Multi-Agent)
- Memory / KnowledgeObjects
- Learning documents
- MCP server config + credentials criptografadas
- Rollout config (settings module `agentos.rollout`)
- Kill switches (`agentos.killSwitches`)
- Replay / audit / metrics essenciais
- Incidents (events + memory mirror)
- Jobs / idempotency relevantes

## Procedimento de teste (staging)
1. Snapshot/backup do DB de teste
2. Popular tenant com rollout SHADOW + kill switch + incident + profile
3. Restore em DB limpo de teste
4. Boot app com `AGENTOS_PERSISTENCE=sequelize`
5. `POST /automation/hydrate`
6. Verificar dados; **não** ativar Live automaticamente
7. Preferir estado `DISABLED` ou `SUSPENDED` pós-restore
8. Rodar preflight antes de qualquer transição

## Pós-restore
- Live = false
- toolWrite/mcpWrite = false
- autoRollback = false
- Exigir health + preflight + aprovação humana
