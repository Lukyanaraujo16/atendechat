# Relatório de entrega — instalador e documentação (fase final)

Data: 2026-11-08. Base: `main` em `9756417e` (= `origin/main`). Alterações **não commitadas**
(commit/push pendentes de decisão do proprietário). Inclui a rodada de hardening (seção 12):
JWT sem fallback, lockfile do backend versionado, usuário de serviço dedicado e revalidação E2E.

## 1. Diagnóstico do instalador antigo

| Problema | Impacto |
|---|---|
| Senha padrão do banco `CoreFlowDB2024!` em instalação nova | banco com senha pública |
| Seeds criavam `admin@admin.com` / `123456` (Super Admin), “Empresa 1” e “Plano 1”; o resumo final imprimia essa credencial | acesso total com credencial conhecida; dados fictícios |
| Seeds não idempotentes (rodados a cada execução) | linhas duplicadas em `Settings` |
| `JWT_SECRET`/`JWT_REFRESH_SECRET` vinham do `.env.example` versionado (ou do fallback `mysecret`) | qualquer pessoa podia forjar sessões |
| `ENV_TOKEN` ausente → `POST /auth/signup` sem autenticação | risco de criação de usuários por anônimos |
| Redis sem senha | — (localhost), mas sem defesa em profundidade |
| Nenhuma distinção entre instalação nova e existente; reescrevia `.env` sem cópia de segurança | risco de sobrescrever configuração |
| `apt-get upgrade` incondicional; `pm2@latest` global sem uso | mudanças não pedidas no sistema |
| Sem Evolution API, sem Super Admin seguro, sem diagnóstico, sem retomada após falha | instalação incompleta e manual |
| Porta 8080 aberta no firewall também no modo domínio | API exposta sem proxy |
| `npm install` no frontend reescreve `frontend/yarn.lock` | o `publish-frontend.sh` passa a recusar publicar (“alterações locais”) — causa das alterações locais citadas no pedido |
| `instalador-main/` cria usuário `deploy` com senha fixa | — (legado) |

## 2. Arquitetura adotada

Mantida a arquitetura já usada em TESTE/PRODUÇÃO (Node 20 + PostgreSQL + Redis nativos, systemd
`atendechat-backend`, Nginx, Certbot, publicação atômica do frontend), por ser a comprovada e a
esperada pelo atualizador interno do painel. A Evolution entra em Docker Compose (formato oficial
de distribuição), versão **fixada em v2.3.7** — a versão contra a qual o cliente HTTP do backend foi
escrito —, com Postgres e Redis próprios, rede isolada e porta só em `127.0.0.1:8085`.
O backend é ligado a ela pelas variáveis `EVOLUTION_CENTRAL_*` e configura sozinho o webhook de cada
instância.

## 3. Funcionalidades implementadas

- `install.sh` reescrito: menu e modos `--nova`, `--atualizar`, `--reconfigurar`, `--diagnostico`,
  `--verificar`, `--superadmin`, `--redefinir-senha`; compatível com `MINIMAL_UPDATE=1`.
- Pré-requisitos: root, Ubuntu 22.04/24.04 (20.04 com aviso), arquitetura, systemd, CPU, RAM, disco,
  portas, acesso à rede, pasta legível pelo Nginx.
- Proteções: `--nova` bloqueada com qualquer sinal de instalação; retomada segura de instalação nova
  interrompida; cópia de `.env` antes de alterar; segredos existentes preservados; trava contra
  execução simultânea; log 600 sem segredos; mensagens de erro com etapa, comando e próximo passo.
- Segredos fortes gerados (banco, Redis, JWT, ENV_TOKEN, webhook Efí, chaves de criptografia,
  Evolution); valores públicos conhecidos são recusados; segredos nunca passam por argv.
- Super Admin: `backend/src/scripts/bootstrapSuperAdmin.ts` (mesmo serviço do painel, idempotente,
  sem empresa, com reset de senha que invalida sessões). Seeds legados não são mais executados.
- Evolution local (Docker) ou externa (validada), com teste de alcance do webhook a partir do contêiner.
- Nginx com cache correto do SPA, proxy WebSocket, limite 4 GB; Certbot com renovação automática;
  ufw com SSH detectado, 80/443 (8080 só no modo IP).
