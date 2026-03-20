#!/usr/bin/env bash
set -e

###############################################################################
# INSTALAÇÃO ATENDECHAT – Ubuntu 20.04, Postgres + Redis local
# Um único script para instalar tudo. Ao finalizar, basta acessar o sistema.
###############################################################################

PROJETO_DIR="/var/www/atendechat"
LINUX_USER="root"

###############################################################################
# PERGUNTA O IP DO SERVIDOR
###############################################################################
echo ""
echo "=============================================="
echo "  Instalação Atendechat"
echo "=============================================="
echo ""

if [ -z "$SERVER_IP" ]; then
  if [ -t 0 ]; then
    echo "Qual é o IP do servidor onde está instalando?"
    echo "(O IP que você usará para acessar o sistema, ex: 89.117.79.221)"
    echo ""
    echo -n "Digite o IP [Enter para detectar automaticamente]: "
    read -r SERVER_IP
  fi

  if [ -z "$SERVER_IP" ]; then
    echo ""
    echo "==> Detectando IP automaticamente..."
    SERVER_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || curl -s --max-time 3 icanhazip.com 2>/dev/null)
    if [ -z "$SERVER_IP" ]; then
      SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    if [ -z "$SERVER_IP" ]; then
      SERVER_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    fi
    if [ -z "$SERVER_IP" ]; then
      echo ">> ERRO: Não foi possível detectar o IP."
      echo "   Execute novamente e digite o IP manualmente."
      exit 1
    fi
    echo "    IP detectado: ${SERVER_IP}"
  else
    # Remove espaços
    SERVER_IP=$(echo "$SERVER_IP" | xargs)
    echo ""
    echo "    IP informado: ${SERVER_IP}"
  fi
fi

echo ""
echo ">>> O sistema será configurado para: http://${SERVER_IP}"
if [ -t 0 ]; then
  echo ">>> Iniciando instalação em 3 segundos... (Ctrl+C para cancelar)"
  sleep 3
fi
echo ""

DB_NAME="atendechat"
DB_USER="atendechat"
DB_PASS="AtendechatDB2024!"   # troque por uma senha forte se quiser

REDIS_PASS=""                 # deixe vazio para Redis sem senha

# Para usar domínio depois, preencha e rode o script de novo:
DOMAIN=""
API_DOMAIN=""

###############################################################################
echo "==> Atualizando sistema"
apt update && apt upgrade -y

echo "==> Instalando Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs build-essential

echo "==> Instalando PostgreSQL"
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "==> Criando usuário e banco no PostgreSQL"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

echo "==> Habilitando extensões do PostgreSQL (uuid-ossp, pgcrypto)"
sudo -u postgres psql -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
sudo -u postgres psql -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";' 2>/dev/null || true

echo "==> Instalando Redis"
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

if [ -n "$REDIS_PASS" ]; then
  echo "==> Configurando senha no Redis"
  sed -i "s/^# *requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf
  systemctl restart redis-server
  REDIS_URI="redis://:${REDIS_PASS}@127.0.0.1:6379"
else
  REDIS_URI="redis://127.0.0.1:6379"
fi

echo "==> Instalando Nginx"
apt install -y nginx
systemctl enable nginx
systemctl start nginx

###############################################################################
# PASTA DO PROJETO
###############################################################################
echo "==> Preparando pasta do projeto em ${PROJETO_DIR}"
mkdir -p "${PROJETO_DIR}"

if [ ! -d "${PROJETO_DIR}/backend" ]; then
  echo ">> ERRO: pasta backend não encontrada em ${PROJETO_DIR}."
  echo "   Copie o projeto (backend + frontend) para ${PROJETO_DIR} e rode: ./install.sh"
  exit 1
fi

###############################################################################
# BACKEND
###############################################################################
echo "==> Configurando backend (.env)"
cd "${PROJETO_DIR}/backend"

if [ -n "$DOMAIN" ] && [ -n "$API_DOMAIN" ]; then
  BACKEND_URL_VALUE="https://${API_DOMAIN}"
  FRONTEND_URL_VALUE="https://${DOMAIN}"
