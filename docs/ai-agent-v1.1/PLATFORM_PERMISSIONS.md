# Platform User Permissions — Fase 1.1

## Tabela `PlatformUserPermissions`

Autorização **global de plataforma** (sem `companyId`), distinta de:

- `UserFeaturePermission` (tenant + feature de plano)
- `PlanFeatures` (capacidades contratadas)

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| id | INTEGER PK | autoIncrement |
| userId | INTEGER FK → Users | ON DELETE CASCADE |
| permissionKey | STRING(128) | ex.: `agentOS.console.view` |
| enabled | BOOLEAN | default `true` |
| createdAt / updatedAt | DATE | |

Índice único: `(userId, permissionKey)`.

### Seed na migration

A migration `20260725120000-create-platform-user-permissions.ts`:

1. Cria a tabela.
2. Concede **somente** `agentOS.console.view` de forma **idempotente** a usuários com `super = true` **ou** `profile = 'superadmin'`.
3. **Não** concede `manage`, `replay`, `rollout`, `incidents`, `security` ou `production`.
4. **Não** concede nada a `admin` / `supervisor` / `user` de tenant.

### Política pós-migration

Novos usuários internos criados **depois** desta migration **não** recebem grant automático.

Processo operacional futuro (fora desta subfase): inserção explícita em `PlatformUserPermissions` (admin interno / script).

### Revogação

`UPDATE ... SET enabled = false` ou delete da row. Middleware consulta fonte persistida a cada request (não JWT).

### Chaves conhecidas (código)

Ver `backend/src/config/platformPermissionConstants.ts`.

### Down

`dropTable("PlatformUserPermissions")` — remove grants e schema.
