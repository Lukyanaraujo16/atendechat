#!/usr/bin/env bash
###############################################################################
# ATENDECHAT — install.sh (Ubuntu Server 20.04+)
#
# Fluxo: git pull → ./install.sh → sistema funcional (sem editar .env na mão)
#
# O que este script garante:
#   • Backend Node na porta API_PORT (8080), acessível em 0.0.0.0 (rede)
#   • Frontend build com REACT_APP_BACKEND_URL = http(s)://host:8080 (API real)
#   • FRONTEND_URL / CORS = origem onde o utilizador abre o browser (ex. :80)
#   • Nginx na :80 só serve o SPA (build estático) — a API NÃO passa pelo Nginx
#     (evita 405 em POST /system-settings/branding e rotas em falta no proxy)
#   • Firewall: portas 22, 80, API_PORT abertas (ufw)
#
# Variáveis opcionais (antes de executar):
#   SERVER_IP=1.2.3.4     — IP público (senão pergunta ou detecta)
#   PROJETO_DIR=/caminho  — raiz do repo (senão = pasta onde está este install.sh)
#   MINIMAL_UPDATE=1      — só dependências + build + restart (sem apt upgrade)
#   DOMAIN + API_DOMAIN   — modo HTTPS com dois hosts (como antes)
#
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

###############################################################################
# Raiz do projeto (pasta que contém backend/ e frontend/)
###############################################################################
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${PROJETO_DIR:-}" ]]; then
  PROJETO_DIR="$SCRIPT_DIR"
fi

API_PORT="${API_PORT:-8080}"
LINUX_USER="${LINUX_USER:-root}"

DB_NAME="${DB_NAME:-atendechat}"
DB_USER="${DB_USER:-atendechat}"
DB_PASS="${DB_PASS:-AtendechatDB2024!}"
REDIS_PASS="${REDIS_PASS:-}"
DOMAIN="${DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"

MINIMAL_UPDATE="${MINIMAL_UPDATE:-0}"

echo ""
echo "=============================================="
echo "  Atendechat — instalação / atualização"
echo "=============================================="
echo ""
echo ">>> Diretório do projeto: ${PROJETO_DIR}"

if [[ ! -d "${PROJETO_DIR}/backend" || ! -d "${PROJETO_DIR}/frontend" ]]; then
  echo ">> ERRO: Esperado ${PROJETO_DIR}/backend e ${PROJETO_DIR}/frontend"
  echo "   Defina PROJETO_DIR para a raiz do repositório ou coloque install.sh na raiz."
  exit 1
fi

###############################################################################
# IP / URLs públicas
###############################################################################
if [[ -z "${SERVER_IP:-}" ]]; then
  if [[ -t 0 ]]; then
    echo "Qual é o IP ou hostname que os utilizadores usam no browser?"
    echo "(ex.: 89.117.79.221 — Enter para detetar automaticamente)"
    echo ""
    read -r -p "IP [Enter = auto]: " SERVER_IP
  fi
  if [[ -z "${SERVER_IP:-}" ]]; then
    echo "==> A detetar IP público..."
    SERVER_IP=$(curl -fsS --max-time 4 ifconfig.me 2>/dev/null || true)
    if [[ -z "$SERVER_IP" ]]; then
      SERVER_IP=$(curl -fsS --max-time 4 icanhazip.com 2>/dev/null || true)
    fi
    if [[ -z "$SERVER_IP" ]]; then
      SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    if [[ -z "$SERVER_IP" ]]; then
      SERVER_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    fi
    if [[ -z "$SERVER_IP" ]]; then
      echo ">> ERRO: Não foi possível detetar o IP. Execute: SERVER_IP=x.x.x.x $0"
      exit 1
    fi
    echo "    IP detetado: ${SERVER_IP}"
  else
    SERVER_IP=$(echo "$SERVER_IP" | xargs)
    echo "    IP informado: ${SERVER_IP}"
  fi
else
  SERVER_IP=$(echo "$SERVER_IP" | xargs)
  echo "    SERVER_IP (env): ${SERVER_IP}"
fi

# URLs finais
if [[ -n "$DOMAIN" && -n "$API_DOMAIN" ]]; then
  FRONTEND_URL_VALUE="https://${DOMAIN}"
  # API pública: subdomínio dedicado (Nginx faz proxy para 127.0.0.1:API_PORT)
  API_PUBLIC_URL="https://${API_DOMAIN}"
  BACKEND_URL_VALUE="${API_PUBLIC_URL}"