- Swap automático em VPS com pouca memória (build do painel).
- `scripts/streamhub-backup.sh`: backup completo com checksums e retenção.
- Testes automatizados `scripts/installer/tests/test_installer.sh` (109 verificações).
- Documentação: `docs/MANUAL_INSTALACAO.md`, `docs/MANUTENCAO_TECNICA.md`, README novo, avisos de
  obsolescência nos guias antigos.

## 4. Arquivos criados e modificados

Criados:
- `scripts/installer/lib.sh`
- `scripts/installer/evolution.sh`
- `scripts/installer/tests/test_installer.sh`
- `scripts/streamhub-backup.sh`
- `backend/src/scripts/bootstrapSuperAdmin.ts`
- `backend/src/config/jwtSecrets.ts`, `backend/src/config/__tests__/jwtSecrets.spec.ts`, `backend/jest.setupEnv.js`
- `backend/package-lock.json` (passa a ser versionado)
- `docs/MANUAL_INSTALACAO.md`
- `docs/MANUTENCAO_TECNICA.md`
- `docs/RELATORIO_ENTREGA_INSTALADOR.md`
- `docs/PLANO_HOMOLOGACAO_VPS.md`
- `docs/ambientes/AMBIENTES_ATUAIS.md` (IPs e nomes dos ambientes atuais, separados da documentação genérica)

Modificados:
- `install.sh` (reescrito; usuário de serviço, opção 5 de `--reconfigurar`, checagem JWT no `--atualizar`)
- `backend/src/config/auth.ts`, `backend/src/server.ts` (JWT obrigatório no boot, sem fallback)
- `backend/jest.config.js`, `backend/jest.integration.config.js` (segredos JWT de teste aleatórios)
- `backend/.gitignore` (deixa de ignorar `package-lock.json`)
- `backend/src/database/migrations/20231220192536-add-unique-constraint-to-Tickets-table.ts` (corrida corrigida)
- `scripts/publish-frontend.sh` (ignora `frontend/yarn.lock` na checagem de alterações locais)
- `scripts/test-integration-f84.sh` (segredos JWT gerados)
- `backend/.env.example` (removidos `JWT_SECRET`/`JWT_REFRESH_SECRET` versionados; `ENV_TOKEN` documentado)
- `docs/MONITORAMENTO-EVOLUTION.md`, `docs/FASE-8.3-B3-EFI/IMPLANTACAO-TESTE.md`, `site/README.md`,
  `deploy/nginx-frontend-cache.example.conf`, `docs/push-onesignal-web.md` (IPs/domínios reais substituídos)
- `.gitignore` (`.env.bak-*`)
- `README.md` (reescrito)
- `DEPLOY-UBUNTU.md`, `NGINX_SETUP.md`, `SSL_SETUP.md`, `instalador-main/README.md` (aviso de obsolescência)

## 5. Testes executados