else
  # Com IP: frontend e API usam a mesma origem (porta 80); Nginx faz proxy para o backend
  BACKEND_URL_VALUE="http://${SERVER_IP}"
  FRONTEND_URL_VALUE="http://${SERVER_IP}"
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

# Remove linhas antigas e adiciona as corretas
for key in NODE_ENV BACKEND_URL FRONTEND_URL PROXY_PORT PORT DB_DIALECT DB_HOST DB_PORT DB_USER DB_PASS DB_NAME REDIS_URI; do
  sed -i "/^${key}=/d" .env 2>/dev/null || true
done

cat >> .env << EOF

NODE_ENV=production
BACKEND_URL=${BACKEND_URL_VALUE}
FRONTEND_URL=${FRONTEND_URL_VALUE}
PROXY_PORT=443
PORT=8080

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}

REDIS_URI=${REDIS_URI}
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000
EOF

echo "==> Instalando dependências do backend"
npm install --production=false

echo "==> Build do backend"
npm run build

echo "==> Migrações do banco"
npx sequelize db:migrate

echo "==> Seeds do banco"
npx sequelize db:seed:all || true

###############################################################################
# FRONTEND
###############################################################################
echo "==> Configurando frontend (.env)"
cd "${PROJETO_DIR}/frontend"

sed -i '/^REACT_APP_BACKEND_URL=/d' .env 2>/dev/null || true
sed -i '/^REACT_APP_HOURS_CLOSE_TICKETS_AUTO=/d' .env 2>/dev/null || true
touch .env

cat >> .env << EOF
REACT_APP_BACKEND_URL=${BACKEND_URL_VALUE}
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24
EOF

echo "==> Instalando dependências do frontend"
npm install

echo "==> Build do frontend"
npm run build

###############################################################################
# SYSTEMD BACKEND
###############################################################################
echo "==> Criando serviço systemd do backend"
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

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable atendechat-backend
systemctl restart atendechat-backend

###############################################################################
# NGINX
###############################################################################
if [ -n "$DOMAIN" ] && [ -n "$API_DOMAIN" ]; then
  echo "==> Configurando Nginx (domínio + subdomínio)"
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
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/atendechat-frontend /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/atendechat-backend /etc/nginx/sites-enabled/
else
  echo "==> Configurando Nginx (acesso por IP ${SERVER_IP})"
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  cat > /etc/nginx/sites-available/atendechat << 'NGINX_EOF'
server {
    listen 80 default_server;
    server_name _;
    root PROJETO_DIR/frontend/build;
    index index.html;

    # Proxy das requisições da API para o backend
    location ~ ^/(auth|users|settings|contacts|tickets|whatsapp|messages|whatsappSession|queues|companies|plans|ticketNotes|quickMessages|helps|dashboard|queueOptions|schedules|tags|contactLists|contactListItems|campaigns|campaignSettings|announcements|chats|subscription|invoices|ticketTags|files|prompts|queueIntegrations|forgetpassword|flowDefault|flowBuilder|flowCampaign|public|socket\.io) {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_EOF
  sed -i "s|PROJETO_DIR|${PROJETO_DIR}|g" /etc/nginx/sites-available/atendechat
  ln -sf /etc/nginx/sites-available/atendechat /etc/nginx/sites-enabled/
fi

echo "==> Testando e reiniciando Nginx"
nginx -t && systemctl restart nginx || {
  echo ">> AVISO: Nginx não reiniciou. Verifique: systemctl status nginx; journalctl -u nginx -n 30"
  echo "   Se a porta 80 estiver em uso: ss -tlnp | grep :80"
}

###############################################################################
echo ""
echo "=============================================="
echo "  INSTALAÇÃO CONCLUÍDA!"
echo "=============================================="
echo ""
echo "  Acesse o sistema:"
echo "    http://${SERVER_IP}"
echo ""
echo "  Login padrão:"
echo "    Usuário: admin@admin.com"
echo "    Senha:   123456"
echo ""
echo "  Abra o firewall se necessário:"
echo "    ufw allow 22 && ufw allow 80 && ufw enable"
echo ""
echo "  Tudo pronto! Basta acessar o link acima."
echo "=============================================="
echo ""
