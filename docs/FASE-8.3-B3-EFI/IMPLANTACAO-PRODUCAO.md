# Fase 8.3-B3 — Implantação em PRODUÇÃO (Pix B3)

**Preparado em 2026-10-22, localmente; revisado em 2026-10-24 após a tentativa de B2 e a correção B3-FIX01.**
Cada etapa exige autorização explícita do responsável. Base: `RELATORIO-HOMOLOGACAO.md` (homologações aprovadas em
TESTE, §3.2 e §3.4), DECISOES §14–§15.

> **Versão autorizada para PRODUÇÃO: exclusivamente o commit `e9e0638`**
> (`e9e06382ef6530087911e453721f2f041a7b7b02`, B3-FIX01), implantado e homologado na VPS de TESTE em 2026-10-24
> (RELATORIO-HOMOLOGACAO §3.4). Substitui o `07c6b66`, que **não** deve mais ser ativado em PRODUÇÃO: nele o cadastro do
> webhook, a recepção do `teste` e o `homologate` do slot `production` dependem da própria homologação (§3.3 do relatório).
> PRODUÇÃO executa `e9e0638` mesmo que `origin/main` esteja à frente. Commits posteriores que só alteram documentação
> **não substituem** a versão homologada; qualquer outra versão exige nova homologação em TESTE.

Escopo: só o Pix B3. Boleto e cartão ficam desligados (`EFI_BOLETO_ENABLED=false`, `EFI_CARD_ENABLED=false`);
nenhuma variável da B3 os liga (auditoria de 2026-10-22).

## Histórico da implantação
| Data | Etapa | Resultado |
|------|-------|-----------|
| 2026-10-24 | **Etapa A** com `07c6b66` (código, funcionalidades desligadas) | concluída: `2445edb` → `07c6b66` (checkout `--detach`), migrations `20261020120000` e `20261021120000` aplicadas, `STREAMHUB_RUNTIME_ENV=production` e `EFI_CREDENTIAL_ENCRYPTION_KEY` (gerada na VPS) acrescentados; backend parado 37 s; estado financeiro idêntico. Backups em `/root/backups/etapa-a-20261024-112747` (`.env`, nginx, unit, `pg_dump -Fc` verificado, patch das alterações locais) |
| 2026-10-24 | **B1** (painel, pelo responsável) | slot `production` cadastrado, OAuth Cobranças e Pix (mTLS) aprovado, `Ativar (admin)` — auditorias 1–5, `activate` às 11:51:41 |
| 2026-10-24 | **B2** com `07c6b66` | **interrompido antes da transferência**: cadastro do webhook recusado com `ERR_EFI_INTEGRATION_NOT_HOMOLOGATED` (dependência circular, RELATORIO §3.3). Nenhuma chamada à Efí, nenhuma auditoria nova; webhook manteve-se em TESTE; estado financeiro idêntico. Configuração financeira de PRODUÇÃO restaurada ao estado da Etapa A (`.env` pré-B2) |
| 2026-10-24 | **B3-FIX01** (`e9e0638`) | homologado em TESTE (RELATORIO §3.4) |

## Estado atual (2026-10-24)
| Ambiente | Situação |
|----------|----------|
| PRODUÇÃO (`chi-sm5039mp-h8tnr-4-3`) | commit `07c6b66` (HEAD destacado), build `dirty: false`; **B3 desligada**: controles B3 ausentes do `.env`, fonte `legacy_env`, v2/pipeline/varredura inativos, `invalid: []`. Migrations B3 aplicadas. Alterações locais conhecidas e preservadas: `frontend/yarn.lock`, `install.sh` (modo), `package-lock.json` (nome) |
| Slot `production` | **cadastrado, validado e administrativamente ativo**: `auth_validated`, `adminEnabled=true`, ambiente `production`, chave `****04fd`, Client ID `****b7aa`, P12 `5322e60f74847ace…` (iguais aos de TESTE), validação Pix na auditoria 5. Webhook secret exclusivo (64 hex) — cópia só-root em `/root/backups/etapa-b/efi-webhook-secret-producao.txt`, conferida contra o slot sem exibir o valor. **Não editar o slot:** qualquer alteração zera a ativação e muda o fingerprint |
| Webhook `****04fd` | aponta para TESTE (`api.teste.streamhubchat.com.br`, `whToken` + `ignorar=`) |
| TESTE (`vmi3163669`) | commit `e9e0638`; **Pix V2 e pipeline ATIVOS** com a conta real — **desligar antes da transferência do webhook** (§5.1) |

