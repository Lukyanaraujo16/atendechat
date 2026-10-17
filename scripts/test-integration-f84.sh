#!/usr/bin/env bash
# Fase 8.4 — harness de testes de integração (Postgres real isolado).
#
# - Usa SOMENTE o container descartável atendechat-f84-testdb (127.0.0.1:55499, user f84).
# - Cria um database próprio por execução (f84_it_<timestamp>) e o remove ao final (trap).
# - Compila o backend em backend/dist-it (nunca toca em backend/dist) e roda as migrations.
# - Roda jest com backend/jest.integration.config.js (--runInBand).
#
# Uso:  scripts/test-integration-f84.sh [args extras do jest, ex.: -t "baixa manual"]
# Env opcionais:
#   KEEP_DB=1        não remove o database ao final (debug)
#   KEEP_DIST_IT=1   não remove backend/dist-it ao final
#   SKIP_BUILD=1     reaproveita backend/dist-it existente
set -uo pipefail

CONTAINER="atendechat-f84-testdb"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
LOG_DIR="$(mktemp -d -t f84-it)"
DB_NAME="f84_it_$(date +%Y%m%d%H%M%S)_$$"

export NODE_ENV=test
export DB_DIALECT=postgres
export DB_HOST=127.0.0.1
export DB_PORT=55499
export DB_USER=f84
export DB_PASS=f84local
export DB_NAME
export DB_DEBUG=false
# Segredos SOMENTE de teste (nunca reais).
export JWT_SECRET="f84-it-jwt-secret"
export JWT_REFRESH_SECRET="f84-it-jwt-refresh-secret"
# Nunca chamar Efí real: flags seguras.
export GERENCIANET_SANDBOX=true
export EFI_COBRANCAS_SETTLE_ENABLED=false
export EFI_BOLETO_ENABLED=false
export EFI_CARD_ENABLED=false
export SAAS_BILLING_AUTO_RENEW_ON_PAYMENT=true
export SAAS_BILLING_AUTO_INVOICE=false
# Evita conexões Redis acidentais (não usamos o app completo).
export REDIS_URI="${REDIS_URI:-redis://127.0.0.1:1}"

cleanup() {
  local code=$?
  if [ "${KEEP_DB:-0}" != "1" ]; then
    docker exec "$CONTAINER" dropdb -U f84 --if-exists --force "$DB_NAME" >/dev/null 2>&1 \
      || docker exec "$CONTAINER" dropdb -U f84 --if-exists "$DB_NAME" >/dev/null 2>&1
    echo "[it] database $DB_NAME removido"
  else
    echo "[it] KEEP_DB=1 — database $DB_NAME mantido"
  fi
  if [ "${KEEP_DIST_IT:-0}" != "1" ] && [ -d "$BACKEND_DIR/dist-it" ]; then
    rm -rf "$BACKEND_DIR/dist-it"
  fi
  exit $code
}
trap cleanup EXIT INT TERM

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "[it] container $CONTAINER não está rodando" >&2
  exit 2
fi

echo "[it] criando database $DB_NAME"
docker exec "$CONTAINER" createdb -U f84 "$DB_NAME" || exit 2

cd "$BACKEND_DIR" || exit 2

if [ "${SKIP_BUILD:-0}" != "1" ] || [ ! -f dist-it/config/database.js ]; then
  echo "[it] compilando backend em dist-it (tsc)"
  rm -rf dist-it
  # Compila apenas o grafo de config + migrations (muito mais rápido que o projeto inteiro).
  # tsc emite mesmo com erros de tipo; erros são exibidos mas não bloqueiam as migrations.
  npx tsc --target es2020 --module commonjs --rootDir src --outDir dist-it \
    --esModuleInterop --experimentalDecorators --emitDecoratorMetadata --skipLibCheck \
    src/config/database.ts src/database/migrations/*.ts > "$LOG_DIR/tsc.log" 2>&1
  TSC_CODE=$?
  if [ $TSC_CODE -ne 0 ]; then
    echo "[it] AVISO: tsc retornou $TSC_CODE (ver abaixo); seguindo se dist-it foi emitido"
    head -40 "$LOG_DIR/tsc.log"
  fi
  if [ ! -f dist-it/config/database.js ]; then
    echo "[it] dist-it não foi emitido" >&2
    exit 2
  fi
fi

# Migrations com nova tentativa: a migration legada 20231220192536-add-unique-constraint-to-Tickets-table
# dispara removeConstraint/addConstraint sem await (operador vírgula) e falha de forma intermitente em
# banco novo ("relation contactid_companyid_unique already exists"); rodar de novo continua de onde parou.
# Também absorve "unknown timed out" (retry.timeout=30s do config) com a máquina carregada.
echo "[it] rodando migrations"
MIG_OK=0
for attempt in 1 2 3 4 5; do
  npx sequelize db:migrate \
    --config dist-it/config/database.js \
    --migrations-path dist-it/database/migrations > "$LOG_DIR/migrate.$attempt.log" 2>&1
  MIG_CODE=$?
  if [ $MIG_CODE -eq 0 ] && ! grep -q "ERROR" "$LOG_DIR/migrate.$attempt.log"; then
    MIG_OK=1
    tail -2 "$LOG_DIR/migrate.$attempt.log"
    break
  fi
  echo "[it] tentativa $attempt de migrations falhou:"
  grep "ERROR" "$LOG_DIR/migrate.$attempt.log" | tail -3
done
if [ $MIG_OK -ne 1 ]; then
  echo "[it] migrations falharam após 5 tentativas" >&2
  exit 3
fi

echo "[it] rodando jest (integração)"
npx jest -c jest.integration.config.js --runInBand "$@"