| Teste | Comando | Resultado |
|---|---|---|
| Sintaxe | `bash -n` em todos os scripts | ok |
| ShellCheck (stable) | `docker run --rm -e LANG=C.UTF-8 -v "$PWD":/mnt -w /mnt koalaman/shellcheck:stable --severity=warning -x -P SCRIPTDIR:scripts/installer:scripts install.sh scripts/installer/*.sh scripts/installer/tests/test_installer.sh scripts/streamhub-backup.sh scripts/publish-frontend.sh` | 0 avisos (restam 5 notas de estilo intencionais) |
| Testes do instalador (entradas, pré-requisitos, `.env` e dono preservado, segredos, JWT, idempotência, bloqueio de `--nova`, retomada, Evolution, portas SSH, `SERVER_IP` legado, `BACKUP_KEEP`) | `docker run --rm -v "$PWD":/repo -w /repo ubuntu:24.04 bash scripts/installer/tests/test_installer.sh` | 109 ok, 0 falha |
| Testes JWT (Jest) | `npx jest src/config/__tests__/jwtSecrets.spec.ts` | 9 ok |
| Jest: suítes que falham + suítes ligadas a autenticação, atual × HEAD | `npx jest --bail=0 --json` (contêiner `node:20`, `npm ci`) | atual 124 ok / 35 falhas; HEAD 115 ok / 35 falhas; **mesmas 35 falhas** (preexistentes: Inventory, AiAgent pacing/wizard, MCP runtime, Evolution echo, ActionsWebhook); +9 = testes JWT novos |
| `npm ci` do backend reproduzível | `npm ci` em Node 20 → `git status backend/package-lock.json` | lock inalterado; build ok |
| Migrations do zero (banco descartável) | `npx sequelize db:migrate` 3× + retomada após falha parcial | 312 migrations, rc=0 |
| ESLint dos arquivos novos | `npx eslint src/config/jwtSecrets.ts src/config/auth.ts src/config/__tests__/jwtSecrets.spec.ts src/scripts/bootstrapSuperAdmin.ts` | ok (`server.ts`: 10 problemas, idênticos ao HEAD) |
| Revisão independente de código (agente revisor) | — | 10 achados; todos corrigidos e revalidados (abaixo) |
| Mutação (os testes detectam regressões) | validação de IPv4 e `env_set` quebrados de propósito | 4 falhas detectadas |
| TypeScript do backend | `cd backend && npx tsc --noEmit -p .` | ok |
| ESLint do script novo | `npx eslint src/scripts/bootstrapSuperAdmin.ts` | ok |
| Instalação limpa ponta a ponta | contêiner Ubuntu 24.04 com systemd (seção 6) | ok |

A suíte Jest completa não terminou no ambiente local (VM Docker de 4 GB: corte por tempo/memória);
a comparação acima cobre todas as suítes que falharam na parte executada e as ligadas a JWT.

## 6. Instalação limpa (executada)

Ambiente: contêiner descartável Ubuntu 24.04 **arm64** com systemd e Docker interno, criado só para
este teste (sem relação com TESTE/PRODUÇÃO), modo **IP** com Evolution local, execução não
interativa. Resultados:

- Pacotes, Node 20.20.2, PostgreSQL 16, Redis com senha, `.env` 600, 312 migrations, Super Admin,
  painel publicado, systemd, Nginx, Evolution 2.3.7, firewall: **ok**; `--diagnostico`: “Nenhum problema encontrado”.
- Login do Super Admin pela API: 200 (sem empresa); senha errada: 401; `admin@admin.com/123456`: 401;
  `POST /auth/signup` anônimo: 403.
- Portas: só 80 e 8080 (modo IP) públicas; 5432, 6379 e 8085 apenas em loopback.
- Fluxo Evolution: plano → empresa → login do admin da empresa → conexão com provedor Evolution →
  instância `streamhub-c1-w1` criada, webhook configurado com os 6 eventos, **QR Code recebido pelo
  webhook** e gravado (`status=qrcode`). A leitura do QR por um celular não foi feita (ação humana).
- Varredura de 15 segredos em `/var/log/streamhub/` e no journal: **nenhum vazamento**.
- Falhas reais encontradas e corrigidas durante o teste: `yarn.lock` reescrito pelo npm; OOM no
  build do painel com 4 GB (swap agora oferecido abaixo de 6 GB); bloqueio indevido de portas na
  retomada; contagem de Super Admin no diagnóstico; `env_changed_keys` sob `pipefail`; comando de
  restauração do manual.

Limitações do ambiente de teste (não do instalador): o swap do instalador não pôde ser ativado
dentro do contêiner e o Docker interno precisou de `/var/lib/containerd` fora do overlayfs; ambos
foram contornados só no contêiner.

## 7. Idempotência e recuperação (executadas)

- Instalação nova interrompida 4 vezes (falhas reais) e **retomada** com o mesmo comando, preservando
  senha do banco, segredos e Super Admin.
- Segunda execução `--nova` em instalação concluída: **bloqueada**, nenhuma alteração (snapshot idêntico).
- `--atualizar`: backup do banco, build, migrations, publicação, restart, diagnóstico ok; **hashes de
  `backend/.env`, `.env` da Evolution e senha do Redis idênticos; contagens de Users/Companies/Plans/
  Whatsapps/Settings/permissões, migrations, instâncias e volumes da Evolution inalterados**.
