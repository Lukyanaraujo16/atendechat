# StreamHub Chat (AtendeChat / CoreFlow)

Plataforma multiempresa de atendimento via WhatsApp (Baileys e Evolution API), Instagram Direct,
CRM, automações e cobrança SaaS. Nome técnico interno **CoreFlow**; o nome exibido aos clientes é
configurável em **Plataforma → Branding**.

## Instalação em uma VPS nova

Ubuntu Server 22.04 ou 24.04 LTS, 2+ vCPU, 4 GB de RAM, domínio com registros `app.` e `api.`:

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone URL_DO_REPOSITORIO_OFICIAL /var/www/atendechat
cd /var/www/atendechat
sudo bash install.sh
```

- Passo a passo (comandos e perguntas do instalador, primeiro acesso, primeiro WhatsApp): [`docs/GUIA_INSTALACAO_INICIANTES.md`](docs/GUIA_INSTALACAO_INICIANTES.md)
- Manual completo: [`docs/MANUAL_INSTALACAO.md`](docs/MANUAL_INSTALACAO.md)
- Manutenção técnica (arquitetura, variáveis, integrações): [`docs/MANUTENCAO_TECNICA.md`](docs/MANUTENCAO_TECNICA.md)
- Atualização: `git pull --ff-only && sudo bash install.sh --atualizar`
- Diagnóstico: `sudo bash install.sh --diagnostico`

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `backend/` | API Node.js 20 / TypeScript (Express, Sequelize/PostgreSQL, Redis/Bull, Socket.IO) |
| `frontend/` | painel React 17 |
| `scripts/` | instalador, backup e publicação do frontend |
| `deploy/` | exemplos de Nginx e coletor de métricas da Evolution |
| `docs/` | documentação |

## Desenvolvimento local

Pré-requisitos: Node.js 20, PostgreSQL e Redis locais.

```bash
cd backend && cp .env.example .env   # preencha DB_*, REDIS_URI e os segredos JWT:
# JWT_SECRET e JWT_REFRESH_SECRET são obrigatórios, distintos e com 32+ caracteres (openssl rand -hex 32);
# sem eles o backend não inicia.
npm ci && npm run build && npx sequelize db:migrate
npm run dev:server

cd ../frontend && npm ci && npm start
```

Primeiro Super Admin local: `cd backend && SUPERADMIN_NAME=Dev SUPERADMIN_EMAIL=dev@local.test SUPERADMIN_PASSWORD='Dev12345' node dist/scripts/bootstrapSuperAdmin.js`.

> `instalador-main/`, `DEPLOY-UBUNTU.md`, `NGINX_SETUP.md`, `SSL_SETUP.md`, `manage-stacks.sh` e
> `docker-compose.yml` da raiz são **legado** e não devem ser usados em instalações novas.

## Licença

Base de código interna. Nome e marca visíveis ao cliente via branding.
