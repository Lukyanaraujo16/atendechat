# Manutenção técnica — StreamHub Chat

Referência para quem mantém o código e a operação. Instalação passo a passo:
[`docs/MANUAL_INSTALACAO.md`](MANUAL_INSTALACAO.md).

## 1. Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| `install.sh` | instalador guiado (nova instalação, atualização, reconfiguração, diagnóstico, Super Admin) |
| `scripts/installer/lib.sh` | funções do instalador (validação, `.env`, segredos, perguntas) |
| `scripts/installer/evolution.sh` | geração do Docker Compose da Evolution e checagens |
| `scripts/installer/tests/test_installer.sh` | testes automatizados do instalador |
| `scripts/streamhub-backup.sh` | backup completo (banco, mídias, configuração, Evolution) |
| `scripts/publish-frontend.sh` | build do painel fora da pasta publicada + troca atômica + rollback |
| `scripts/ensure-postgres-app-ownership.sh` | alinha o dono das tabelas ao usuário da aplicação antes das migrations |
| `backend/` | API Node.js/TypeScript (Express, Sequelize, Socket.IO, Bull) |
| `frontend/` | painel React 17 (Create React App 3, Material UI) |
| `deploy/` | exemplos de Nginx e o coletor de métricas da Evolution |
| `docs/` | documentação; roteiros de fases antigas (histórico) |
| `site/` | landing page comercial (independente da plataforma) |
| `instalador-main/`, `manage-stacks.sh`, `scripts/{main,stacks,nginx,instances,utils,install-nginx}.sh`, `docker-compose.yml` | **legado** (instalador antigo com usuário/senha fixos e stacks Docker). Não usar em instalações novas |
| `update-server-ip.sh` | legado; use `install.sh --reconfigurar` |

## 2. Backend

- Entrada: `backend/src/server.ts` (HTTP em `PORT`, todas as interfaces; em produção o acesso
  externo passa pelo Nginx) e `backend/src/app.ts` (middlewares, CORS por `FRONTEND_URL`,
  rotas de webhook antes do parser JSON padrão).
- Camadas: `routes/` → `controllers/` → `services/` → `models/` (sequelize-typescript).
  Módulos novos ficam em `backend/src/modules/` (ex.: `modules/whatsapp/providers/evolution`).
- `.env` lido por `backend/src/bootstrap.ts` (dotenv, `NODE_ENV=test` usa `.env.test`).
- Ao iniciar: sobe sessões WhatsApp de todas as empresas, filas Bull e agendadores
  (`backend/src/jobs/`: backup automático, cobrança, limpeza de notificações, métricas Evolution,
  armazenamento, CRM, renovação de tokens Instagram, entre outros).
- Build: `npm run build` (limpa `dist/`, `tsc`, grava `dist/build-info.json` com o commit).
- Scripts operacionais (rodar de `backend/` após o build):
  - `node dist/scripts/bootstrapSuperAdmin.js [--status|--reset-password]` — Super Admin;
  - `node dist/scripts/printBackupDiskSpace.js` — espaço para backups;
  - `node dist/scripts/storageCleanupDryRun.js <companyId>` — simulação de limpeza por cota.
- Testes: `npm test` (Jest; usa `.env.test` e um banco de teste dedicado — nunca aponte para
  produção). Testes de integração: `jest.integration.config.js`.

## 3. Frontend

- React 17 + CRA 3 (`react-scripts 3.4.3`, exige `NODE_OPTIONS=--openssl-legacy-provider`, já no
  script `build`). Node 20.
- A URL da API é fixada **no build**: `REACT_APP_BACKEND_URL` em `frontend/.env` (gravado pelo
  instalador). Mudou o domínio da API? É preciso recompilar (`--reconfigurar` faz isso).
- Publicação: `scripts/publish-frontend.sh` compila em staging, valida `index.html` e
  `version.json` (= commit), move para `../atendechat-frontend-releases/<data>-<commit>` e troca o
  link `frontend/build` atomicamente. Guarda 5 versões. `--status` e `--rollback` disponíveis.
  Exige `frontend/` sem alterações locais em arquivos versionados.
- Dependências: `frontend/package-lock.json` versionado → o instalador usa `npm ci`.
  `frontend/yarn.lock` só é usado pelo `frontend/Dockerfile` (fluxo Docker legado). O npm o reescreve a
  cada instalação; por isso o instalador o preserva e o `publish-frontend.sh` ignora alterações nele.

