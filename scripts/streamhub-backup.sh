#!/usr/bin/env bash
# Backup do StreamHub Chat (executar como root na VPS).
#
#   sudo bash scripts/streamhub-backup.sh                 completo
#   sudo bash scripts/streamhub-backup.sh --somente-banco só o banco da aplicação
#
# Gera /var/backups/streamhub/<data>/ (permissão 700) com:
#   app-db.dump              PostgreSQL da aplicação (pg_dump -Fc)
#   app-public.tar.gz        mídias e arquivos enviados (backend/public)
#   config.tar.gz            backend/.env, frontend/.env, /etc/streamhub, Evolution .env/compose
#   evolution-db.sql.gz      banco da Evolution (se instalada por install.sh)
#   evolution-instances.tar  sessões WhatsApp da Evolution
#   SHA256SUMS
# Os arquivos contêm segredos e dados de clientes: copie-os para fora da VPS com segurança.
# Restauração: docs/MANUAL_INSTALACAO.md, seção "Backup e restauração".
# Variáveis: BACKUP_ROOT (padrão /var/backups/streamhub), BACKUP_KEEP (padrão 7).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=installer/lib.sh
source "$ROOT/scripts/installer/lib.sh"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/streamhub}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"
EVOLUTION_DIR="${EVOLUTION_DIR:-/opt/streamhub/evolution}"
ENV_FILE="$ROOT/backend/.env"

[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] || ui_fail "BACKUP_KEEP deve ser um número inteiro >= 1."
[[ $EUID -eq 0 ]] || ui_fail "Execute como root." "sudo bash scripts/streamhub-backup.sh"
[[ "${1:-}" =~ ^(|--somente-banco)$ ]] || ui_fail "Opção desconhecida: $1"
DB_NAME="$(env_get "$ENV_FILE" DB_NAME || true)"
[[ -n "$DB_NAME" ]] || ui_fail "DB_NAME não encontrado em ${ENV_FILE}."
is_safe_pg_ident "$DB_NAME" || ui_fail "DB_NAME com caracteres inesperados."

DEST="${BACKUP_ROOT}/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_ROOT"; chmod 700 "$BACKUP_ROOT"
(umask 077 && mkdir "$DEST")
trap 'ui_err "Backup incompleto em ${DEST}"' ERR

echo "Backup em ${DEST}"
# shellcheck disable=SC2024 # o arquivo é gravado pelo root (intencional, diretório 700)
sudo -u postgres pg_dump -Fc "$DB_NAME" >"$DEST/app-db.dump"
ui_ok "Banco ${DB_NAME} ($(du -h "$DEST/app-db.dump" | cut -f1))"

if [[ "${1:-}" != "--somente-banco" ]]; then
  tar -C "$ROOT/backend" -czf "$DEST/app-public.tar.gz" public
  ui_ok "Arquivos de backend/public ($(du -h "$DEST/app-public.tar.gz" | cut -f1))"

  cfg=("$ENV_FILE")
  [[ -f "$ROOT/frontend/.env" ]] && cfg+=("$ROOT/frontend/.env")
  [[ -d /etc/streamhub ]] && cfg+=(/etc/streamhub)
  [[ -f "$EVOLUTION_DIR/.env" ]] && cfg+=("$EVOLUTION_DIR/.env" "$EVOLUTION_DIR/docker-compose.yml")
  tar -czf "$DEST/config.tar.gz" -P "${cfg[@]}"
  ui_ok "Configuração (.env e registros)"

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx evolution-postgres; then
    docker exec evolution-postgres pg_dump -U evolution evolution | gzip >"$DEST/evolution-db.sql.gz"
    ui_ok "Banco da Evolution"
    docker cp evolution-api:/evolution/instances - >"$DEST/evolution-instances.tar"
    ui_ok "Sessões da Evolution"
  fi
fi

(cd "$DEST" && sha256sum -- * >SHA256SUMS)
chmod 600 "$DEST"/*
trap - ERR

# Retenção: mantém os BACKUP_KEEP mais recentes.
mapfile -t old < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | head -n "-${BACKUP_KEEP}")
for d in "${old[@]}"; do rm -rf -- "$d"; done
((${#old[@]})) && ui_info "Backups antigos removidos: ${#old[@]} (mantidos ${BACKUP_KEEP})"
ui_ok "Backup concluído: ${DEST}"
