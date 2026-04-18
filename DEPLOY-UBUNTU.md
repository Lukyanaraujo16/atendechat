# Deploy no Ubuntu Server 20.04 (VPS)

Este guia descreve **passo a passo** como preparar e rodar o **CoreFlow** em uma VPS com **Ubuntu 20.04**, usando **PostgreSQL** e **Redis** instalados localmente no servidor.

> Os caminhos de exemplo (`/var/www/atendechat`, utilizador `atendechat`, serviço `atendechat-backend`) são **legados** e mantidos para não quebrar instalações existentes; pode renomear localmente se preferir.

---

## Visão geral

- **Backend**: Node.js (Express + Baileys), lê `.env`, usa PostgreSQL e Redis.
- **Frontend**: React (build estático), servido por Nginx (ou pelo próprio backend em modo simples).
- **Banco**: PostgreSQL local.
- **Fila/cache**: Redis local.

---

## 1. Atualizar o sistema

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Instalar Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve mostrar v20.x
npm -v
```

---

## 3. Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

Criar usuário e banco (troque `atendechat` e `SUA_SENHA_SEGURA` pelos valores desejados):

```bash
sudo -u postgres psql -c "CREATE USER atendechat WITH PASSWORD 'SUA_SENHA_SEGURA';"
sudo -u postgres psql -c "CREATE DATABASE atendechat OWNER atendechat;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE atendechat TO atendechat;"
```

Anote: **usuário**, **senha** e **nome do banco** para o `.env` do backend.

---

## 4. Instalar Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

Opcional: definir senha no Redis (recomendado em produção).

```bash
sudo nano /etc/redis/redis.conf
```

Procure por `# requirepass` e descomente, definindo uma senha:

```
requirepass SUA_SENHA_REDIS
```

Reinicie o Redis:

```bash
sudo systemctl restart redis-server
```

Se usou senha, anote para o `.env` (formato: `redis://:SENHA@127.0.0.1:6379`). Sem senha: `redis://127.0.0.1:6379`.

---

## 5. Instalar Nginx (para servir o frontend e, opcionalmente, proxy para o backend)

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

A configuração do Nginx será feita depois do build (passo 12).

---

## 6. Instalar dependências de build (frontend)

```bash
sudo apt install -y build-essential
```

---

## 7. Colocar o projeto na VPS

Exemplos:

- **Git** (se o código estiver em um repositório):

```bash
cd /var/www   # ou outro diretório de sua preferência
sudo mkdir -p atendechat && sudo chown $USER:$USER atendechat
git clone URL_DO_SEU_REPOSITORIO atendechat
cd atendechat
```

- **Upload** (SFTP/SCP/rsync): copie a pasta do projeto (com `backend`, `frontend`, etc.) para algo como `/var/www/atendechat`.

Defina o diretório do projeto como variável para os próximos passos:

```bash
export PROJETO=/var/www/atendechat
cd $PROJETO
```

---

## 8. Configurar o backend (.env)

```bash
cd $PROJETO/backend
cp .env.example .env
nano .env
```

Preencha o `.env` com valores reais. Exemplo para **PostgreSQL local** e **Redis local**:

```env
NODE_ENV=production
BACKEND_URL=https://api.seudominio.com
FRONTEND_URL=https://seudominio.com
PROXY_PORT=443
PORT=8080

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=atendechat
DB_PASS=SUA_SENHA_SEGURA
DB_NAME=atendechat

JWT_SECRET=GERE_UM_TOKEN_LONGO_E_ALEATORIO
JWT_REFRESH_SECRET=OUTRO_TOKEN_LONGO_E_ALEATORIO

REDIS_URI=redis://:SUA_SENHA_REDIS@127.0.0.1:6379
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000

USER_LIMIT=10000
CONNECTIONS_LIMIT=100000
CLOSED_SEND_BY_ME=true

GERENCIANET_SANDBOX=false
GERENCIANET_CLIENT_ID=
GERENCIANET_CLIENT_SECRET=
GERENCIANET_PIX_CERT=
GERENCIANET_PIX_KEY=

MAIL_HOST=smtp.gmail.com
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
MAIL_PORT=465

CAMPAIGN_RATE_LIMIT=10000
CAMPAIGN_BATCH_SIZE=50
```

