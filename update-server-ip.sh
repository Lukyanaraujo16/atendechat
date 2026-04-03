#!/usr/bin/env bash
###############################################################################
# Atualização completa do Atendechat no servidor (após git pull ou sozinho).
#
# Uso:
#   sudo ./update-server-ip.sh              # detecta IP; faz git pull se for repositório
#   sudo ./update-server-ip.sh 89.117.79.221
#
# Variáveis opcionais:
#   PROJETO_DIR=/caminho   (padrão: /var/www/atendechat)
#   SKIP_GIT_PULL=1        não executa git pull
#   SKIP_NGINX=1           não reescreve /etc/nginx (útil sem permissão root parcial)
#
# Requer: sudo (grava Nginx em /etc/nginx). Node/npm no PATH.
###############################################################################
set -euo pipefail

PROJETO_DIR="${PROJETO_DIR:-/var/www/atendechat}"

if [ -n "${1:-}" ]; then
  NEW_IP="$1"
else
  echo "==> Detectando IP do servidor..."
  NEW_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || curl -s --max-time 3 icanhazip.com 2>/dev/null)
  if [ -z "$NEW_IP" ]; then
    NEW_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  if [ -z "$NEW_IP" ]; then
    NEW_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
  fi
  if [ -z "$NEW_IP" ]; then
    echo ">> ERRO: Não foi possível detectar o IP. Use: sudo ./update-server-ip.sh SEU_IP"
    exit 1
  fi
  echo "    IP detectado: ${NEW_IP}"
fi

if [ ! -d "${PROJETO_DIR}/backend" ] || [ ! -d "${PROJETO_DIR}/frontend" ]; then
  echo ">> ERRO: Pastas backend/frontend não encontradas em ${PROJETO_DIR}"
  exit 1
fi

echo ""
echo "=============================================="
echo "  Atendechat — atualização (IP: ${NEW_IP})"
echo "  Pasta: ${PROJETO_DIR}"
echo "=============================================="
echo ""

cd "${PROJETO_DIR}"

###############################################################################
# 1) Git pull
###############################################################################
if [ -z "${SKIP_GIT_PULL:-}" ] && [ -d ".git" ]; then
  echo "==> git pull"
  git pull --rebase 2>/dev/null || git pull
  echo ""
elif [ -n "${SKIP_GIT_PULL:-}" ]; then
  echo "==> SKIP_GIT_PULL=1 — pulando git pull"
  echo ""
fi

###############################################################################
# 2) .env — URLs (mesma origem na porta 80; Nginx faz proxy para :8080)
###############################################################################
BACKEND_ENV="${PROJETO_DIR}/backend/.env"
FRONTEND_ENV="${PROJETO_DIR}/frontend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
  if [ -f "${PROJETO_DIR}/backend/.env.example" ]; then
    echo "==> Criando backend/.env a partir de .env.example"
    cp "${PROJETO_DIR}/backend/.env.example" "$BACKEND_ENV"
  else
    echo ">> ERRO: ${BACKEND_ENV} não existe e não há .env.example."
    exit 1
  fi
fi

echo "==> Ajustando BACKEND_URL / FRONTEND_URL em backend/.env"
sed -i '/^BACKEND_URL=/d' "$BACKEND_ENV" 2>/dev/null || true
sed -i '/^FRONTEND_URL=/d' "$BACKEND_ENV" 2>/dev/null || true
{
  echo "BACKEND_URL=http://${NEW_IP}"
  echo "FRONTEND_URL=http://${NEW_IP}"
} >> "$BACKEND_ENV"

touch "$FRONTEND_ENV"
echo "==> Ajustando REACT_APP_BACKEND_URL em frontend/.env"
sed -i '/^REACT_APP_BACKEND_URL=/d' "$FRONTEND_ENV" 2>/dev/null || true
sed -i '/^REACT_APP_BACKEND_PORT=/d' "$FRONTEND_ENV" 2>/dev/null || true
{
  echo "REACT_APP_BACKEND_URL=http://${NEW_IP}"
  echo "REACT_APP_BACKEND_PORT=8080"
} >> "$FRONTEND_ENV"
if ! grep -q '^REACT_APP_HOURS_CLOSE_TICKETS_AUTO=' "$FRONTEND_ENV" 2>/dev/null; then
  echo "REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24" >> "$FRONTEND_ENV"
fi

###############################################################################
# 3) Backend: dependências, build, migrations
###############################################################################
echo ""
echo "==> Backend: npm install"
cd "${PROJETO_DIR}/backend"
npm install --no-audit --no-fund

echo ""
echo "==> Backend: npm run build (TypeScript)"
npm run build

if [ ! -f "${PROJETO_DIR}/backend/dist/server.js" ]; then
  echo ">> ERRO: dist/server.js não foi gerado."
  exit 1
fi

echo ""
echo "==> Backend: sequelize db:migrate"
npx sequelize db:migrate

###############################################################################
# 4) Frontend: dependências e build (REACT_* já está no .env)
###############################################################################
echo ""
echo "==> Frontend: npm install"
cd "${PROJETO_DIR}/frontend"
npm install --no-audit --no-fund

echo ""
echo "==> Frontend: npm run build"
npm run build

if [ ! -f "${PROJETO_DIR}/frontend/build/index.html" ]; then
  echo ">> ERRO: frontend/build/index.html não encontrado após o build."
  exit 1
fi

###############################################################################
# 5) Nginx
###############################################################################
if [ -n "${SKIP_NGINX:-}" ]; then
  echo ""
  echo "==> SKIP_NGINX=1 — não alterando Nginx"
else
  if [ "$(id -u)" -ne 0 ]; then
    echo ""
    echo ">> AVISO: Sem permissão de root — não foi possível gravar Nginx."
    echo "   Rode: sudo $0 ${NEW_IP}"
  else
    echo ""
    echo "==> Nginx: proxy da API (incl. /ticket/kanban e /groups)"
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    cat > /etc/nginx/sites-available/atendechat << NGINX_EOF
server {
    listen 80 default_server;
    server_name _;
    root ${PROJETO_DIR}/frontend/build;
    index index.html;

    location ~ ^/(auth|users|settings|contacts|ticket|tickets|groups|whatsapp|messages|whatsappSession|queue|queues|companies|plans|ticketNotes|quickMessages|helps|dashboard|queueOptions|schedules|tags|contactLists|contactListItems|campaigns|campaignSettings|announcements|chats|subscription|invoices|ticketTags|files|prompts|queueIntegrations|forgetpassword|flowdefault|flowbuilder|flowcampaign|user-ratings|rating-templates|public|socket\.io) {
        proxy_pass http://127.0.0.1:8080;
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

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_EOF
    ln -sf /etc/nginx/sites-available/atendechat /etc/nginx/sites-enabled/ 2>/dev/null || true
    nginx -t
    systemctl reload nginx
    echo "   Nginx OK"
  fi
fi

###############################################################################
# 6) Reiniciar backend
###############################################################################
echo ""
echo "==> Reiniciando serviço do backend"
if systemctl restart atendechat-backend 2>/dev/null; then
  echo "   atendechat-backend reiniciado"
elif systemctl restart backend 2>/dev/null; then
  echo "   backend reiniciado"
else
  echo "   AVISO: systemd não encontrou atendechat-backend/backend — reinicie manualmente o Node na porta 8080"
fi

echo ""
echo "=============================================="
echo "  Concluído!"
echo "  Acesse: http://${NEW_IP}"
echo "=============================================="
echo ""