## 4. Banco de dados e migrations

- PostgreSQL local, banco e usuário `atendechat` (senha em `backend/.env`, `DB_PASS`).
- `backend/.sequelizerc` aponta para `dist/` (é preciso compilar antes de migrar).
- Migrations: `backend/src/database/migrations/` (~310). Aplicar: `cd backend && npx sequelize db:migrate`.
  O instalador roda `scripts/ensure-postgres-app-ownership.sh` antes, para evitar
  “must be owner of table”.
- Seeds (`backend/src/database/seeds/`): **legado, não usar em produção**. Criam
  `admin@admin.com`/`123456`, “Empresa 1”, “Plano 1” e configurações da empresa 1, e não são
  idempotentes (duplicam linhas). O instalador não os executa; o Super Admin vem do script de bootstrap.
- `DB_IMPORT_USER`/`DB_IMPORT_PASS`: superusuário `postgres`, usado pela restauração de backup
  do painel (extensões como `uuid-ossp` exigem superusuário).

## 5. Redis e filas

- Redis local com senha (`REDIS_URI=redis://:SENHA@127.0.0.1:6379`).
- Filas Bull (`backend/src/queues.ts`): `UserMonitor`, `QueueMonitor`, `MessageQueue`,
  `ScheduleMonitor`, `SendScheduledMessages`, `CampaignQueue`, além de filas de base de
  conhecimento, webhooks de gateway e AgentOS (`backend/src/libs/`).
- Limite de envio: `REDIS_OPT_LIMITER_MAX` / `REDIS_OPT_LIMITER_DURATION`.

## 6. Serviços de execução

| Unidade | Arquivo | Observação |
|---|---|---|
| `atendechat-backend` | `/etc/systemd/system/atendechat-backend.service` | instalação nova: `User=atendechat` (usuário de sistema sem login, dono do repositório e de `../atendechat-frontend-releases`); sudo restrito em `/etc/sudoers.d/atendechat-backend` (só `systemctl restart atendechat-backend`, usado pelo atualizador do painel). Instalações antigas continuam com `User=root` até `--reconfigurar` → 5, que reverte sozinho se o backend não subir. Nada no backend exige root: backup/restauração usam PostgreSQL por TCP com senha; o Chromium do Puppeteer já roda com `--no-sandbox` |
| `nginx` | `/etc/nginx/sites-available/atendechat-frontend`, `atendechat-backend` (modo domínio) ou `atendechat` (modo IP); `/etc/nginx/conf.d/atendechat-limits.conf` | o Certbot acrescenta os blocos 443 |
| `postgresql`, `redis-server` | pacotes do Ubuntu | só localhost |
| Evolution | `/opt/streamhub/evolution/docker-compose.yml` (projeto `streamhub-evolution`) | `restart: unless-stopped`, Docker inicia com o sistema |
| `certbot.timer` | pacote do Ubuntu | renovação automática |

Registro do instalador (sem segredos): `/etc/streamhub/install.conf` (modo, domínios, status).

## 7. Configuração de ambiente (`backend/.env`)

Permissão 600. Modelo comentado: `backend/.env.example`. Principais grupos:

| Grupo | Variáveis | Quem define |
|---|---|---|
| URLs | `BACKEND_URL`, `FRONTEND_URL`, `CORS_EXTRA_ORIGINS`, `PORT`, `PROXY_PORT` | instalador |
| Banco | `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_IMPORT_*` | instalador |
| Redis | `REDIS_URI`, `REDIS_OPT_LIMITER_*` | instalador |
| Sessão | `JWT_SECRET`, `JWT_REFRESH_SECRET` | instalador (gera) |
| Proteção | `ENV_TOKEN` (fecha `POST /auth/signup`), `WEBHOOK_SUBSCRIPTION_SECRET` (webhook Efí) | instalador (gera) |
| Criptografia de credenciais | `EVOLUTION_CREDENTIAL_ENCRYPTION_KEY`, `EFI_CREDENTIAL_ENCRYPTION_KEY`, `META_TOKEN_ENCRYPTION_KEY`, `AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY` | instalador (gera) |
| Ambiente | `STREAMHUB_RUNTIME_ENV` (`production`/`test`) — isola credenciais Efí de homologação | instalador (`production`) |
| Evolution | `EVOLUTION_CENTRAL_BASE_URL`, `EVOLUTION_CENTRAL_API_KEY`, `EVOLUTION_WEBHOOK_PUBLIC_BASE_URL`, `EVOLUTION_METRICS_INGEST_TOKEN` | instalador (exceto o token de métricas) |
| Efí | `GERENCIANET_*`, `EFI_*` | manual/painel |
| Meta | `META_*` | manual |
| E-mail | `MAIL_*` (reserva; preferir o painel) | manual |
| Outros | `SENTRY_DSN`, `TRUST_PROXY_HOPS`, `KNOWLEDGE_VECTOR_STORE`, `STORAGE_AUTO_CLEANUP_*`, `AGENTOS_*` | opcional |

