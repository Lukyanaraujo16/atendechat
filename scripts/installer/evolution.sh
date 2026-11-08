#!/usr/bin/env bash
# Evolution API (WhatsApp) em Docker Compose, na mesma VPS do StreamHub Chat.
# Versão fixada: a integração do backend foi escrita e testada contra a v2.3.7
# (backend/src/modules/whatsapp/providers/evolution/inbound/evolutionHttpClient.ts).
# Requer lib.sh carregada.
# shellcheck disable=SC2034

EVOLUTION_IMAGE="${EVOLUTION_IMAGE:-evoapicloud/evolution-api:v2.3.7}"
EVOLUTION_POSTGRES_IMAGE="postgres:15-alpine"
EVOLUTION_REDIS_IMAGE="redis:7.2-alpine"
EVOLUTION_DIR="${EVOLUTION_DIR:-/opt/streamhub/evolution}"
# Porta só no loopback: a Evolution não fica exposta à internet.
EVOLUTION_HOST_PORT="${EVOLUTION_HOST_PORT:-8085}"
EVOLUTION_LOCAL_URL="http://127.0.0.1:${EVOLUTION_HOST_PORT}"

# Gera docker-compose.yml e .env (600). Segredos existentes são preservados;
# só são gerados os que faltam. Executar de novo não altera credenciais.
evolution_render() {
  local dir="${1:-$EVOLUTION_DIR}" env_file
  mkdir -p "$dir"
  chmod 700 "$dir"
  env_file="$dir/.env"
  if [[ ! -f "$env_file" ]]; then (umask 077 && : >"$env_file"); fi
  chmod 600 "$env_file"

  local api_key pg_pass redis_pass
  env_set_if_empty "$env_file" AUTHENTICATION_API_KEY "$(gen_secret 32)" || true
  env_set_if_empty "$env_file" POSTGRES_PASSWORD "$(gen_secret 24)" || true
  env_set_if_empty "$env_file" REDIS_PASSWORD "$(gen_secret 24)" || true
  api_key="$(env_get "$env_file" AUTHENTICATION_API_KEY)"
  pg_pass="$(env_get "$env_file" POSTGRES_PASSWORD)"
  redis_pass="$(env_get "$env_file" REDIS_PASSWORD)"
  if is_insecure_secret "$api_key"; then
    ui_fail "AUTHENTICATION_API_KEY da Evolution usa um valor público de exemplo." \
      "Remova a linha AUTHENTICATION_API_KEY de ${env_file} e execute de novo (as conexões Evolution existentes precisarão ser recriadas)."
  fi

  # Valores derivados (sempre reescritos; não são segredos novos).
  env_set "$env_file" POSTGRES_USERNAME evolution
  env_set "$env_file" POSTGRES_DATABASE evolution
  env_set "$env_file" SERVER_TYPE http
  env_set "$env_file" SERVER_PORT 8080
  env_set "$env_file" SERVER_URL "$EVOLUTION_LOCAL_URL"
  env_set "$env_file" DEL_INSTANCE false
  env_set "$env_file" DATABASE_PROVIDER postgresql
  env_set "$env_file" DATABASE_CONNECTION_URI "postgresql://evolution:${pg_pass}@evolution-postgres:5432/evolution?schema=evolution_api"
  env_set "$env_file" DATABASE_CONNECTION_CLIENT_NAME evolution_streamhub
  env_set "$env_file" DATABASE_SAVE_DATA_INSTANCE true
  env_set "$env_file" DATABASE_SAVE_DATA_NEW_MESSAGE true
  env_set "$env_file" DATABASE_SAVE_MESSAGE_UPDATE true
  env_set "$env_file" DATABASE_SAVE_DATA_CONTACTS true
  env_set "$env_file" DATABASE_SAVE_DATA_CHATS true
  env_set "$env_file" CACHE_REDIS_ENABLED true
  env_set "$env_file" CACHE_REDIS_URI "redis://:${redis_pass}@evolution-redis:6379/6"
  env_set "$env_file" CACHE_REDIS_PREFIX_KEY evolution
  env_set "$env_file" CACHE_REDIS_SAVE_INSTANCES false
  env_set "$env_file" CACHE_LOCAL_ENABLED false
  env_set "$env_file" AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES true
  env_set "$env_file" CONFIG_SESSION_PHONE_CLIENT "StreamHub Chat"
  env_set "$env_file" CONFIG_SESSION_PHONE_NAME Chrome
  env_set "$env_file" QRCODE_LIMIT 30
  # O StreamHub configura o webhook por instância (ensureEvolutionInstance.ts); global desligado.
  env_set "$env_file" WEBHOOK_GLOBAL_ENABLED false
  env_set "$env_file" TELEMETRY_ENABLED false
  env_set "$env_file" LOG_LEVEL "ERROR,WARN,INFO"
  env_set "$env_file" LOG_BAILEYS error
  env_set "$env_file" TZ America/Sao_Paulo

  cat >"$dir/docker-compose.yml" <<EOF
# Gerado por install.sh (StreamHub Chat). Alterações manuais podem ser sobrescritas.
# Segredos ficam em .env (600). Nomes dos contêineres usados pelo coletor de métricas
# (deploy/evolution-metrics-collector/collector.env.example).
name: streamhub-evolution

services:
  evolution-api:
    container_name: evolution-api
    image: ${EVOLUTION_IMAGE}
    restart: unless-stopped
    env_file: .env
    depends_on:
      evolution-postgres:
        condition: service_healthy
      evolution-redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:${EVOLUTION_HOST_PORT}:8080"
    volumes:
      - evolution_instances:/evolution/instances
    networks: [evolution-net]
    logging:
      driver: json-file
      options: { max-size: "20m", max-file: "5" }

  evolution-postgres:
    container_name: evolution-postgres
    image: ${EVOLUTION_POSTGRES_IMAGE}
    restart: unless-stopped
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - evolution_postgres:/var/lib/postgresql/data
    networks: [evolution-net]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evolution -d evolution"]
      interval: 10s
      timeout: 5s
      retries: 10
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  evolution-redis:
    container_name: evolution-redis
    image: ${EVOLUTION_REDIS_IMAGE}
    restart: unless-stopped
    # Senha via stdin (configuração "-"), não em argv.
    command: ["sh", "-c", "printf 'appendonly yes\\nrequirepass %s\\n' \"\$\$REDIS_PASSWORD\" | exec redis-server -"]
    environment:
      REDIS_PASSWORD: \${REDIS_PASSWORD}
    volumes:
      - evolution_redis:/data
    networks: [evolution-net]
    healthcheck:
      test: ["CMD-SHELL", "REDISCLI_AUTH=\"\$\$REDIS_PASSWORD\" redis-cli ping | grep -q PONG"]
      interval: 10s
      timeout: 5s
      retries: 10
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

volumes:
  evolution_instances:
  evolution_postgres:
  evolution_redis:

networks:
  evolution-net:
    name: streamhub-evolution-net
EOF
  chmod 600 "$dir/docker-compose.yml"
}

evolution_compose() {
  docker compose --project-directory "$EVOLUTION_DIR" -f "$EVOLUTION_DIR/docker-compose.yml" "$@"
}

# A key vai por arquivo (-H @), nunca em argv.
# Aguarda GET / responder 200 com a API key. Imprime a versão.
evolution_wait_healthy() {
  local url="${1:-$EVOLUTION_LOCAL_URL}" key="$2" timeout="${3:-180}" i body
  for ((i = 0; i < timeout; i += 5)); do
    body="$(curl -fsS --max-time 5 -H @<(printf 'apikey: %s\n' "$key") "${url}/" 2>/dev/null || true)"
    if [[ "$body" == *"version"* ]]; then
      printf '%s' "$body" | grep -oE '"version" *: *"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/'
      return 0
    fi
    sleep 5
  done
  return 1
}

# Confirma que a key é aceita (endpoint autenticado). 0 = aceita.
evolution_check_key() {
  local url="$1" key="$2" code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H @<(printf 'apikey: %s\n' "$key") "${url}/instance/fetchInstances" 2>/dev/null || echo 000)"
  [[ "$code" == "200" ]]
}