## 0. Premissas e decisões antes da janela
| # | Item | Situação |
|---|------|----------|
| P-1 | **Concluída:** `e9e0638` implantado e homologado em TESTE (RELATORIO §3.4) | o `homologate` de PRODUÇÃO compara o commit digitado no painel com o do build em execução (`ERR_EFI_HOMOLOGATE_COMMIT_MISMATCH`): PRODUÇÃO precisa rodar `e9e0638` |
| P-2 | **Decidido:** chave Pix de PRODUÇÃO `04fd` (mesma conta Efí), com o webhook transferido de TESTE no §6 | — |
| P-3 | **Conferido (2026-10-24):** `GERENCIANET_PIX_KEY` de PRODUÇÃO termina em `anet` (≠ `04fd`); `GERENCIANET_CLIENT_ID/SECRET` são valores de exemplo | o checkout legado de PRODUÇÃO não usa nem recadastra a `04fd` |
| P-4 | Retenção R-5 aprovada (DECISOES §15.3) e texto D-P11 (§15.4) enviado, se o responsável decidir avisar | não bloqueia o deploy |
| P-5 | Janela de manutenção | entre a ativação (§5.2) e o `homologate` (§6.3) o checkout Pix de PRODUÇÃO responde erro, sem criar cobrança; Pix recebidos ficam em retentativa — fazer §5.2→§6.3 na mesma janela curta |

## 1. Pré-checagens só leitura (PRODUÇÃO)
1. `hostname` = `chi-sm5039mp-h8tnr-4-3`; **não** é a VPS de TESTE (`vmi3163669`).
2. `.env` (só nomes e valores não secretos): `STREAMHUB_RUNTIME_ENV=production`; `EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API`
   **ausente**; controles B3 ausentes; `EFI_BOLETO_ENABLED`/`EFI_CARD_ENABLED` ausentes ou `false`;
   `BILLING_AUTOMATION_NORMALIZED_DATES` ausente; `EFI_CREDENTIAL_ENCRYPTION_KEY` presente (já gerada na Etapa A; **não
   regenerar**: decifra o slot cadastrado).
3. Commit atual `07c6b66`; `git status --porcelain --untracked-files=no` lista **só** as três alterações locais conhecidas
   (estado atual); Node, `redis-cli ping`, `df -h`, `systemctl is-active`.
4. Slot `production` inalterado desde a auditoria 5 (`updatedAt` 2026-10-24 11:51:41, 5 auditorias).
5. Linha de base financeira (contagens e hashes das tabelas financeiras) registrada em arquivo.

## 2. Backup
- `.env` → `/root/backups/…` com `umask 077` **só nesse comando**.
- `pg_dump -Fc` + `pg_restore -l` + `pg_restore -f /dev/null` + `.sha256`.
- Config do nginx (`/etc/nginx/sites-enabled/…`).
- Patch das alterações locais (`git diff --binary`) e o `dist` em execução (`dist-07c6b66`) para rollback rápido.

## 3. Deploy do código `e9e0638` (funcionalidades desligadas)
`07c6b66` → `e9e0638` muda só o backend (`webhookReception.ts`, `efiPixAdminService.ts` e dois testes): **sem migrations,
sem dependências, sem frontend**. O frontend em produção (`07c6b664b9f1`) não precisa de novo build.
1. ⚠️ **Permissões:** os builds rodam com `umask 022` explícito (em TESTE, um `umask 077` herdado deixou o frontend em
   403 por alguns minutos). Nunca encadear backup restrito e build no mesmo shell.