**Nunca altere** chaves de criptografia depois de haver dados cifrados: as credenciais salvas
deixam de ser lidas. `META_TOKEN_ENCRYPTION_KEY` e `AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY` têm
*fallback* em `META_APP_SECRET`; em instalações antigas sem essas variáveis, **não** as crie sem
migrar os dados (por isso a atualização não as gera).

`JWT_SECRET`/`JWT_REFRESH_SECRET` não têm fallback (`backend/src/config/jwtSecrets.ts`): o backend
**não inicia** se estiverem ausentes, com menos de 32 caracteres, iguais entre si ou forem valores
públicos conhecidos (antigos `mysecret`/`myanothersecret` e os do `.env.example` antigo). Valores
próprios existentes são usados exatamente como estão (tokens emitidos continuam válidos). Trocar:
`--reconfigurar` → 3. Testes: `backend/src/config/__tests__/jwtSecrets.spec.ts`; o Jest gera
segredos aleatórios por execução (`backend/jest.setupEnv.js`).

Frontend: `frontend/.env` com `REACT_APP_BACKEND_URL` e `REACT_APP_BACKEND_PORT` (lidos no build).

## 8. WhatsApp e Evolution

- Campo `Whatsapp.connectionProvider`: `baileys` (padrão) ou `evolution`
  (`backend/src/modules/whatsapp/connectionProvider.ts`).
- **Baileys** (`@whiskeysockets/baileys 7.0.0-rc.9`): sessão dentro do backend.
- **Evolution v2.3.7**: cliente HTTP em
  `backend/src/modules/whatsapp/providers/evolution/inbound/evolutionHttpClient.ts` (header `apikey`).
  Ao criar a conexão, `provisionCentralEvolutionCredentials` copia URL e key centrais para a tabela
  `WhatsappEvolutionCredentials` (key cifrada) e a instância recebe o nome
  `streamhub-c<empresa>-w<conexão>`. **Trocar as variáveis centrais não altera conexões já
  criadas** — recrie-as.
- Webhook: `POST /webhooks/evolution/:whatsappId` (limite 1 MB), autenticado pela key da
  instância; configurado automaticamente por instância com `EVOLUTION_WEBHOOK_PUBLIC_BASE_URL`
  (ou `BACKEND_URL`).
- Mídia: download direto só de URLs públicas da própria Evolution (proteção SSRF); com a Evolution
  local (`127.0.0.1`) o backend usa `POST /chat/getBase64FromMediaMessage` — comportamento esperado.
- Monitoramento: `GET /system/evolution-monitor` (Super Admin); coletor opcional em
  `deploy/evolution-metrics-collector/` (`docs/MONITORAMENTO-EVOLUTION.md`).
- Atualizar a Evolution: altere `EVOLUTION_IMAGE` em `scripts/installer/evolution.sh` **somente após
  homologar a nova versão** contra o cliente HTTP; depois `install.sh --atualizar` pergunta se deve aplicar.

## 9. Integrações externas