else
  # Modo IP: utilizador abre http://IP:80 ; API em http://IP:API_PORT (directo; Nginx não faz proxy da API)
  FRONTEND_URL_VALUE="http://${SERVER_IP}"
  API_PUBLIC_URL="http://${SERVER_IP}:${API_PORT}"
  BACKEND_URL_VALUE="${API_PUBLIC_URL}"
fi

echo ""
echo ">>> Frontend (browser):  ${FRONTEND_URL_VALUE}"
echo ">>> API Node (axios):      ${API_PUBLIC_URL}"
echo ">>> Porta interna Node:    ${API_PORT}"
echo ""

if [[ "${MINIMAL_UPDATE}" != "1" ]] && [[ -t 0 ]]; then
  echo "A continuar em 3 s... (Ctrl+C para cancelar)"
  sleep 3
fi
echo ""

###############################################################################
# Função: escrever .env do backend (idempotente)
###############################################################################
write_backend_env() {
  local env_file="${PROJETO_DIR}/backend/.env"
  if [[ ! -f "$env_file" ]]; then
    cp "${PROJETO_DIR}/backend/.env.example" "$env_file"
  fi
  # Remover chaves que vamos recalcular
  local keys=(
    NODE_ENV BACKEND_URL FRONTEND_URL PROXY_PORT PORT
    DB_DIALECT DB_HOST DB_PORT DB_USER DB_PASS DB_NAME
    REDIS_URI REDIS_OPT_LIMITER_MAX REDIS_OPT_LIMITER_DURATION
  )
  for key in "${keys[@]}"; do
    sed -i "/^${key}=/d" "$env_file" 2>/dev/null || true
  done

  cat >> "$env_file" << EOF

# --- gerado/atualizado por install.sh ---
NODE_ENV=production
BACKEND_URL=${BACKEND_URL_VALUE}
FRONTEND_URL=${FRONTEND_URL_VALUE}
# PROXY_PORT vazio: URLs em models usam só BACKEND_URL (ver QuickMessage.ts)
PROXY_PORT=
PORT=${API_PORT}

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}

REDIS_URI=${REDIS_URI_EFFECTIVE}
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000
EOF
}

###############################################################################
# Função: build frontend com env correto (obrigatório CRA: variáveis na altura do build)
###############################################################################
build_frontend() {
  cd "${PROJETO_DIR}/frontend"
  export REACT_APP_BACKEND_URL="${API_PUBLIC_URL}"
  export REACT_APP_BACKEND_PORT="${API_PORT}"
  export REACT_APP_HOURS_CLOSE_TICKETS_AUTO="${REACT_APP_HOURS_CLOSE_TICKETS_AUTO:-24}"
  export GENERATE_SOURCEMAP="${GENERATE_SOURCEMAP:-false}"

  touch .env
  sed -i '/^REACT_APP_BACKEND_URL=/d' .env 2>/dev/null || true
  sed -i '/^REACT_APP_BACKEND_PORT=/d' .env 2>/dev/null || true
  sed -i '/^REACT_APP_HOURS_CLOSE_TICKETS_AUTO=/d' .env 2>/dev/null || true
  {
    echo "REACT_APP_BACKEND_URL=${API_PUBLIC_URL}"
    echo "REACT_APP_BACKEND_PORT=${API_PORT}"
    echo "REACT_APP_HOURS_CLOSE_TICKETS_AUTO=${REACT_APP_HOURS_CLOSE_TICKETS_AUTO:-24}"
  } >> .env

  npm install
  npm run build
}

###############################################################################
# MINIMAL_UPDATE: só rebuild + serviços
###############################################################################
if [[ "${MINIMAL_UPDATE}" == "1" ]]; then
  echo "==> MINIMAL_UPDATE=1 — a saltar apt/postgres/redis/nginx base"
  if [[ -n "$REDIS_PASS" ]]; then
    REDIS_URI_EFFECTIVE="redis://:${REDIS_PASS}@127.0.0.1:6379"
  else
    REDIS_URI_EFFECTIVE="redis://127.0.0.1:6379"
  fi
  write_backend_env
  cd "${PROJETO_DIR}/backend"
  npm install --production=false
  npm run build
  npx sequelize db:migrate
  build_frontend
  systemctl restart atendechat-backend 2>/dev/null || true
  nginx -t && systemctl reload nginx 2>/dev/null || true
  echo ">> MINIMAL_UPDATE concluído."
  exit 0
fi

###############################################################################
# Sistema base
###############################################################################
echo "==> Atualização de pacotes (apt)"
apt-get update -y
apt-get upgrade -y

echo "==> Pacotes base (git, curl, timezone, libs Puppeteer)"
apt-get install -y git curl ca-certificates gnupg tzdata \
  libxshmfence-dev libgbm-dev libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation || true

