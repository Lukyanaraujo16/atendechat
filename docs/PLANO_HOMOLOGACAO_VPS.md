# Plano de homologação — VPS Ubuntu 24.04 x86_64 limpa

**Status: PENDENTE.** Nenhuma VPS descartável foi disponibilizada até 2026-11-08; nada deste plano
foi executado em servidor real. Não use as VPS de TESTE ou PRODUÇÃO atuais
(`docs/ambientes/AMBIENTES_ATUAIS.md`).

Objetivo: comprovar, numa VPS nova, que `install.sh` e `docs/MANUAL_INSTALACAO.md` entregam a
plataforma completa com HTTPS e Evolution, e que reinício, segunda execução, backup e restauração
funcionam. Duração estimada: 3–4 horas. Custo: VPS por algumas horas + um subdomínio de teste.

## 0. Pré-requisitos (autorização do proprietário)

| Item | Valor sugerido |
|---|---|
| VPS | Ubuntu Server 24.04 LTS **x86_64**, 2 vCPU, 4 GB RAM, 40 GB SSD, IPv4 público, descartável |
| Domínio | dois nomes de teste, ex.: `app.homolog.SEUDOMINIO` e `api.homolog.SEUDOMINIO` (registros A → IP da VPS, sem proxy/CDN) |
| Celular | um número de WhatsApp de teste (não usar números de clientes) |
| Repositório | commit a homologar (anote o SHA) |
| Segunda VPS (opcional, passo 10) | outra VPS descartável para a restauração |

Registre as evidências em um arquivo `homologacao-AAAAMMDD.md` (saídas de comando, prints). **Não
copie senhas, tokens nem conteúdo de `.env` para as evidências.**

## 1. Preparação do servidor

```bash
ssh root@IP_DA_VPS
uname -m                       # esperado: x86_64
lsb_release -ds                # esperado: Ubuntu 24.04.x LTS
apt-get update && apt-get -y upgrade && [ -f /var/run/reboot-required ] && reboot
dig +short app.homolog.SEUDOMINIO; dig +short api.homolog.SEUDOMINIO   # ambos = IP da VPS
```

## 2. Instalação completa

```bash
apt-get install -y git
git clone URL_DO_REPOSITORIO /var/www/atendechat
cd /var/www/atendechat && git checkout SHA_A_HOMOLOGAR
sudo bash install.sh --verificar        # esperado: nenhum [ERRO]
sudo bash install.sh                    # 1) Instalação nova; modo 1 (domínio); Evolution 1 (local)
```

Critérios: termina com “instalação concluída”; `--diagnostico` interno “Nenhum problema
encontrado”; anotar duração total.

## 3. Nginx, Certbot e HTTPS

```bash
sudo nginx -t
sudo certbot certificates               # 1 certificado cobrindo app. e api.
curl -sI http://app.homolog.SEUDOMINIO | head -3       # 301 → https
curl -s -o /dev/null -w '%{http_code}\n' https://app.homolog.SEUDOMINIO/                                  # 200
curl -s -o /dev/null -w '%{http_code}\n' https://api.homolog.SEUDOMINIO/system-settings/branding-bootstrap.js  # 200
sudo certbot renew --dry-run            # sucesso
systemctl list-timers | grep certbot    # timer ativo
sudo ufw status                         # SSH, 80, 443 (sem 8080)
ss -ltnp | grep -E ':(5432|6379|8085|8080)\b'   # 5432/6379/8085 só em 127.0.0.1
```

De um computador externo: `nc -vz IP_DA_VPS 8080` e `nc -vz IP_DA_VPS 5432` → recusados/timeout.

## 4. Backend com usuário dedicado e JWT

```bash
systemctl show -p User atendechat-backend          # User=atendechat
ps -o user= -p "$(systemctl show -p MainPID --value atendechat-backend)"   # atendechat
sudo cat /etc/sudoers.d/atendechat-backend         # só systemctl restart atendechat-backend
sudo -u atendechat sudo -n systemctl restart atendechat-backend && echo restart_ok
sudo -u atendechat sudo -n systemctl stop atendechat-backend; echo "stop_rc=$? (esperado != 0)"
# JWT inválido impede o início (teste em processo separado, sem alterar o .env):
cd /var/www/atendechat/backend && sudo -u atendechat env JWT_SECRET=mysecret node dist/server.js; echo "rc=$? (esperado 1, log 'Configuração JWT inválida')"
```

## 5. Super Admin e cadastro público

