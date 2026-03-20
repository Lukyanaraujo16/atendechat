#!/usr/bin/env bash
###############################################################################
# Script para atualizar o IP do servidor após migração
# Uso: ./update-server-ip.sh           (detecta IP automaticamente)
#      ./update-server-ip.sh 1.2.3.4   (usa IP informado)
###############################################################################

PROJETO_DIR="${PROJETO_DIR:-/var/www/atendechat}"

if [ -n "$1" ]; then
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
    echo ">> ERRO: Não foi possível detectar o IP. Use: ./update-server-ip.sh SEU_IP"
    exit 1
  fi
  echo "    IP detectado: ${NEW_IP}"
fi

echo "==> Atualizando IP do servidor para: ${NEW_IP}"
echo "==> Pasta do projeto: ${PROJETO_DIR}"
echo ""

# Backend .env (usa mesma origem - Nginx faz proxy para backend)
BACKEND_ENV="${PROJETO_DIR}/backend/.env"
if [ -f "$BACKEND_ENV" ]; then
  echo ">> Atualizando backend/.env"
  sed -i "s|BACKEND_URL=.*|BACKEND_URL=http://${NEW_IP}|" "$BACKEND_ENV"
  sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://${NEW_IP}|" "$BACKEND_ENV"
  echo "   BACKEND_URL=http://${NEW_IP}"
  echo "   FRONTEND_URL=http://${NEW_IP}"
else
  echo ">> AVISO: ${BACKEND_ENV} não encontrado"
fi

# Frontend .env
FRONTEND_ENV="${PROJETO_DIR}/frontend/.env"
if [ -f "$FRONTEND_ENV" ]; then
  echo ""
  echo ">> Atualizando frontend/.env"
  sed -i "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=http://${NEW_IP}|" "$FRONTEND_ENV"
  echo "   REACT_APP_BACKEND_URL=http://${NEW_IP}"
else
  echo ""
  echo ">> AVISO: ${FRONTEND_ENV} não encontrado"
fi

# Atualizar Nginx com proxy (para que /auth, /users, etc. sejam encaminhados ao backend)
echo ""
echo ">> Atualizando Nginx (proxy da API)..."
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
cat > /etc/nginx/sites-available/atendechat << NGINX_EOF
server {
    listen 80 default_server;
    server_name _;
    root ${PROJETO_DIR}/frontend/build;
    index index.html;

    location ~ ^/(auth|users|settings|contacts|tickets|whatsapp|messages|whatsappSession|queues|companies|plans|ticketNotes|quickMessages|helps|dashboard|queueOptions|schedules|tags|contactLists|contactListItems|campaigns|campaignSettings|announcements|chats|subscription|invoices|ticketTags|files|prompts|queueIntegrations|forgetpassword|flowDefault|flowBuilder|flowCampaign|public|socket\.io) {
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
if nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null && echo "   Nginx atualizado"
else
  echo "   AVISO: Erro ao testar Nginx. Verifique: nginx -t"
fi

# Rebuild do frontend (REACT_APP_* é embutido no build)
echo ""
echo ">> Reconstruindo frontend (isso pode demorar alguns minutos)..."
cd "${PROJETO_DIR}/frontend" && npm run build

# Reiniciar backend
echo ""
echo ">> Reiniciando backend..."
systemctl restart atendechat-backend 2>/dev/null || systemctl restart backend 2>/dev/null || echo "   Reinicie o backend manualmente"

echo ""
echo "==> Concluído! Acesse: http://${NEW_IP}"
echo "==> Se ainda não funcionar, reinicie o Nginx: systemctl restart nginx"