2. **Preparar antes da troca** (reduz indisponibilidade): build do backend num checkout paralelo do mesmo commit
   (o worktree `/var/www/atendechat-next` da Etapa A já tem `node_modules`: `git -C /var/www/atendechat-next checkout
   --detach e9e0638`, depois `npm run build` em `backend/`, que grava `build-info.json` com `dirty: false`). Na janela:
   `systemctl stop` → troca `dist` (`mv dist dist-07c6b66; mv <next>/backend/dist dist`) → checkout → `start`.
   Sem checkout paralelo, seguir IMPLANTACAO-TESTE §5 (build no lugar, com o serviço parado).
3. Código — **nunca** `git pull` nem `git merge origin/main` (levariam ao HEAD mais recente):
   ```
   git fetch origin
   git cat-file -e e9e06382ef6530087911e453721f2f041a7b7b02^{commit}   # o commit existe localmente
   git merge-base --is-ancestor HEAD e9e0638 && echo "avanço sem divergência"   # senão, parar e analisar
   git status --porcelain --untracked-files=no                              # só as 3 alterações locais conhecidas; senão, parar
   git checkout --detach e9e0638                                            # preserva as alterações locais (arquivos não tocados)
   git rev-parse HEAD                                                       # e9e06382ef6530087911e453721f2f041a7b7b02
   ```
4. Migrations: **nenhuma** (as da B3 já foram aplicadas na Etapa A; conferir `db:migrate:status` sem `down`).
5. Conferir permissões: `find backend/dist ! -perm -o=r | head` vazio; `curl` do frontend, `version.json` e da API → 200.
6. Boot: `[efi] controles de ativação` com `runtime: "production"`, `testRuntimeProductionApiAllowed: false`, fonte
   `legacy_env`, tudo inativo, `invalid: []`.
7. **Conferência obrigatória da versão** (parar se qualquer item falhar):
   - `git rev-parse HEAD` → `e9e06382ef6530087911e453721f2f041a7b7b02`;
   - `backend/dist/build-info.json` → `"commit": "e9e06382ef6530087911e453721f2f041a7b7b02"` e `"dirty": false`;
   - boot `[efi] controles de ativação` → `currentCommit: "e9e06382ef6530087911e453721f2f041a7b7b02"`;
   - `frontend/build/version.json` → `"version": "07c6b664b9f1"` (frontend sem mudança entre os dois commits).
8. Linha de base financeira idêntica à do §1.5.

## 4. Configuração do slot `production` (painel Super Admin)
**Já concluída no B1 (2026-10-24) — não repetir nem editar.** Referência do que foi feito:
1. Integração Efí: Client ID/Secret, chave Pix `04fd`, webhook secret **novo** (≥ 32, diferente do de TESTE), P12 de produção.
   O ambiente do slot já nasce `production` (runtime `production`).
2. "Testar OAuth" → Cobranças e Pix (mTLS) ok → "Ativar (admin)".
Se o slot precisar ser alterado por qualquer motivo, repetir "Testar OAuth" e "Ativar (admin)" antes do §5.

## 5. Ativação (TESTE desligado + uma única reinicialização em PRODUÇÃO)
1. **TESTE antes da transferência:** backup do `.env` e remover `EFI_PIX_CHARGE_V2_ENABLED` e `EFI_WEBHOOK_PIPELINE` na VPS
   de TESTE (+ restart), para que nenhum Pix gerado em TESTE na conta real notifique PRODUÇÃO. Conferir no boot de TESTE:
   v2 e pipeline inativos, `invalid: []`. (O legado de TESTE usa valores de exemplo: nunca toca a `04fd`.)
   ⚠️ Com a v2 desligada, o painel de TESTE não consegue recadastrar a `04fd` (`ERR_EFI_WEBHOOK_REGISTER_REQUIRES_V2`).
