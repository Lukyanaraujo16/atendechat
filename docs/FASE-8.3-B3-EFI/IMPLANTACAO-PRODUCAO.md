# Fase 8.3-B3 — Implantação em PRODUÇÃO (Pix B3)

**Preparado em 2026-10-22, localmente. Nada aqui foi executado em PRODUÇÃO.** Cada etapa exige autorização
explícita do responsável. Base: `RELATORIO-HOMOLOGACAO.md` (homologação aprovada em TESTE), DECISOES §14–§15.

Escopo: só o Pix B3. Boleto e cartão ficam desligados (`EFI_BOLETO_ENABLED=false`, `EFI_CARD_ENABLED=false`);
nenhuma variável da B3 os liga (auditoria de 2026-10-22).

## 0. Premissas e decisões antes da janela
| # | Item | Situação |
|---|------|----------|
| P-1 | Commit desta entrega implantado e conferido em **TESTE** antes (smoke + `webhook-check`, sem nova cobrança) e registrado em `RELATORIO-HOMOLOGACAO.md` | o `homologate` de PRODUÇÃO exige que o commit do relatório seja o mesmo em execução (`ERR_EFI_HOMOLOGATE_COMMIT_MISMATCH`) |
| P-2 | Chave Pix de PRODUÇÃO: **`04fd`** (mesma conta Efí da homologação), com o webhook transferido de TESTE (§4) — ou uma chave nova exclusiva | decisão do responsável; o padrão deste roteiro é a transferência da `04fd` |
| P-3 | `GERENCIANET_PIX_KEY` de PRODUÇÃO conferida (só os 4 últimos caracteres) | se for a `04fd`, cada Pix do checkout **legado** recadastra o webhook dela (até a B3 ser ativada); depois da ativação o legado não recadastra mais (B34-T11) |
| P-4 | Retenção R-5 aprovada (DECISOES §15.3) e texto D-P11 (§15.4) enviado, se o responsável decidir avisar | não bloqueia o deploy |
| P-5 | Janela de manutenção | entre a ativação (§5) e o `homologate` (§6) o checkout Pix de PRODUÇÃO responde erro, sem criar cobrança (minutos) |

## 1. Pré-checagens só leitura (PRODUÇÃO)
1. `hostname` e diretório corretos; **não** é a VPS de TESTE (`vmi3163669`).
2. `.env` (só nomes e valores não secretos): `STREAMHUB_RUNTIME_ENV=production`; `EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API`
   **ausente**; controles B3 ausentes; `EFI_BOLETO_ENABLED`/`EFI_CARD_ENABLED` ausentes ou `false`;
   `BILLING_AUTOMATION_NORMALIZED_DATES` ausente; `EFI_CREDENTIAL_ENCRYPTION_KEY` presente e **diferente** da de TESTE
   (comparar fingerprint, nunca o valor; se ausente, gerar com `openssl rand -base64 48` na própria VPS, sem exibir).
3. Commit atual, `git status` limpo, Node, `redis-cli ping`, `df -h`, `systemctl is-active`.
4. `preflight-teste.sql` (só leitura) → arquivo: migrations da B3 aplicadas ou não; **zero txid repetido**.

## 2. Backup
- `.env` → `/root/backups/…` com `umask 077` **só nesse comando**.
- `pg_dump -Fc` + `pg_restore -l` + `pg_restore -f /dev/null` + `.sha256`.
- Config do nginx (`/etc/nginx/sites-enabled/…`).

## 3. Deploy do código (funcionalidades desligadas)
1. ⚠️ **Permissões:** os builds rodam com `umask 022` explícito (em TESTE, um `umask 077` herdado deixou o frontend em
   403 por alguns minutos). Nunca encadear backup restrito e build no mesmo shell.
2. **Preparar antes da troca** (reduz indisponibilidade), se houver espaço e acesso:
   - frontend: build num checkout paralelo do mesmo commit (ex.: `git worktree add /var/www/atendechat-next <commit>`),
     depois troca da pasta `build` (`mv` atômico) — sem o 404/403 do build no lugar;
   - backend: `npx tsc --outDir dist-next` no checkout paralelo; na janela, `systemctl stop` → troca `dist` → migrations → `start`.
   Sem checkout paralelo, seguir IMPLANTACAO-TESTE §5 (build no lugar, com o serviço parado).