- `--superadmin` repetido: não cria outro. `--redefinir-senha`: recusa senha fraca; nova senha 200,
  antiga 401. Login da empresa continua válido após a atualização.
- `--reconfigurar` → domínio com DNS inválido: abortado sem alterar nada. `--reconfigurar` → IP:
  URLs, Nginx (IPv4/IPv6), 8080 reaberta, painel 200, diagnóstico 0.
- `--reconfigurar` → Evolution: contêineres recriados, instância `streamhub-c1-w1` preservada.
- `--reconfigurar` → domínio (versão anterior à revisão): URLs, `META_OAUTH_REDIRECT_URI`, webhook Evolution, Nginx de domínio,
  painel recompilado com a nova API, 8080 removida do firewall; HTTPS corretamente adiado (DNS fictício).
- Backup completo: checksums ok; restauração do dump em banco descartável: ok (2 usuários, 1 empresa,
  312 migrations).

### Achados da revisão de código (corrigidos e revalidados no contêiner)

1. Instalações antigas com domínio gravavam o nome da API como `SERVER_IP` → validação agora só aceita IPv4.
2. `--reconfigurar` podia remover o HTTPS em funcionamento → sem DNS válido nada é alterado; falha do
   Certbot restaura Nginx e `.env` (testado: DNS inválido → hashes de `.env` e Nginx inalterados).
3. Senha do Redis em argv (`grep`) e arquivo temporário legível → `awk` com `ENVIRON` e `mktemp`.
4. Senha do Redis da Evolution em argv (healthcheck e `--requirepass`) → `REDISCLI_AUTH` e configuração
   via stdin (testado: nenhuma senha em `ps`; instância e dados preservados após recriar o contêiner).
5. ufw podia bloquear SSH em porta não padrão → todas as portas do `sshd`, `ssh.socket` e da sessão.
6. Falso “[ERRO]” em toda reconfiguração (`diff` sob `pipefail`) → corrigido.
7. `--diagnostico`/`--verificar` exibiam bloco de falha e o contador podia estourar → códigos de saída corretos.
8. Retomada repetia as perguntas do Super Admin → reaproveita respostas registradas e pula o Super Admin já criado.
9. `BACKUP_KEEP=0` apagaria todos os backups → valor validado.
10. Certbot: `listen [::]:80`, aviso de AAAA, `--expand --cert-name`.

## 8. Integrações que exigem credenciais externas

Efí Pay (cobrança SaaS), Meta/Instagram, OpenAI/Gemini, SMTP,
OneSignal, Sentry, Evolution externa (se escolhida). Nenhuma é necessária para instalar ou atender.

## 9. Limitações e pendências reais

1. **Não homologado em VPS real com domínio e HTTPS emitido** (Certbot real, hairpin NAT do webhook
   via URL pública HTTPS). Fazer em uma VPS descartável antes de entregar a produção.
2. Teste feito em **arm64**; a maioria das VPS é x86_64 (mesmos pacotes; repetir na VPS de homologação).
3. Leitura do QR Code por um celular real não executada.
4. **“FIP” não existe no código** (busca por `fip`/`FIP` em código, configurações e documentação). Não há
   evidência de que seja a Efí Pay (ex-Gerencianet); **pendência a esclarecer com o proprietário**.
5. Interface web não foi aberta em navegador no teste (verificado via API, HTML servido e código do
   `TenantAppShell`).
6. Coletor de métricas da Evolution não é instalado automaticamente (opcional, documentado).

## 10. Instruções para uma instalação nova

```bash
# DNS: app.SEUDOMINIO e api.SEUDOMINIO (tipo A) → IP da VPS
apt-get update && apt-get -y upgrade && apt-get install -y git
git clone URL_DO_REPOSITORIO_OFICIAL /var/www/atendechat
cd /var/www/atendechat
sudo bash install.sh            # escolha 1) Instalação nova
sudo bash install.sh --diagnostico
```

Depois: `docs/MANUAL_INSTALACAO.md`, seções 11, 12 e 19.

## 11. Riscos remanescentes