1. Navegador: `https://app.homolog.SEUDOMINIO` → login com o Super Admin informado → painel `/saas`.
2. `admin@admin.com` / `123456` → recusado.
3. API:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -H 'Content-Type: application/json' \
     -d '{"email":"x@y.com","password":"Abcdef12","name":"x"}' https://api.homolog.SEUDOMINIO/auth/signup   # 403
   ```
4. `sudo bash install.sh --superadmin` → “Já existe 1 Super Admin”.
5. Logs sem segredos: procurar a senha do Super Admin e os valores do `.env` em
   `/var/log/streamhub/` e `journalctl` (método: `docs/RELATORIO_ENTREGA_INSTALADOR.md`, varredura) → nada.

## 6. Configuração inicial, Evolution, webhook HTTPS e QR Code

1. Painel: criar plano, empresa (com admin), entrar como admin da empresa.
2. Conexões → Adicionar → Provedor **Evolution** → salvar.
3. Verificar:
   ```bash
   K=$(sudo grep -m1 '^AUTHENTICATION_API_KEY=' /opt/streamhub/evolution/.env | cut -d= -f2)
   curl -s -H @<(printf 'apikey: %s\n' "$K") http://127.0.0.1:8085/webhook/find/streamhub-c1-w1
   # url = https://api.homolog.SEUDOMINIO/webhooks/evolution/<id>, enabled = true, 6 eventos
   journalctl -u atendechat-backend --since -5min | grep -E 'QRCODE_UPDATED|EvolutionWebhook'
   ```
4. **Webhook público HTTPS** (o ponto ainda não comprovado): o QR Code aparece no painel.
5. Ler o QR Code com o celular de teste → status **Conectado**.
6. Enviar mensagem do celular para o número → ticket aparece; responder pelo painel → chega no celular.
7. Enviar uma imagem e um áudio → aparecem no painel (testa a busca de mídia por `getBase64FromMediaMessage`).
8. Repetir 2–6 com uma conexão **Baileys**.

## 7. Persistência e reinício

```bash
sudo reboot
# após voltar:
sudo bash install.sh --diagnostico      # nenhum problema
```

Critérios: painel e API em HTTPS, conexão WhatsApp volta a **Conectado** sem novo QR Code,
mensagens novas chegam, dados (empresa, tickets) preservados, contêineres Evolution `Up`.

## 8. Segunda execução do instalador

```bash
cd /var/www/atendechat
sudo sha256sum backend/.env /opt/streamhub/evolution/.env > /root/antes.sha
sudo bash install.sh --nova             # esperado: bloqueada, nada alterado
sudo bash install.sh --atualizar        # backup + build + migrações + restart + diagnóstico
sudo sha256sum -c /root/antes.sha       # esperado: OK (segredos inalterados)
```

Critérios: login continua válido, conexão WhatsApp continua conectada, nenhuma credencial trocada.
Testar também a atualização pela tela do painel (atualizador do Super Admin) e confirmar que o
backend reinicia (usa o sudo restrito).

## 9. Backup

```bash
sudo bash scripts/streamhub-backup.sh
D=$(ls -d /var/backups/streamhub/2* | tail -1); (cd "$D" && sudo sha256sum -c SHA256SUMS)
```

Copiar o diretório para fora da VPS (ex.: `scp -r root@IP:"$D" .`) e guardar cifrado.

## 10. Restauração

Em uma segunda VPS descartável (ou nesta, após registrar dados de controle):

1. Instalar com `--nova` (mesmo SHA, outro par de nomes DNS ou os mesmos após trocar o DNS).
2. Seguir `docs/MANUAL_INSTALACAO.md`, seção 15 (“Restauração”), passo a passo.
3. Critérios: empresas, usuários, tickets e mídias presentes; login do Super Admin original;
   conexão Evolution restaurada sem novo QR Code (sessão em `evolution-instances.tar`).

## 11. Encerramento

- Preencher a tabela de resultados abaixo e anexar ao `docs/RELATORIO_ENTREGA_INSTALADOR.md`.
- Desconectar o número de teste (WhatsApp → Aparelhos conectados) e **destruir a VPS**.
- Remover os registros DNS de teste.

| Passo | Resultado (OK/FALHA) | Evidência | Observações |
|---|---|---|---|
| 1 Preparação | | | |
| 2 Instalação | | | |
| 3 HTTPS/Nginx/Certbot/firewall | | | |
| 4 Usuário dedicado/JWT | | | |
| 5 Super Admin/cadastro/logs | | | |
| 6 Evolution/webhook HTTPS/QR/mensagens | | | |
| 7 Reinício | | | |
| 8 Segunda execução | | | |
| 9 Backup | | | |
| 10 Restauração | | | |