2. PRODUÇÃO: backup do `.env`; acrescentar `EFI_CREDENTIALS_SOURCE=database`, `EFI_PIX_CHARGE_V2_ENABLED=true`,
   `EFI_WEBHOOK_PIPELINE=async`; restart. Conferir no boot: fonte `database`, v2 e pipeline ativos, `invalid: []`,
   `[gatewayWebhook] worker e recuperação registrados`; Redis ok. Varredura **desligada**.
   A partir daqui e até o §6.3, o checkout Pix responde `ERR_EFI_INTEGRATION_NOT_HOMOLOGATED` (nenhuma cobrança criada) e
   Pix recebidos ficam em `retry_scheduled`, sem baixa, até a homologação (D-P2). O evento `teste` é aceito (B3-FIX01).

## 6. Webhook e homologação (minutos)
1. "Consultar webhook" / "Verificar webhook da chave": anotar a URL atual (esperado: a de TESTE,
   `api.teste.streamhubchat.com.br/subscription/webhook?whToken=***&ignorar=`). Qualquer outro destino → **parar**.
2. "Cadastrar webhook" pelo painel (formato `whToken`), **uma única vez**, o que **transfere** a `04fd` de TESTE para
   PRODUÇÃO (B34-T12 + B3-FIX01 permitem o cadastro antes da homologação). Conferir: auditoria `webhook_register` com
   `conferred: true`; `webhook-check` com `pointsToThisBackend: true` e `whToken` igual ao secret do slot (comparar por hash,
   nunca o valor); chega o evento `teste` / `ignored_not_saas` (`authVia: whToken`, HTTP 200). Se o cadastro falhar ou o
   evento não chegar: **não** recadastrar; parar e levantar o estado real.
3. "Registrar homologação" (slot `production`): referência `RELATORIO-HOMOLOGACAO.md`, **`testReportCommit` = `e9e0638`**
   (ou o SHA completo `e9e06382ef6530087911e453721f2f041a7b7b02`; o mesmo da conferência do §3.7 — `07c6b66` é recusado com
   `ERR_EFI_HOMOLOGATE_COMMIT_MISMATCH`) e o id do evento `teste` do §6.2. A partir daí o checkout Pix volta a funcionar
   com a B3 e os Pix retidos são processados nas próximas tentativas. Não editar o slot depois da homologação.

## 7. Teste funcional autorizado e monitoramento
- Uma cobrança real de baixo valor numa empresa interna, **só com autorização**; conferir baixa, renovação e duplicidade
  (consultas de IMPLANTACAO-TESTE §8).
- Primeiras 24 h: card de status (`pendingOverdue`, `eventsWithoutJob`, fila), eventos `failed_*`/`unlinked`,
  logs `ERROR`, cobranças legadas abertas antes da ativação (devem ser casadas pelo txid quando pagas).
- Depois da transferência, recomendável remover `EFI_CREDENTIALS_SOURCE` de TESTE: com ele, religar a v2 lá voltaria a
  gerar Pix reais cuja notificação iria para PRODUÇÃO (evento sem vínculo).

## 8. Rollback
| Situação | Ação | Efeito |
|----------|------|--------|
| Processamento com problema | `EFI_WEBHOOK_WORKER_PAUSED=true` + restart (preferencial) | recepção segue gravando; nada processado; retomar = remover |
| Desligar a B3 | remover os três controles do §5.2 + restart (ou restaurar o `.env` pré-B2, como em 2026-10-24) | checkout legado (em PRODUÇÃO, sem Pix funcional: credenciais legadas são de exemplo). A URL legada **não se aplica** à `04fd` em PRODUÇÃO (P-3); o webhook B3 fica na chave e as notificações deixam de ser aceitas pela fonte `legacy_env` |
| Webhook de volta para TESTE | **só com nova autorização**: religar v2 e pipeline em TESTE e cadastrar pelo painel de TESTE | TESTE volta a receber a `04fd` |
| Só a v2 | remover `EFI_PIX_CHARGE_V2_ENABLED` | checkout legado; o webhook B3 é preservado enquanto a fonte for `database` (B34-T11) |
| Código | `systemctl stop` → `dist-07c6b66` de volta → `git checkout --detach 07c6b66` → `start` | comportamento anterior (com a dependência circular do §3.3 do relatório); migrations não são revertidas (aditivas) |
| Banco | `pg_restore` só com corrupção comprovada e decisão do responsável | — |