- Instalações existentes (TESTE/PRODUÇÃO) continuam com o backend como root até alguém executar
  `--reconfigurar` opção 5 (migração com reversão automática; não executada nos ambientes atuais).
- Ao atualizar uma instalação existente cujos `JWT_*` sejam fracos, o `--atualizar` gera segredos novos
  e **todos os usuários precisam entrar de novo**.
- O atualizador interno do painel usa `npm install` (não `npm ci`); com o lock versionado e consistente o
  resultado é o mesmo, mas uma divergência futura de `package.json` alteraria o lock no servidor.
- `frontend/yarn.lock` mantido (usado pelo `frontend/Dockerfile` legado); ignorado na publicação.
- 35 testes Jest já falham no HEAD (não relacionados a esta entrega).
- Seeds legados continuam no repositório (não executados pelo instalador; documentados como não usar).
- Modo IP: sem HTTPS e com a porta 8080 pública — apenas para testes.

## 12. Rodada de hardening (revalidada em contêiner Ubuntu 24.04 com systemd)

| Item | Mudança | Evidência |
|---|---|---|
| JWT | sem fallback; boot recusa ausente/vazio, < 32 caracteres, valor público conhecido ou segredos iguais; chaves antigas válidas (ex.: base64 de 44 caracteres) continuam aceitas sem alteração | `node dist/server.js` com `JWT_SECRET=mysecret` → `[FATAL] Configuração JWT inválida…`, rc=1; vazio → rc=1; mensagem sem o valor |
| JWT no `--atualizar` | detecta segredo inválido antes de alterar o sistema e oferece gerar novos (cópia do `.env` antes) | `.env` com `mysecret` → `--atualizar` gerou novos, backend 200 |
| Lockfile backend | `package-lock.json` versionado; instalador usa `npm ci` | `npm ci` não altera o lock |
| `frontend/yarn.lock` | mantido (uso comprovado no Dockerfile legado); `publish-frontend.sh` o ignora | publicação ok como `atendechat` |
| Usuário de serviço | instalação nova: `User=atendechat` (nologin), repositório e releases do usuário, `.env` 600, sudoers só `systemctl restart atendechat-backend` (validado por `visudo -cf`) | `restart` ok; `stop` e `bash` negados |
| Atualizador do painel | `git status`, `npm install`, `db:migrate`, `publish-frontend.sh`, `sudo -n systemctl restart` executados como `atendechat` | todos rc=0, painel e API 200 |
| Migração root → atendechat | `--reconfigurar` opção 5, com reversão se o backend não responder | simulado (unit root, arquivos root, sem sudoers) → `User=atendechat`, processo `atendechat`, 200 |
| Bootstrap | cadastro público fechado (`ENV_TOKEN`), Super Admin único, reexecução não troca credenciais | Super Admin 200; `admin@admin.com` 401; `/auth/signup` 403; segunda `--nova` bloqueada |
| Idempotência | `--atualizar` repetido | hashes de `.env` (backend e Evolution), senha do Redis, contagens, 312 migrations e volumes iguais; só a release do painel muda |
| Segredos em log | varredura de 15 segredos e da senha do Super Admin em `/var/log/streamhub/` e journal | 0 ocorrências |
| Evolution | plano → empresa → conexão Evolution | webhook com 6 eventos, QR Code recebido (`status=qrcode`) |

Falhas reais encontradas nesta rodada e corrigidas:
1. Migration `20231220192536` disparava remoção e criação da constraint em paralelo (operador vírgula):
   em banco novo falhava com `relation "contactid_companyid_unique" already exists`. Agora sequencial,
   com `DROP CONSTRAINT IF EXISTS` (reexecutável). Bancos existentes não são afetados (já aplicada).
2. `env_set` substituía o `.env` por um arquivo do root (`mv`), e o backend como `atendechat` não lia os
   segredos e não subia. Agora preserva o dono; teste adicionado.
3. O `logger.fatal` do pino se perdia com `process.exit`; o erro JWT agora também sai por `console.error`.
4. `--diagnostico` logo após um restart acusava falso erro; agora aguarda até 30 s.

Homologação em VPS x86_64 real: **pendente** — plano em `docs/PLANO_HOMOLOGACAO_VPS.md`.