| Integração | Finalidade | Configuração | Obrigatória | Validar |
|---|---|---|---|---|
| Efí Pay (ex-Gerencianet) | cobrança SaaS (PIX; boleto/cartão por flag) | painel Super Admin (`EFI_CREDENTIALS_SOURCE=database`) ou `GERENCIANET_*` + `backend/certs/<nome>.p12`; webhook `POST /subscription/webhook?token=...` | só para cobrar empresas | `POST /saas/finance/efi/test-auth`, status no painel |
| “FIP” | **não encontrada no código** — pendência de esclarecimento com o proprietário | — | — | — |
| Evolution API | WhatsApp via servidor Evolution | instalador | não (Baileys funciona) | `--diagnostico` |
| Meta / Instagram | Direct, comentários, OAuth | `META_*`; webhook `/webhooks/meta` | não | conectar conta no painel |
| OpenAI / Gemini | agente de IA, transcrição, base de conhecimento | painel (credenciais cifradas) | não | teste no painel |
| SMTP | recuperação de senha, e-mails | painel (prioridade) ou `MAIL_*` | recomendada | “Esqueci minha senha” |
| OneSignal | push web | painel (`SystemSettings`) | não | `docs/push-onesignal-web.md` |
| Typebot, n8n, Dialogflow, webhooks | automação por fila | por empresa | não | — |
| Asaas | cobrança no chatbot (legado) | Setting `asaas` por empresa | não | — |
| Sentry | erros | `SENTRY_DSN` | não | — |

Não há dependências npm privadas. Nenhum serviço externo é necessário para a plataforma subir.

## 10. Deploy e atualização

Fluxo padrão: `git pull --ff-only` + `sudo bash install.sh --atualizar` (manual, seção 16).
Use sempre o instalador: ele faz backup do banco, valida JWT, instala dependências, compila,
alinha a posse do PostgreSQL, migra, publica o painel, devolve a posse dos arquivos ao usuário do
serviço e reinicia.

Dependências reproduzíveis: `backend/package-lock.json` e `frontend/package-lock.json` são
versionados (lockfile v3, consistentes com os `package.json`). Com o lockfile versionado o
instalador usa `npm ci` (versões exatas; falha se o lock divergir do `package.json`). Para mudar
uma dependência: altere-a localmente com `npm install <pacote>@<versão>`, rode build e testes e
versione `package.json` e `package-lock.json` juntos. O atualizador do painel usa `npm install`,
que respeita o lockfile existente.

## 11. Backups e recuperação

- `scripts/streamhub-backup.sh` (manual, seção 15) — completo, com retenção.
- Painel Super Admin → backups do banco (`backend/backups/`, agendamento interno).
- Segredos essenciais para recuperar dados cifrados: `backend/.env` (todas as chaves de
  criptografia) e `/opt/streamhub/evolution/.env`. Sem eles, credenciais salvas são perdidas.

## 12. Logs e monitoramento

- Backend: `journalctl -u atendechat-backend` (pino). Debug de SQL: `DB_DEBUG=true` (temporário).
- Nginx: `/var/log/nginx/`. Evolution: `docker logs evolution-api` (rotação 20 MB × 5).
- Instalador: `/var/log/streamhub/install-*.log`. Backup agendado: `/var/log/streamhub/backup.log`.
- Painel: Central de Monitoramento WhatsApp (`/saas/evolution-monitor`).

## 13. Permissões e administração

- Super Admin (`Users.super = true`) administra a plataforma; pode não ter empresa.
- Perfis de empresa: `admin`, `supervisor`, `user`.
- Permissões de plataforma extras em `PlatformUserPermissions` (ex.: `agentOS.console.view`).
- Cadastro público cria `CompanySignupRequests` pendentes; aprovação pelo Super Admin.
- `POST /auth/signup` exige o header de `ENV_TOKEN` (gerado pelo instalador).
- Arquivos sensíveis: `backend/.env` (600), `/opt/streamhub/evolution/` (700), `/etc/streamhub/` (700),
  `/var/backups/streamhub/` (700), `/var/log/streamhub/` (700).

## 14. Documentação antiga

| Arquivo | Situação |
|---|---|
| `README.md` | atualizado: aponta para este guia e para o manual |
| `DEPLOY-UBUNTU.md`, `NGINX_SETUP.md`, `SSL_SETUP.md` | **obsoletos** (instalação manual / stacks Docker). Mantidos como histórico |
| `instalador-main/` | **obsoleto** (cria usuário `deploy` com senha fixa). Não usar |
| `docs/MONITORAMENTO-EVOLUTION.md` | válido para o coletor de métricas (genérico) |
| `docs/ambientes/AMBIENTES_ATUAIS.md` | **específico dos ambientes atuais** (IPs, hostnames, topologia de TESTE/PRODUÇÃO); não usar para instalações novas |
| `docs/FASE-*`, `docs/ATENDECHAT-ROADMAP-*`, `docs/ai-agent-*`, `docs/agentos` | histórico de desenvolvimento por fase |
