# Manual de instalação — StreamHub Chat

Destinado ao mantenedor responsável pela instalação e operação da plataforma.
Nomes usados no código: **StreamHub Chat** (comercial), **AtendeChat** (repositório, serviço
`atendechat-backend`) e **CoreFlow** (nome técnico antigo). Todos se referem ao mesmo sistema.

Para instalar seguindo só os comandos e as perguntas do instalador, use o guia operacional
[`docs/GUIA_INSTALACAO_INICIANTES.md`](GUIA_INSTALACAO_INICIANTES.md).

Para entender o código e a operação em profundidade, leia também
[`docs/MANUTENCAO_TECNICA.md`](MANUTENCAO_TECNICA.md).

> **Estado da homologação:** consulte a seção [21. Estado da validação](#21-estado-da-validação)
> antes da primeira instalação em produção.

---

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Requisitos da VPS](#2-requisitos-da-vps)
3. [Preparação inicial do servidor](#3-preparação-inicial-do-servidor)
4. [DNS e domínios](#4-dns-e-domínios)
5. [Git e obtenção do repositório](#5-git-e-obtenção-do-repositório)
6. [Executar o instalador](#6-executar-o-instalador)
7. [Perguntas do instalador](#7-perguntas-do-instalador)
8. [Evolution API](#8-evolution-api)
9. [Integrações externas (Efí Pay, “FIP” pendente, Meta, IA, e-mail, push)](#9-integrações-externas)
10. [Primeiro Super Admin](#10-primeiro-super-admin)
11. [Primeiro acesso pelo navegador](#11-primeiro-acesso-pelo-navegador)
12. [Configuração inicial: empresa, plano, usuários e WhatsApp](#12-configuração-inicial)
13. [Verificação dos serviços](#13-verificação-dos-serviços)
14. [Status, restart e logs](#14-status-restart-e-logs)
15. [Backup e restauração](#15-backup-e-restauração)
16. [Atualização para novas versões](#16-atualização-para-novas-versões)
17. [Certificados HTTPS](#17-certificados-https)
18. [Solução de problemas](#18-solução-de-problemas)
19. [Checklist de instalação concluída](#19-checklist-de-instalação-concluída)
20. [Suporte e manutenção](#20-suporte-e-manutenção)
21. [Estado da validação](#21-estado-da-validação)

---

## 1. Visão geral da arquitetura

```
                 Internet
                    │ 80/443
              ┌─────▼─────┐
              │   Nginx   │  app.DOMINIO → arquivos do painel (frontend/build)
              └─────┬─────┘  api.DOMINIO → proxy para 127.0.0.1:8080 (inclui WebSocket)
                    │
        ┌───────────▼────────────┐          ┌──────────────────────────────┐
        │ atendechat-backend     │  HTTP    │ Evolution API v2.3.7 (Docker)│
        │ Node.js 20 / Express   │─────────►│ 127.0.0.1:8085               │
        │ porta 8080 (systemd)   │◄─────────│ evolution-api                │
        └──┬──────────────┬──────┘ webhooks │ evolution-postgres           │
           │              │      (via API   │ evolution-redis              │
     ┌─────▼────┐   ┌─────▼────┐  pública)  └──────────────────────────────┘
     │PostgreSQL│   │  Redis   │
     │127.0.0.1 │   │127.0.0.1 │
     └──────────┘   └──────────┘
```

| Componente | Como roda | Onde |
|---|---|---|
| Backend (API + WebSocket + filas) | serviço systemd `atendechat-backend` (`node dist/server.js`) | `/var/www/atendechat/backend` |
| Painel (React) | arquivos estáticos servidos pelo Nginx | `/var/www/atendechat/frontend/build` → link para `/var/www/atendechat-frontend-releases/<versão>` |
| Banco | PostgreSQL do Ubuntu (pacote `postgresql`) | só `localhost` |
| Filas/cache | Redis do Ubuntu (`redis-server`), com senha | só `127.0.0.1` |
| WhatsApp (Baileys) | dentro do backend | — |
| WhatsApp (Evolution, opcional) | Docker Compose, versão fixada `evoapicloud/evolution-api:v2.3.7` | `/opt/streamhub/evolution`, porta `127.0.0.1:8085` |
| Proxy e HTTPS | Nginx + Certbot (Let's Encrypt) | `/etc/nginx/sites-available/atendechat-*` |

**Por que esta arquitetura:** é a mesma usada hoje nos ambientes de teste e produção
(Node + PostgreSQL + Redis nativos, Nginx, systemd). A Evolution roda em Docker porque é o
formato oficial de distribuição dela; isolada em rede própria, com banco e Redis próprios,
publicada só no loopback.

**Dois canais de WhatsApp** convivem: **Baileys** (embutido no backend; funciona sem Evolution)
e **Evolution** (servidor separado). A escolha é feita por conexão no painel.

---

## 2. Requisitos da VPS

| Item | Mínimo | Recomendado |
|---|---|---|
| Sistema | Ubuntu Server 22.04 LTS ou 24.04 LTS (64 bits) | Ubuntu 24.04 LTS |
| Arquitetura | x86_64 (amd64) ou arm64 | x86_64 |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB (+ swap, que o instalador oferece criar) | 4 GB ou mais (8 GB com muitas conexões) |
| Disco | 10 GB livres | 40 GB+ SSD (mídias e backups crescem) |
| Rede | IPv4 público fixo; portas 22, 80 e 443 liberadas no painel do provedor | — |
| Acesso | usuário root ou com `sudo` | — |

Ubuntu 20.04 funciona com aviso (sem suporte padrão do fabricante). Debian, CentOS e outras
distribuições não são suportadas pelo instalador.

Use uma **VPS nova e exclusiva**. O instalador recusa a instalação nova se encontrar uma
instalação anterior (veja a seção 6).

---

## 3. Preparação inicial do servidor

Conecte-se por SSH como root (ou com um usuário com `sudo`):

```bash
ssh root@IP_DA_VPS
```

Atualize o sistema e reinicie se o kernel for atualizado (o instalador **não** faz `apt upgrade`):

```bash
apt-get update && apt-get -y upgrade
[ -f /var/run/reboot-required ] && reboot
```

Confirme o fuso horário (o instalador define `America/Sao_Paulo` na instalação nova):

```bash
timedatectl
```

Se o painel do provedor tiver firewall próprio, libere as portas **22, 80 e 443** (TCP).
No modo “somente IP” libere também a **8080**.

---

## 4. DNS e domínios

O modo recomendado usa dois nomes no seu domínio:

| Nome | Uso | Registro DNS |
|---|---|---|
| `app.SEUDOMINIO` | painel (navegador) | tipo **A** → IP da VPS |
| `api.SEUDOMINIO` | API, WebSocket e webhooks | tipo **A** → IP da VPS |

Os nomes podem ser outros (o instalador pergunta), mas precisam ser diferentes entre si.

Crie os registros **antes** de rodar o instalador e confirme:

```bash
dig +short app.SEUDOMINIO
dig +short api.SEUDOMINIO
```

Os dois devem retornar o IP da VPS. Se usar Cloudflare, deixe a nuvem **cinza (DNS only)** até
o certificado ser emitido. Se o DNS ainda não propagou, o instalador permite continuar e
emitir o HTTPS depois com `--reconfigurar`.

---

## 5. Git e obtenção do repositório

O repositório **precisa** ficar em `/var/www/atendechat` (o Nginx, usuário `www-data`, precisa
ler o build do painel; pastas como `/root` bloqueiam esse acesso e o instalador recusa).

```bash
apt-get install -y git
mkdir -p /var/www
cd /var/www
git clone URL_DO_REPOSITORIO_OFICIAL atendechat
cd /var/www/atendechat
git log -1 --oneline
```

Para repositório privado, use um *deploy key* SSH ou um token de acesso somente leitura
(nunca grave o token dentro do repositório).

---

## 6. Executar o instalador

```bash
cd /var/www/atendechat
sudo bash install.sh
```

Sem argumentos, o instalador mostra um menu conforme o estado da VPS. Também é possível ir
direto a uma ação:

| Comando | O que faz | Altera algo? |
|---|---|---|
| `sudo bash install.sh --verificar` | só pré-requisitos (SO, CPU, RAM, disco, portas, rede, pasta) | não |
| `sudo bash install.sh --nova` | instalação completa em VPS limpa | sim |
| `sudo bash install.sh --atualizar` | aplica uma nova versão do código (após `git pull`) | sim |
| `sudo bash install.sh --reconfigurar` | domínio/HTTPS, Evolution, segredos JWT, firewall, usuário do backend | sim |
| `sudo bash install.sh --diagnostico` | verificação completa somente leitura | não |
| `sudo bash install.sh --superadmin` | cria o primeiro Super Admin, se ainda não existir | sim |
| `sudo bash install.sh --redefinir-senha` | nova senha para um Super Admin | sim |
| `sudo bash install.sh --ajuda` | resumo das opções | não |

**Proteções:**

- `--nova` é **bloqueada** se existir `backend/.env`, o serviço `atendechat-backend`,
  `/etc/streamhub/install.conf`, a Evolution em `/opt/streamhub/evolution` ou qualquer banco
  PostgreSQL de usuário. Nada é apagado.
- Se uma instalação nova **falhar no meio**, rode o mesmo comando de novo: o instalador detecta
  o registro `INSTALL_STATUS=em_andamento` e **retoma**, preservando senhas e segredos já gerados.
- Toda execução grava um log em `/var/log/streamhub/install-AAAAMMDD-HHMMSS.log` (permissão 600).
  Senhas e chaves **não** são impressas.
- Antes de alterar um `.env` existente é criada uma cópia `.env.bak-AAAAMMDD-HHMMSS` (600).
- Apenas uma execução por vez (trava em `/run/streamhub-install.lock`).

A duração depende da VPS; o build do painel é a etapa mais longa.

---

## 7. Perguntas do instalador

| Pergunta | O que informar | Observações |
|---|---|---|
| IP público desta VPS | Enter aceita o detectado | usado no modo IP e na validação do DNS |
| Modo de acesso | `1` domínio com HTTPS (produção) ou `2` somente IP (testes) | o modo IP não tem HTTPS e expõe a porta 8080 |
| Domínio principal | ex.: `empresa.com.br` | sem `http://` |
| Endereço do painel / da API | Enter aceita `app.` e `api.` | precisam ser diferentes |
| E-mail para o certificado | e-mail válido | avisos de expiração do Let's Encrypt |
| Validação de DNS | `T` tenta de novo, `C` continua sem HTTPS, `S` sai | com `C`, emita depois via `--reconfigurar` |
| Evolution API | `1` instalar nesta VPS, `2` servidor externo, `3` não agora | veja a seção 8 |
| URL / API key da Evolution externa | só na opção 2 | a key não aparece na tela |
| Super Admin: nome, e-mail, senha | dados do administrador da plataforma | senha: 8+ caracteres, maiúscula, minúscula e número; digitada duas vezes, sem eco |
| Criar swap de 2 GB | aparece com menos de 6 GB de RAM e menos de 2 GB de swap | recomendado aceitar: o build do painel usa ~1,8 GB e falha por falta de memória em VPS de 4 GB sem swap |
| Ativar firewall (ufw) | recomendado aceitar | libera SSH (todas as portas do `sshd`, do `ssh.socket` e a da sessão atual), 80, 443 (e 8080 no modo IP). Confirme que sua porta SSH aparece na pergunta |

**Execução sem perguntas** (automação): defina as respostas por variáveis e `ASSUME_YES=1`.

```bash
sudo ASSUME_YES=1 INSTALL_MODE=domain DOMAIN=app.empresa.com.br API_DOMAIN=api.empresa.com.br \
  SSL_EMAIL=ti@empresa.com.br EVOLUTION_MODE=local \
  SUPERADMIN_NAME="Nome" SUPERADMIN_EMAIL=admin@empresa.com.br SUPERADMIN_PASSWORD='SenhaForte123' \
  bash install.sh --nova
```

Variáveis aceitas: `SERVER_IP`, `INSTALL_MODE` (`domain`|`ip`), `BASE_DOMAIN`, `DOMAIN`,
`API_DOMAIN`, `SSL_EMAIL`, `SKIP_DNS_CHECK=1`, `EVOLUTION_MODE` (`local`|`externa`|`nenhuma`),
`EVOLUTION_EXTERNAL_URL`, `EVOLUTION_EXTERNAL_KEY`, `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`,
`SUPERADMIN_PASSWORD`, `STREAMHUB_RUNTIME_ENV` (padrão `production`), `SERVICE_USER` (padrão
`atendechat`), `RECONF_OPTION` (1–5) e
`RECONF_MODO` (`domain`|`ip`, para a opção 1 de `--reconfigurar`).
Evite passar senhas na linha de comando em servidores compartilhados (ficam no histórico do
shell); prefira o modo interativo.

### O que a instalação nova faz, na ordem

1. Valida DNS (modo domínio).
2. Instala pacotes do Ubuntu: git, curl, nginx, postgresql, redis-server, ufw, certbot (modo
   domínio) e bibliotecas do Chromium usado pelo backend. Cria swap se aceito.
3. Instala Node.js 20 (repositório oficial NodeSource, chave assinada).
4. PostgreSQL: cria o usuário `atendechat` com **senha aleatória** e o banco `atendechat`;
   extensões `uuid-ossp` e `pgcrypto`; define a senha do superusuário `postgres` (usada pela
   restauração de backup do painel, `DB_IMPORT_*`).
5. Redis: define **senha aleatória** (`requirepass`) e mantém escuta só em `127.0.0.1`.
6. Gera `backend/.env` a partir de `backend/.env.example` (permissão 600), com segredos novos:
   `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENV_TOKEN`, `WEBHOOK_SUBSCRIPTION_SECRET`,
   `EFI_CREDENTIAL_ENCRYPTION_KEY`, `META_TOKEN_ENCRYPTION_KEY`,
   `AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, `EVOLUTION_CREDENTIAL_ENCRYPTION_KEY`.
7. Backend: instala dependências, compila (`npm run build`) e roda as migrations
   (`npx sequelize db:migrate`). **Não roda os seeds antigos** (eles criavam
   `admin@admin.com`/`123456`, empresa e plano fictícios).
8. Cria o Super Admin informado (`backend/dist/scripts/bootstrapSuperAdmin.js`).
9. Frontend: grava `frontend/.env` (`REACT_APP_BACKEND_URL`), instala dependências (`npm ci`) e
   publica com `scripts/publish-frontend.sh` (build fora da pasta publicada e troca atômica).
10. Cria o usuário de sistema `atendechat` (sem login), passa a ele o repositório e as releases do
    painel, libera via sudo só `systemctl restart atendechat-backend`, cria o serviço
    `atendechat-backend` rodando com esse usuário, configura o Nginx e emite o certificado HTTPS.
11. Evolution: instala Docker (pacotes do Ubuntu), sobe os contêineres, valida a API key e liga
    o backend a ela.
12. Firewall e verificação final (mesmo conteúdo de `--diagnostico`).

---

## 8. Evolution API

### Opção 1 — Instalar nesta VPS (recomendado)

O instalador cria `/opt/streamhub/evolution/` (pasta 700):

- `docker-compose.yml` — contêineres `evolution-api` (imagem `evoapicloud/evolution-api:v2.3.7`),
  `evolution-postgres` (`postgres:15-alpine`) e `evolution-redis` (`redis:7.2-alpine`), rede
  própria, `restart: unless-stopped`, logs com rotação.
- `.env` (600) — `AUTHENTICATION_API_KEY`, `POSTGRES_PASSWORD` e `REDIS_PASSWORD` **gerados**;
  executar o instalador de novo **não** troca esses valores.
- Volumes Docker persistentes: `streamhub-evolution_evolution_instances` (sessões WhatsApp),
  `streamhub-evolution_evolution_postgres`, `streamhub-evolution_evolution_redis`.

A API fica **só** em `http://127.0.0.1:8085` (não acessível pela internet). A imagem aplica as
migrations do banco dela a cada início.

No `backend/.env` o instalador grava:

| Variável | Valor |
|---|---|
| `EVOLUTION_CENTRAL_BASE_URL` | `http://127.0.0.1:8085` |
| `EVOLUTION_CENTRAL_API_KEY` | a mesma `AUTHENTICATION_API_KEY` da Evolution |
| `EVOLUTION_CREDENTIAL_ENCRYPTION_KEY` | chave gerada (**nunca altere** depois de criar conexões) |
| `EVOLUTION_WEBHOOK_PUBLIC_BASE_URL` | URL pública da API (`https://api.SEUDOMINIO`) |

**Webhooks:** o backend configura sozinho o webhook de cada instância ao criar a conexão
(`POST {API}/webhooks/evolution/<id>`, autenticado pela key da instância), com os eventos
`QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `MESSAGES_DELETE`
e `PRESENCE_UPDATE`. Não é necessário configurar webhook global na Evolution.

A Evolution precisa **alcançar a URL pública da API**. O instalador testa isso de dentro do
contêiner (“Evolution alcança o backend”). Se falhar:

1. confirme que o HTTPS da API está ativo: `curl -I https://api.SEUDOMINIO/system-settings/branding-bootstrap.js`;
2. teste de dentro do contêiner:
   `docker exec evolution-api wget -q -O- https://api.SEUDOMINIO/system-settings/branding-bootstrap.js | head -c 80`;
3. se o provedor não permite que a VPS acesse o próprio IP público (*hairpin NAT*), adicione o
   nome da API ao contêiner apontando para o gateway Docker e libere a porta 443 dessa rede no
   firewall — ou use a opção 2 com uma Evolution em outra VPS.

### Opção 2 — Servidor Evolution externo

Informe a URL (ex.: `https://evo.empresa.com.br`) e a API key global (`AUTHENTICATION_API_KEY`
do servidor). O instalador testa `GET /instance/fetchInstances` com a key antes de gravar.
O servidor externo precisa ser **v2.x compatível com a v2.3.7** e alcançar
`https://api.SEUDOMINIO/webhooks/evolution/*`.

> Não use a Evolution da produção atual nem copie tokens/sessões de TESTE ou PRODUÇÃO.

### Opção 3 — Depois

Rode `sudo bash install.sh --reconfigurar` e escolha `2) Evolution API`.

### Conectar um número (ação humana obrigatória)

1. Painel → **Conexões** → **Adicionar** → em *Provedor* escolha **Evolution** → salve.
2. O QR Code aparece no painel em alguns segundos (chega pelo webhook `QRCODE_UPDATED`).
3. No celular: WhatsApp → **Aparelhos conectados** → **Conectar um aparelho** → leia o QR Code.
4. O status muda para **Conectado** (evento `CONNECTION_UPDATE`).

Nenhum número é conectado sem esse passo. Para **reconectar**, use o botão de novo QR/Reiniciar
na conexão. Se o QR não aparecer: veja a seção 18 (“QR Code não aparece”).

Monitoramento: o Super Admin tem a **Central de Monitoramento WhatsApp** (`/saas/evolution-monitor`).
O coletor de métricas da VPS (`deploy/evolution-metrics-collector/`, documentado em
`docs/MONITORAMENTO-EVOLUTION.md`) é opcional e **não** é instalado automaticamente; sem ele,
`EVOLUTION_METRICS_INGEST_TOKEN` fica vazio e a ingestão responde 503 (esperado).

---

## 9. Integrações externas

Nenhuma integração abaixo é necessária para instalar e usar o atendimento. Todas podem ser
configuradas depois. Detalhes técnicos: `docs/MANUTENCAO_TECNICA.md`, seção 8.

### 9.0 Integração “FIP” — pendência de esclarecimento

O proprietário mencionou uma integração chamada **“FIP”**. Uma busca no código (`backend/src`,
`frontend/src`, `.env.example`, `docs/`, `scripts/`, `deploy/`) **não encontrou nenhuma
referência a “FIP”** — nem variável, rota, serviço, tela ou documento. Não há evidência de que
“FIP” seja a Efí Pay (seção 9.1) nem qualquer outro serviço.

**Pendente:** o proprietário precisa informar o que é a “FIP” (fornecedor, finalidade, onde é
usada). Até lá, considere que **não está implementada** neste repositório e que nenhuma
configuração dela é necessária para instalar a plataforma.

### 9.1 Efí Pay (ex-Gerencianet) — cobrança das empresas

Finalidade: emitir cobranças PIX das faturas SaaS e receber a confirmação por webhook.
Obrigatória **só** se a plataforma for cobrar as empresas pelo sistema.

Credenciais necessárias (da sua conta Efí): Client ID, Client Secret, certificado `.p12` e
chave PIX.

**Forma recomendada — painel do Super Admin** (credenciais cifradas no banco):

1. Painel do Super Admin → tela de **integração Efí** (área financeira da plataforma; componente
   `frontend/src/pages/Platform/EfiIntegrationPanel.js`): preencha Client ID/Secret e envie o
   certificado `.p12` (máx. 2 MB).
2. Use **Testar autenticação** e **Homologar**.
3. No `backend/.env`, ative a fonte banco e reinicie:
   ```bash
   cd /var/www/atendechat/backend
   sudo cp .env .env.bak-$(date +%Y%m%d-%H%M%S)
   echo 'EFI_CREDENTIALS_SOURCE=database' | sudo tee -a .env >/dev/null
   sudo systemctl restart atendechat-backend
   ```
4. Registre o webhook pelo painel (usa `WEBHOOK_SUBSCRIPTION_SECRET`, gerado pelo instalador).

Requisitos já atendidos pelo instalador: `EFI_CREDENTIAL_ENCRYPTION_KEY` (gerada) e
`STREAMHUB_RUNTIME_ENV=production`. **Não troque `EFI_CREDENTIAL_ENCRYPTION_KEY`** depois de
salvar credenciais (elas deixam de ser lidas).

Forma legada (variáveis `GERENCIANET_*` e arquivo `backend/certs/<nome>.p12`) continua
funcionando; veja `docs/MANUTENCAO_TECNICA.md`. As flags `EFI_*` de ativação por fase devem ser
ligadas uma por vez, conforme `docs/SAAS-FINANCE-HOMOLOGATION.md`.

Validar: painel (status da integração) ou `POST /saas/finance/efi/test-auth` autenticado como Super Admin.

### 9.2 Instagram Direct (Meta)

Variáveis em `backend/.env`: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
(escolha um valor aleatório) e `META_OAUTH_REDIRECT_URI` (o instalador grava
`https://api.SEUDOMINIO/instagram/oauth/callback`). No app Meta (developers.facebook.com)
configure o webhook `https://api.SEUDOMINIO/webhooks/meta` com o mesmo verify token.
Reinicie o backend após editar.

### 9.3 Inteligência artificial (OpenAI / Google Gemini)

Chaves cadastradas **pelo painel** (credenciais de provedor de IA), cifradas com
`AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY` (gerada pelo instalador). Nenhuma variável extra.

### 9.4 E-mail (SMTP)

Necessário para “Esqueci minha senha”. Configure pelo painel do Super Admin (Configurações de
e-mail). As variáveis `MAIL_*` do `.env` são só reserva e ficam vazias na instalação nova.

### 9.5 Notificações push (OneSignal)

Configuradas pelo painel do Super Admin (App ID e REST API key). Guia: `docs/push-onesignal-web.md`.

### 9.6 Por empresa

Typebot, n8n, Dialogflow, webhooks e Asaas (legado) são configurados por cada empresa nas
integrações de fila/chatbot. Sentry é opcional (`SENTRY_DSN`).

---

## 10. Primeiro Super Admin

Criado na instalação nova com os dados informados. O mecanismo:

- `backend/src/scripts/bootstrapSuperAdmin.ts` usa o mesmo serviço do painel
  (`CreatePlatformSuperUserService`): mesma validação e política de senha.
- Cria o usuário com `super=true`, `profile=admin`, **sem empresa** (o Super Admin administra a
  plataforma; não pertence a um cliente) e com a permissão de console técnico
  (`agentOS.console.view`), igual aos Super Admins existentes.
- É idempotente: se já existe qualquer Super Admin, não cria outro.
- A senha vem do terminal (sem eco) e não é gravada em arquivo nem em log.

Comandos:

```bash
sudo bash install.sh --superadmin        # cria, se ainda não houver Super Admin
sudo bash install.sh --redefinir-senha   # nova senha (desconecta as sessões dele)
```

Outros Super Admins: pelo painel (Plataforma → Super Admins).

A plataforma nasce **vazia**: sem empresas, planos, usuários comerciais ou conexões.

---

## 11. Primeiro acesso pelo navegador

1. Abra `https://app.SEUDOMINIO` (modo IP: `http://IP_DA_VPS`).
2. Entre com o e-mail e a senha do Super Admin.
3. Recomendado em seguida:
   - Plataforma → **Branding**: nome do sistema, logotipos e cores;
   - Configurações de **e-mail (SMTP)** (seção 9.4);
   - Plataforma → **Backups**: conferir a pasta e o agendamento.

---

## 12. Configuração inicial

Ordem sugerida (tudo pelo painel do Super Admin):

1. **Planos**: crie ao menos um plano (limites de usuários, conexões, filas e recursos).
2. **Empresas**: cadastre a empresa cliente, vinculando o plano e o e-mail/senha do administrador
   dela. A empresa recebe automaticamente as configurações padrão.
3. **Usuários**: o administrador da empresa (ou o Super Admin) cria atendentes e supervisores.
4. **Filas/Departamentos**: crie as filas e vincule usuários.
5. **Conexões WhatsApp**: Conexões → Adicionar → Provedor **Baileys** (QR direto pelo backend)
   ou **Evolution** (seção 8) → leia o QR Code.
6. Teste: envie uma mensagem para o número conectado e confirme o ticket no painel.

Cadastros públicos (“Criar conta”) geram **solicitações pendentes**; nenhuma empresa é criada sem
aprovação do Super Admin.

---

## 13. Verificação dos serviços

```bash
sudo bash install.sh --diagnostico
```

Verifica (sem alterar nada): serviços ativos, resposta do backend, build do painel, Nginx,
permissões do `.env`, segredos JWT/ENV_TOKEN, PostgreSQL e Redis não expostos, Super Admin,
HTTPS do painel e da API, timer de renovação, Evolution (key aceita, contêineres ativos,
publicação só no loopback). Retorna código diferente de zero se algo falhar.

Verificações rápidas manuais:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/system-settings/branding-bootstrap.js
curl -fsS -o /dev/null -w '%{http_code}\n' https://api.SEUDOMINIO/system-settings/branding-bootstrap.js
docker ps --filter name=evolution-
ss -ltnp | grep -E ':(80|443|8080|5432|6379|8085)\b'
```

---

## 14. Status, restart e logs

| Serviço | Status | Reiniciar | Logs |
|---|---|---|---|
| Backend | `systemctl status atendechat-backend` | `sudo systemctl restart atendechat-backend` | `journalctl -u atendechat-backend -f` |
| Nginx | `systemctl status nginx` | `sudo nginx -t && sudo systemctl reload nginx` | `/var/log/nginx/error.log`, `access.log` |
| PostgreSQL | `systemctl status postgresql` | `sudo systemctl restart postgresql` | `journalctl -u postgresql`, `/var/log/postgresql/` |
| Redis | `systemctl status redis-server` | `sudo systemctl restart redis-server` | `/var/log/redis/redis-server.log` |
| Evolution | `docker ps --filter name=evolution-` | `cd /opt/streamhub/evolution && sudo docker compose restart` | `docker logs -f evolution-api` |
| Instalador | — | — | `/var/log/streamhub/install-*.log` |

Últimas 200 linhas do backend: `journalctl -u atendechat-backend -n 200 --no-pager`.

---

## 15. Backup e restauração

### Backup

```bash
sudo bash /var/www/atendechat/scripts/streamhub-backup.sh            # completo
sudo bash /var/www/atendechat/scripts/streamhub-backup.sh --somente-banco
```

Cria `/var/backups/streamhub/AAAAMMDD-HHMMSS/` (700) com o banco (`app-db.dump`), mídias
(`app-public.tar.gz`), configuração e segredos (`config.tar.gz`), banco e sessões da Evolution
e `SHA256SUMS`. Mantém os 7 mais recentes (`BACKUP_KEEP`).

Agendar diariamente às 3h:

```bash
echo '0 3 * * * root bash /var/www/atendechat/scripts/streamhub-backup.sh >>/var/log/streamhub/backup.log 2>&1' | sudo tee /etc/cron.d/streamhub-backup
```

**Copie os backups para fora da VPS** (outro servidor ou armazenamento de objetos). Eles contêm
segredos e dados de clientes: guarde-os cifrados e com acesso restrito.

O painel do Super Admin também possui backup/restauração do banco (pasta `backend/backups/`).

### Restauração (em VPS nova ou após perda de dados)

1. Instale a mesma versão do código com `--nova` (ou tenha uma instalação funcionando).
2. Pare o backend: `sudo systemctl stop atendechat-backend`.
3. Restaure a configuração **somente se** for outra VPS (os segredos precisam ser os do backup
   para ler credenciais cifradas):
   ```bash
   sudo tar -xzf config.tar.gz -P   # sobrescreve backend/.env, frontend/.env, /etc/streamhub e Evolution .env
   ```
   Depois alinhe as senhas do PostgreSQL e do Redis desta VPS aos valores do `.env` restaurado
   (`DB_PASS`, `REDIS_URI`) — ou rode `sudo bash install.sh --atualizar`, que mantém o `.env`.
4. Restaure o banco (substitui o conteúdo atual):
   ```bash
   sudo -u postgres dropdb atendechat
   sudo -u postgres createdb -O atendechat atendechat
   # o arquivo é lido pelo root e entregue via stdin (a pasta de backup é 700, inacessível ao usuário postgres)
   sudo -u postgres pg_restore --no-owner --role=atendechat -d atendechat < app-db.dump
   ```
5. Restaure as mídias e devolva a posse ao usuário do serviço:
   `sudo tar -xzf app-public.tar.gz -C /var/www/atendechat/backend && sudo chown -R atendechat:atendechat /var/www/atendechat/backend/public`
   (instalações antigas que ainda rodam como root dispensam o `chown`).
6. Evolution (se usada):
   ```bash
   cd /opt/streamhub/evolution && sudo docker compose stop evolution-api
   gunzip -c evolution-db.sql.gz | sudo docker exec -i evolution-postgres psql -U evolution evolution
   sudo docker cp - evolution-api:/evolution < evolution-instances.tar   # recria /evolution/instances
   sudo docker compose up -d
   ```
7. `sudo systemctl start atendechat-backend` e `sudo bash install.sh --diagnostico`.

> Os passos 4 e 6 apagam os dados atuais. Execute-os apenas na VPS de destino da restauração,
> nunca em produção sem um backup recente.

---

## 16. Atualização para novas versões

```bash
cd /var/www/atendechat
git status                 # não deve haver alterações locais em arquivos versionados
git pull --ff-only
sudo bash install.sh --atualizar
```

A atualização: oferece backup do banco antes (recomendado), adiciona `ENV_TOKEN` se faltar,
instala dependências, compila, roda migrations, publica o painel (troca atômica), reinicia o
backend, recarrega o Nginx e executa o diagnóstico. **Não** altera domínio, Nginx, certificados,
senhas ou chaves existentes. Se a imagem da Evolution homologada mudou, pergunta antes de
atualizá-la (sessões preservadas nos volumes).

Reverter só o painel: `bash scripts/publish-frontend.sh --rollback`.
Reverter o backend: `git checkout <commit-anterior>` e `sudo bash install.sh --atualizar`
(migrations não são desfeitas automaticamente; restaure o backup do banco se necessário).

Compatibilidade: `sudo MINIMAL_UPDATE=1 bash install.sh` equivale a `--atualizar` sem perguntas.
O painel do Super Admin também tem uma tela de atualização do sistema que executa a mesma
sequência (git pull, build, migrations, restart) com comandos fixos
(`backend/src/services/SystemAdmin/SafeCommandRunner.ts`). Ela roda com o usuário do serviço;
o instalador deixa esse usuário como dono do repositório e da pasta de releases e libera para
ele, via sudo, **apenas** `systemctl restart atendechat-backend`.

**Segredos JWT na atualização:** a partir desta versão o backend **não inicia** se
`JWT_SECRET`/`JWT_REFRESH_SECRET` estiverem ausentes, tiverem menos de 32 caracteres, forem
iguais entre si ou forem valores públicos conhecidos (os antigos `mysecret`/`myanothersecret` e
os do `.env.example` antigo). O `--atualizar` verifica isso **antes** de alterar o sistema e
oferece gerar novos valores (os usuários precisam entrar de novo). Chaves próprias já válidas
são mantidas sem alteração. Se for atualizar pelo painel, confira antes:
`sudo bash install.sh --diagnostico` (item “Segredos JWT válidos”).

---

## 17. Certificados HTTPS

- Emitidos pelo Certbot (Let's Encrypt) para os dois nomes, com redirecionamento HTTP→HTTPS.
- Renovação automática pelo `certbot.timer` (pacote do Ubuntu). Verificar:
  ```bash
  systemctl list-timers | grep certbot
  sudo certbot certificates
  sudo certbot renew --dry-run
  ```
- Emitir depois (DNS atrasado) ou trocar de domínio: `sudo bash install.sh --reconfigurar` → `1`.
- Manual: `sudo certbot --nginx -d app.SEUDOMINIO -d api.SEUDOMINIO`.

Na reconfiguração de domínio, nada é alterado se o DNS ainda não apontar para a VPS; se o
Certbot falhar, a configuração anterior do Nginx (com o HTTPS atual) e do `.env` é restaurada.
Certificados antigos que cobriam só parte dos nomes são ampliados (`--expand`).

Ao trocar de domínio, o instalador atualiza `BACKEND_URL`, `FRONTEND_URL`,
`EVOLUTION_WEBHOOK_PUBLIC_BASE_URL` e `META_OAUTH_REDIRECT_URI`, recompila o painel e reinicia o
backend. Conexões Evolution já criadas guardam o webhook antigo: reconecte-as.

---

## 18. Solução de problemas

| Sintoma | Causa provável | Como resolver |
|---|---|---|
| Instalador: “instalação nova foi bloqueada” | já há instalação/banco na VPS | use `--atualizar`/`--reconfigurar` ou uma VPS limpa |
| Instalador: “Nginx não consegue acessar” | repositório fora de `/var/www` | clone em `/var/www/atendechat` |
| Falha no build do frontend (“JavaScript heap out of memory”, processo morto) | pouca RAM | aceite o swap (ou `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`) e rode de novo |
| Falha em qualquer etapa | rede, disco, DNS | leia o erro e o log; rode o mesmo comando de novo (retoma) |
| Certbot falhou | DNS não aponta para a VPS, porta 80 fechada no provedor, proxy/CDN ativo | corrija e `--reconfigurar` → 1 |
| Painel abre, login dá erro de rede | `REACT_APP_BACKEND_URL` errado ou API sem HTTPS | `--diagnostico`; `--reconfigurar` → 1 recompila o painel |
| Erro de CORS no navegador | `FRONTEND_URL` diferente da URL aberta | ajuste via `--reconfigurar` → 1 (ou `CORS_EXTRA_ORIGINS`) |
| Backend reiniciando em loop | `.env` inválido, PostgreSQL/Redis parados | `journalctl -u atendechat-backend -n 200 --no-pager` |
| Log: “Configuração JWT inválida: …” | `JWT_SECRET`/`JWT_REFRESH_SECRET` ausentes, curtos, iguais ou públicos | `sudo bash install.sh --reconfigurar` → 3 (gera novos; usuários entram de novo) |
| Atualização pelo painel falha ao reiniciar / “permission denied” em `git pull` ou `npm` | arquivos do repositório com dono diferente do usuário do serviço | `sudo bash install.sh --atualizar` (devolve a posse) |
| Backend roda como root (aviso do diagnóstico) | instalação anterior a esta versão | `sudo bash install.sh --reconfigurar` → 5 (migra para `atendechat`; volta para root sozinho se o backend não subir) |
| “must be owner of table” nas migrations | tabelas criadas por outro usuário | o instalador corrige (`scripts/ensure-postgres-app-ownership.sh`); rode `--atualizar` |
| Criar conexão Evolution: `ERR_EVOLUTION_CENTRAL_CONFIG_MISSING` | Evolution não configurada | `--reconfigurar` → 2 |
| QR Code Evolution não aparece | webhook não chega ao backend | seção 8 (“Webhooks”); `docker logs evolution-api --tail 200`; `journalctl -u atendechat-backend | grep -i evolution` |
| Evolution fora do ar | contêiner parado | `cd /opt/streamhub/evolution && sudo docker compose up -d` |
| “Esqueci minha senha” não envia e-mail | SMTP não configurado | seção 9.4 |
| Super Admin perdeu a senha | — | `sudo bash install.sh --redefinir-senha` |
| Uploads grandes falham (413) | limite do Nginx | já é 4 GB em `/etc/nginx/conf.d/atendechat-limits.conf` |

---

## 19. Checklist de instalação concluída

- [ ] `sudo bash install.sh --diagnostico` termina com “Nenhum problema encontrado.”
- [ ] Painel abre em `https://app.SEUDOMINIO` com cadeado válido.
- [ ] Login do Super Admin funciona.
- [ ] Branding e SMTP configurados; “Esqueci minha senha” testado.
- [ ] Plano e empresa de teste criados; usuário da empresa entra no painel.
- [ ] Conexão WhatsApp (Baileys e/ou Evolution) conectada por QR Code; mensagem recebida e respondida.
- [ ] `sudo ufw status` mostra só SSH, 80 e 443 (modo domínio).
- [ ] `ss -ltnp` não mostra 5432, 6379 nem 8085 em `0.0.0.0`.
- [ ] Backup executado e copiado para fora da VPS; agendamento diário criado.
- [ ] `sudo certbot renew --dry-run` sem erros.
- [ ] Cópia segura de `backend/.env` e `/opt/streamhub/evolution/.env` guardada fora da VPS.

---

## 20. Suporte e manutenção

Rotina sugerida:

- **Diária:** backup automático; olhar a Central de Monitoramento WhatsApp.
- **Semanal:** `sudo bash install.sh --diagnostico`; `df -h`; conferir cópia externa dos backups.
- **Mensal:** `sudo apt-get update && sudo apt-get -y upgrade` (fora do horário de pico; depois
  `--diagnostico`); revisar usuários Super Admin.
- **A cada versão:** seção 16.

Ao pedir ajuda, envie: saída de `--diagnostico`, o log do instalador
(`/var/log/streamhub/`) e `journalctl -u atendechat-backend -n 300 --no-pager`.
**Antes de enviar, confira que não há senhas ou chaves** (o instalador não as imprime, mas logs
de terceiros podem conter).

---

## 21. Estado da validação

Veja o relatório de entrega (`docs/RELATORIO_ENTREGA_INSTALADOR.md`) para o que foi testado,
como, e o que ainda depende de homologação em uma VPS real com domínio.
