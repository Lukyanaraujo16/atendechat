#!/usr/bin/env bash
# Garante que o utilizador da aplicação (DB_USER) é dono da base, do schema public
# e dos objectos em public, para que o Sequelize (db:migrate) possa executar
# ALTER TABLE ... DROP CONSTRAINT sem "must be owner of table".
#
# Uso: definir DB_NAME e DB_USER (e opcionalmente DB_DIALECT), ou apenas
# PROJETO_DIR para ler backend/.env. Chamado por install.sh e update-server-ip.sh.
#
# shellcheck disable=SC2034

_pg_ident() {
  printf '"%s"' "${1//\"/\"\"}"
}

# Escapa para uso como literal entre aspas simples em SQL (p.ex. comparação em -c)
_pg_escape_literal() {
  printf '%s' "$1" | sed "s/'/''/g"
}

_read_env_key() {
  local file="$1" key="$2"
  local line raw
  line=$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)
  [[ -n "$line" ]] || return 1
  raw="${line#*=}"
  raw="${raw%$'\r'}"
  if [[ "$raw" =~ ^\".*\"$ ]]; then
    raw="${raw#\"}"
    raw="${raw%\"}"
  elif [[ "$raw" =~ ^\'.*\'$ ]]; then
    raw="${raw#\'}"
    raw="${raw%\'}"
  fi
  printf '%s' "$raw"
}

ensure_postgres_app_ownership() {
  local env_file="${POSTGRES_ENV_FILE:-}"
  if [[ -z "$env_file" && -n "${PROJETO_DIR:-}" ]]; then
    env_file="${PROJETO_DIR}/backend/.env"
  fi
  if [[ -f "$env_file" ]]; then
    if [[ -z "${DB_DIALECT:-}" ]]; then
      DB_DIALECT="$(_read_env_key "$env_file" DB_DIALECT || echo postgres)"
    fi
    if [[ -z "${DB_NAME:-}" ]]; then
      DB_NAME="$(_read_env_key "$env_file" DB_NAME || true)"
    fi
    if [[ -z "${DB_USER:-}" ]]; then
      DB_USER="$(_read_env_key "$env_file" DB_USER || true)"
    fi
  fi

  DB_DIALECT="${DB_DIALECT:-postgres}"
  if [[ "${DB_DIALECT}" != "postgres" ]]; then
    return 0
  fi
  if [[ -z "${DB_NAME:-}" || -z "${DB_USER:-}" ]]; then
    echo "  [AVISO] ensure_postgres_app_ownership: DB_NAME/DB_USER em falta — ignorado."
    return 0
  fi

  command -v psql >/dev/null 2>&1 || {
    echo "  [AVISO] psql não encontrado — ownership PostgreSQL não verificado."
    return 0
  }

  if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
    return 0
  fi
  if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
    echo "  [AVISO] Role PostgreSQL \"${DB_USER}\" não existe — ownership não alterado."
    return 0
  fi

  local lit
  lit="$(_pg_escape_literal "${DB_USER}")"

  echo ">> PostgreSQL: alinhar dono da base \"${DB_NAME}\" e objectos em public → \"${DB_USER}\" (Sequelize/migrações)..."

  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER DATABASE $(_pg_ident "${DB_NAME}") OWNER TO $(_pg_ident "${DB_USER}");" || return 1
  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "ALTER SCHEMA public OWNER TO $(_pg_ident "${DB_USER}");" || return 1

  # Força dono em todas as tabelas/sequências/views (evita falhas se REASSIGN ou :'app' do psql falharem em silêncio)
  if ! sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
DECLARE
  r RECORD;
  app text := '${lit}';
BEGIN
  FOR r IN SELECT tablename AS rel FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.rel, app);
  END LOOP;
  FOR r IN SELECT sequence_name AS rel FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', r.rel, app);
  END LOOP;
  FOR r IN SELECT table_name AS rel FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO %I', r.rel, app);
  END LOOP;
  FOR r IN SELECT matviewname AS rel FROM pg_matviews WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER MATERIALIZED VIEW public.%I OWNER TO %I', r.rel, app);
  END LOOP;
END \$\$;
EOSQL
  then
    return 1
  fi

  # Reatribui objectos ainda associados a outros roles
  local owners
  owners="$(
    sudo -u postgres psql -d "${DB_NAME}" -Atq -c "
      SELECT DISTINCT pg_get_userbyid(c.relowner)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r','p','v','m','S','f')
        AND pg_get_userbyid(c.relowner) <> '${lit}'
      ORDER BY 1
    "
  )" || return 1

  local old
  while IFS= read -r old; do
    [[ -z "${old}" || "${old}" == "${DB_USER}" ]] && continue
    echo "  • REASSIGN OWNED BY ${old} → ${DB_USER}"
    sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "REASSIGN OWNED BY $(_pg_ident "${old}") TO $(_pg_ident "${DB_USER}");" || return 1
  done <<< "${owners}"

  echo "  [OK] Ownership PostgreSQL alinhado ao utilizador da aplicação."
  return 0
}