3. `git merge --ff-only`; dependências só se `package*.json` mudou.
4. Migrations da B3 (`20261020120000`, `20261021120000`) se o preflight indicar; nenhuma outra.
5. Conferir permissões: `find frontend/build ! -perm -o=r | head` vazio; `curl` do frontend, `version.json` e de um
   `static/js/main.*.js` → 200.
6. Boot: `[efi] controles de ativação` com `runtime: "production"`, `testRuntimeProductionApiAllowed: false`, fonte
   `legacy_env`, tudo inativo. Checkout legado segue igual.

## 4. Configuração do slot `production` (painel Super Admin)
1. Integração Efí: Client ID/Secret, chave Pix (P-2), webhook secret **novo** (≥ 32, diferente do de TESTE), P12 de produção.
   O ambiente do slot já nasce `production` (runtime `production`).
2. "Testar OAuth" → Cobranças e Pix (mTLS) ok → "Ativar (admin)".
3. **TESTE antes da transferência:** remover `EFI_PIX_CHARGE_V2_ENABLED` e `EFI_WEBHOOK_PIPELINE` na VPS de TESTE (+ restart),
   para que nenhum Pix gerado em TESTE na conta real notifique PRODUÇÃO. (A chave legada de TESTE é um valor de exemplo:
   o legado de TESTE nunca toca a `04fd`.)

## 5. Ativação (uma única reinicialização)
Backup do `.env`; acrescentar `EFI_CREDENTIALS_SOURCE=database`, `EFI_PIX_CHARGE_V2_ENABLED=true`,
`EFI_WEBHOOK_PIPELINE=async`; restart. Conferir no boot: fonte `database`, v2 e pipeline ativos,
`[gatewayWebhook] worker e recuperação registrados`; Redis ok. Varredura **desligada**.
A partir daqui e até o §6, o checkout Pix responde `ERR_EFI_INTEGRATION_NOT_HOMOLOGATED` (nenhuma cobrança criada) e
notificações recebidas ficam em retentativa até a homologação (D-P2).

## 6. Webhook e homologação (minutos)
1. "Verificar webhook da chave": anotar a URL atual (esperado: a de TESTE, se `04fd`). Qualquer outro destino → **parar**.
2. Cadastrar o webhook pelo painel (formato `whToken`), o que **transfere** a `04fd` de TESTE para PRODUÇÃO (B34-T12
   permite o cadastro antes da homologação). Conferir: auditoria `webhook_register` com `conferred: true`;
   `webhook-check` aponta para a API de PRODUÇÃO; chega o evento `teste` / `ignored_not_saas` (`authVia: whToken`).
3. "Registrar homologação" (slot `production`): referência `RELATORIO-HOMOLOGACAO.md`, commit em execução (P-1) e o id do
   evento `teste`. A partir daí o checkout Pix volta a funcionar com a B3.

## 7. Teste funcional autorizado e monitoramento
- Uma cobrança real de baixo valor numa empresa interna, **só com autorização**; conferir baixa, renovação e duplicidade
  (consultas de IMPLANTACAO-TESTE §8).
- Primeiras 24 h: card de status (`pendingOverdue`, `eventsWithoutJob`, fila), eventos `failed_*`/`unlinked`,
  logs `ERROR`, cobranças legadas abertas antes da ativação (devem ser casadas pelo txid quando pagas).

## 8. Rollback
| Situação | Ação | Efeito |
|----------|------|--------|
| Processamento com problema | `EFI_WEBHOOK_WORKER_PAUSED=true` + restart (preferencial) | recepção segue gravando; nada processado; retomar = remover |
| Desligar a B3 | remover os três controles do §5 + restart | checkout e webhook legados; **recadastrar a URL legada** (`/subscription/webhook?token=…`) na chave pelo `/subscription/create/webhook` (Super Admin) — o checkout legado também a recadastra no próximo Pix (B34-T11) |
| Só a v2 | remover `EFI_PIX_CHARGE_V2_ENABLED` | checkout legado; o webhook B3 é preservado enquanto a fonte for `database` (B34-T11) |
| Código | deploy do commit anterior | comportamento anterior; migrations não são revertidas (aditivas) |
| Banco | `pg_restore` só com corrupção comprovada e decisão do responsável | — |