if timedatectl list-timezones 2>/dev/null | grep -q "America/Sao_Paulo"; then
  timedatectl set-timezone America/Sao_Paulo 2>/dev/null || true
fi

echo "==> Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs build-essential
fi

echo "==> PM2 (opcional)"
npm install -g pm2@latest || true

echo "==> PostgreSQL"
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "==> Utilizador e base de dados PostgreSQL"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

sudo -u postgres psql -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
sudo -u postgres psql -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";' 2>/dev/null || true

echo "==> Redis"
apt-get install -y redis-server
if [[ -f /etc/redis/redis.conf ]] && grep -q '^supervised no' /etc/redis/redis.conf; then
  sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
fi
systemctl enable redis-server
systemctl start redis-server

if [[ -n "$REDIS_PASS" ]]; then
  sed -i "s/^# *requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf
  systemctl restart redis-server
  REDIS_URI_EFFECTIVE="redis://:${REDIS_PASS}@127.0.0.1:6379"
else
  REDIS_URI_EFFECTIVE="redis://127.0.0.1:6379"
fi

echo "==> Nginx (limite upload)"
apt-get install -y nginx
mkdir -p /etc/nginx/conf.d
printf '%s\n' 'client_max_body_size 100M;' > /etc/nginx/conf.d/atendechat-limits.conf
systemctl enable nginx
systemctl start nginx

###############################################################################
# Firewall (idempotente)
###############################################################################
if command -v ufw >/dev/null 2>&1; then
  echo "==> Firewall (ufw): 22, 80, ${API_PORT}"
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow "${API_PORT}/tcp" >/dev/null 2>&1 || true
  # Não forçamos "ufw enable" para não bloquear SSH em VPS já configuradas
fi

###############################################################################
# Backend: .env, build, migrate
###############################################################################
echo "==> Backend: .env"
write_backend_env

echo "==> Backend: npm install + build"
cd "${PROJETO_DIR}/backend"
npm install --production=false
npm run build

if [[ ! -f dist/server.js ]]; then
  echo ">> ERRO: dist/server.js não encontrado após build."
  exit 1
fi

echo "==> Sequelize migrate"
npx sequelize db:migrate

echo "==> Sequelize seed (pode avisar se já existir dados)"
npx sequelize db:seed:all || echo "    [AVISO] seeds ignorados ou duplicados — OK"

###############################################################################
# Frontend: build com REACT_APP_* na altura certa
###############################################################################
echo "==> Frontend: build (REACT_APP_BACKEND_URL=${API_PUBLIC_URL})"
build_frontend

if [[ ! -f "${PROJETO_DIR}/frontend/build/index.html" ]]; then
  echo ">> ERRO: frontend/build/index.html não encontrado."
  exit 1
fi

###############################################################################
# systemd — backend
###############################################################################
echo "==> systemd: atendechat-backend"
cat > /etc/systemd/system/atendechat-backend.service << EOF
[Unit]
Description=Atendechat Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=${LINUX_USER}
WorkingDirectory=${PROJETO_DIR}/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable atendechat-backend
systemctl restart atendechat-backend

###############################################################################
# Nginx — só SPA estático
# A API fica em API_PORT; o axios/socket apontam para API_PUBLIC_URL (com :8080).
# Isto elimina POST na :80 que o Nginx respondia com 405 (proxy incompleto).
###############################################################################
echo "==> Nginx: site estático"

if [[ -n "$DOMAIN" && -n "$API_DOMAIN" ]]; then
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  cat > /etc/nginx/sites-available/atendechat-frontend << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${PROJETO_DIR}/frontend/build;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  cat > /etc/nginx/sites-available/atendechat-backend << EOF
server {
    listen 80;
    server_name ${API_DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/atendechat-frontend /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/atendechat-backend /etc/nginx/sites-enabled/
else
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  cat > /etc/nginx/sites-available/atendechat << EOF
server {
    listen 80 default_server;
    server_name _;
    root ${PROJETO_DIR}/frontend/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/atendechat /etc/nginx/sites-enabled/
fi

nginx -t
systemctl restart nginx

###############################################################################
echo ""
echo "=============================================="
echo "  Concluído"
echo "=============================================="
echo ""
echo "  Abrir no browser: ${FRONTEND_URL_VALUE}"
echo "  API Node:         ${API_PUBLIC_URL}"
echo ""
echo "  Login padrão (se seed correu): admin@admin.com / 123456"
echo ""
echo "  Atualizações rápidas após git pull:"
echo "    MINIMAL_UPDATE=1 ./install.sh"
echo ""
echo "  Logs backend:"
echo "    journalctl -u atendechat-backend -f --no-pager"
echo ""
echo "=============================================="
echo ""