- Se o Redis **não** tiver senha: `REDIS_URI=redis://127.0.0.1:6379`
- Em produção, use **HTTPS** em `BACKEND_URL` e `FRONTEND_URL` (domínio ou IP com certificado).
- Para testar por IP: use `http://SEU_IP:8080` e `http://SEU_IP` (e abra a porta no firewall).

Salve e feche (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 9. Build e migrações do backend

```bash
cd $PROJETO/backend
npm install --production=false
npm run build
```

Rodar migrações (usa o `dist` e o `.env`):

```bash
npx sequelize db:migrate
```

Rodar seeds (usuário/senha padrão, etc.):

```bash
npx sequelize db:seed:all
```

Se der erro de conexão, confira usuário/senha/banco do PostgreSQL no `.env`.

Instalação automática com **`./install.sh`** (raiz do repositório): antes de `db:migrate`, o script corre **`scripts/ensure-postgres-app-ownership.sh`** como utilizador `postgres`, alinhando o dono da base, do schema `public` e das tabelas ao **DB_USER** do `backend/.env`, para as migrações Sequelize não falharem por falta de permissão. Instalação só com os passos manuais desta secção: use o bloco SQL abaixo se aparecer o erro de ownership.

**Erro `must be owner of table Queues` (ou outra tabela) nas migrações:** no PostgreSQL, comandos como `ALTER TABLE ... DROP CONSTRAINT` só podem ser executados pelo **dono da tabela** (ou por um superuser). Se o banco foi criado/restaurado com outro utilizador (por exemplo `postgres`) e o `.env` usa `atendechat`, as tabelas podem continuar com dono errado. Corrija **uma vez** como `postgres`, trocando o nome do banco e o utilizador do seu `.env`:

```bash
sudo -u postgres psql -d NOME_DO_BANCO -c 'ALTER TABLE "Queues" OWNER TO "UTILIZADOR_DO_ENV";'
```

Se várias tabelas estiverem com dono incorreto, pode transferir todas no `public` para o utilizador da aplicação (ajuste o nome do role no final do bloco):

```bash
sudo -u postgres psql -d NOME_DO_BANCO <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO "UTILIZADOR_DO_ENV"', r.t);
  END LOOP;
END $$;
SQL
```

Depois volte a `cd backend && npm run build && npx sequelize db:migrate`.

---

## 10. Configurar o frontend (.env) e build

Defina a URL do backend (domínio ou IP da VPS):

```bash
cd $PROJETO/frontend
echo "REACT_APP_BACKEND_URL=https://api.seudominio.com" > .env
echo "REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24" >> .env
```

Se for testar por IP sem HTTPS:

```bash
echo "REACT_APP_BACKEND_URL=http://SEU_IP:8080" > .env
echo "REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24" >> .env
```

Instalar dependências e gerar o build:

```bash
npm install
npm run build
```

A pasta `frontend/build` será usada pelo Nginx.

---

## 11. Rodar o backend em produção

Teste manual primeiro:

```bash
cd $PROJETO/backend
npm run start:prod
```

Deixe rodando e teste no navegador (frontend apontando para esse backend). Para encerrar: `Ctrl+C`.

Para manter o backend sempre ativo, use **systemd** (próximo passo).

---

## 12. Serviço systemd para o backend

Criar o arquivo de serviço:

```bash
sudo nano /etc/systemd/system/atendechat-backend.service
```

Conteúdo (ajuste `SEU_USUARIO` e o caminho `PROJETO`):

```ini
[Unit]
Description=CoreFlow Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=SEU_USUARIO
WorkingDirectory=/var/www/atendechat/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable atendechat-backend
sudo systemctl start atendechat-backend
sudo systemctl status atendechat-backend
```

Logs:

```bash
sudo journalctl -u atendechat-backend -f
```

---

## 13. Nginx: servir frontend e proxy para o backend

O backend **não usa** prefixo `/api`: as rotas ficam na raiz. A forma mais limpa é:

- **Frontend**: `https://seudominio.com` (ou `http://SEU_IP`)
- **Backend**: `https://api.seudominio.com` (ou `http://SEU_IP:8080`)

No `.env` do frontend use: `REACT_APP_BACKEND_URL=https://api.seudominio.com` (ou `http://SEU_IP:8080` se for só IP).

### Opção A – Com domínio (recomendado)

Dois arquivos de site no Nginx.

**Frontend (site principal):**

```bash
sudo nano /etc/nginx/sites-available/atendechat-frontend
```

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;
    root /var/www/atendechat/frontend/build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Backend (subdomínio api):**

```bash
sudo nano /etc/nginx/sites-available/atendechat-backend
```

```nginx
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar os dois e testar:

```bash
sudo ln -s /etc/nginx/sites-available/atendechat-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/atendechat-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

No `.env` do **backend**: `BACKEND_URL=https://api.seudominio.com`, `FRONTEND_URL=https://seudominio.com`.  
No `.env` do **frontend** (antes do build): `REACT_APP_BACKEND_URL=https://api.seudominio.com`.

### Opção B – Só IP (teste)

Frontend na porta 80, backend na 8080. Abra a porta 8080 no firewall.

No `.env` do frontend: `REACT_APP_BACKEND_URL=http://SEU_IP:8080`.  
Um único site Nginx para o frontend:

```bash
sudo nano /etc/nginx/sites-available/atendechat
```

```nginx
server {
    listen 80 default_server;
    server_name _;
    root /var/www/atendechat/frontend/build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/atendechat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Acesse: `http://SEU_IP` (frontend) e a API em `http://SEU_IP:8080`.

---

## 14. Firewall (opcional)

Se usar `ufw`:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Com **Opção A** (domínio), o backend fica só em localhost (8080) e o Nginx expõe 80/443. Com **Opção B** (só IP), libere também a porta 8080: `sudo ufw allow 8080`.

---

## 15. Resumo dos comandos por ordem

1. `sudo apt update && sudo apt upgrade -y`
2. Instalar Node 20, PostgreSQL, Redis, Nginx (passos 2–5).
3. Colocar o projeto em `/var/www/atendechat` (passo 7).
4. `backend`: copiar `.env.example` → `.env`, editar com Postgres e Redis locais (passo 8).
5. `backend`: `npm install` → `npm run build` → `npx sequelize db:migrate` → `npx sequelize db:seed:all` (passo 9).
6. `frontend`: criar `.env` com `REACT_APP_BACKEND_URL` → `npm install` → `npm run build` (passo 10).
7. Criar e ativar o serviço `atendechat-backend.service` (passo 12).
8. Configurar Nginx para servir `frontend/build` e fazer proxy para o backend (passo 13).
9. Abrir no navegador, fazer login (credenciais do seed), conectar WhatsApp pelo QR Code e testar.

---

## 16. Atualizar o projeto depois (git pull)

```bash
cd /var/www/atendechat
git pull

cd backend
npm install
npm run build
npx sequelize db:migrate
sudo systemctl restart atendechat-backend

cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

---

## Troubleshooting

- **Backend não inicia**: veja `sudo journalctl -u atendechat-backend -n 100`. Confira `.env`, conexão Postgres e Redis.
- **Erro de conexão com Postgres**: usuário/senha, `DB_HOST=localhost`, `DB_PORT=5432`, banco criado.
- **Erro de Redis**: `REDIS_URI` correto; se tiver senha: `redis://:SENHA@127.0.0.1:6379`.
- **Frontend não carrega**: Nginx apontando para `frontend/build` e `try_files` com `index.html`.
- **API não responde**: Confira `REACT_APP_BACKEND_URL` (deve ser a URL do backend: `https://api.seudominio.com` ou `http://SEU_IP:8080`). Com domínio, o Nginx deve fazer proxy de `api.seudominio.com` para `127.0.0.1:8080`.
