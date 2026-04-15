# Resumo da sessão Cursor (instalação + backups)

Este ficheiro guarda o contexto técnico de uma conversa no Cursor (para não depender só do histórico da app noutro PC). **Não** substitui o chat linha a linha; é o essencial para continuar o trabalho.

## Objectivo

- Ter `DB_IMPORT_USER` / `DB_IMPORT_PASS` no servidor **sem editar o `.env` à mão**: integrado no `install.sh`.
- Restauro de backups ZIP sem erro de extensão PostgreSQL (`must be owner of extension uuid-ossp`) nem falha de migrations na `SequelizeMeta`.

## `install.sh`

- `merge_db_import_from_existing_env` lê `DB_IMPORT_*` de `backend/.env` se existirem.
- `DB_IMPORT_USER` por defeito `postgres`; se `DB_IMPORT_PASS` vazio, gera (openssl ou `/dev/urandom` + base64).
- `sync_postgres_import_password`: `ALTER USER` com essa palavra-passe após o PostgreSQL estar a correr (instalação completa e `MINIMAL_UPDATE=1`).
- `write_backend_env` inclui `DB_IMPORT_USER` e `DB_IMPORT_PASS`.
- **Correção importante:** dentro de `merge_db_import_from_existing_env`, não usar `[[ -n "$v" ]] && VAR=...` como último comando de um `if` com `set -e` — o `[[` falhando fazia o script **sair em silêncio**. Passou a usar `if [[ -n "$v" ]]; then ... fi` e `return 0`.

## Backend — restauro de backup (`BackupService`)

- Import SQL com `psql` pode usar `DB_IMPORT_*` (superuser) — ver `getPsqlImportCredentials()` em `restoreDatabase.ts`.
- Após import PostgreSQL com utilizador diferente de `DB_USER`, objectos (ex.: `SequelizeMeta`) podem ficar com owner `postgres` → `sequelize db:migrate` falha com **permission denied**.
- Foi adicionado `grantPostgresAppUserAfterSuperuserImport()` (GRANT em `public` para `DB_USER`), chamado em `restoreFromZipFile.ts` **antes** de `runSequelizeDbMigrateAfterRestore()`. Se import e app forem o mesmo utilizador, o passo é ignorado.

## Ficheiros tocados (referência)

- `install.sh`
- `backend/.env.example` (comentários `DB_IMPORT_*`)
- `backend/src/services/BackupService/restoreDatabase.ts`
- `backend/src/services/BackupService/restoreFromZipFile.ts`

## Histórico do chat no Cursor

- Com a **mesma conta** Cursor noutro computador, o histórico **pode** aparecer sincronizado (depende da versão/plano).
- Para não perder contexto: este ficheiro + commits Git + mensagem inicial num chat novo com “continuar a partir de `docs/CURSOR_SESSION_RESUMO.md`”.
