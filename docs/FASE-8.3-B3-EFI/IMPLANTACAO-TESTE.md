# Fase 8.3-B3 — Pacote de implantação e homologação na VPS de TESTE

**Preparado em 2026-10-21, localmente. Nada aqui foi executado na VPS.** Este documento complementa `HOMOLOGACAO.md`
(cenários H-*) e `ROADMAP.md` (B3.4). PRODUÇÃO não é tocada em nenhum passo.

Abreviações: **R** = ação do responsável (você); **O** = operador com acesso à VPS de TESTE; **A** = pode ser feita pelo agente
quando autorizada (sem acesso a VPS).

---

## 0. Como o deploy fica seguro por construção

- O código desta entrega tem **todas as liberações vazias** (`EFI_RELEASED_RUNTIMES` em
  `backend/src/services/SaasBilling/efiFinancialSource.ts`). Com elas vazias, nenhuma variável de ambiente ativa nada:
  checkout, webhook, settle e fonte de credenciais seguem exatamente o comportamento atual (T-ACT-01/04/06).
- A liberação é **por runtime** (`STREAMHUB_RUNTIME_ENV`), não global (DECISOES B34-T1). Por isso a homologação usa
  **dois deploys** em TESTE:
  1. **Deploy 1 — inerte:** este código, listas vazias. Valida que nada mudou (H-01, H-02) e permite cadastrar e
     testar o slot `homologation` (H-03…H-05) sem efeito financeiro.
  2. **Deploy 2 — liberação TESTE:** um commit revisado que acrescenta `"test"` às quatro listas (diff exato em §6.1).
     PRODUÇÃO continua travada **no código** mesmo que esse commit chegue lá, porque `"production"` não está nas listas.
- Cada controle continua com default desligado; em TESTE a ativação é **um por vez**, por variável de ambiente, na ordem
  do §6.2.
- A promoção futura a PRODUÇÃO exigirá outro release (acrescentar `"production"`), que também passa por TESTE antes —
  em TESTE, `"production"` na lista não tem efeito.

---

## 1. Ações que dependem de você (R)

### 1.1 Decisões
| # | Decisão | Recomendação | Bloqueia |
|---|---------|--------------|----------|
| R-1 | Aprovar o relatório da B3.3 e esta preparação | — | tudo |
| R-2 | Autorizar o commit do conjunto B3.1–B3.3 + preparação (o agente não faz commit) | Um commit único, revisado, incluindo `backend/scripts/` (P-B31-10) | deploy 1 |
| R-3 | Autorizar o deploy 1 (inerte) em TESTE | — | §5 |
| R-4 | Autorizar o commit "liberação TESTE" (§6.1) e o deploy 2 | Só depois de H-01…H-05 aprovados | §6 |
| R-5 | PT-10 — retenção de `SaaSGatewayWebhookEvents` | Proposta em DECISOES §12.1 (indefinida para eventos com efeito financeiro; 180 dias para `teste`/`ignored_not_saas`); nenhuma exclusão automática até decidir | promoção |
| R-6 | PT-12 — secret do webhook do slot | Na VPS de TESTE atual não há `WEBHOOK_SUBSCRIPTION_SECRET` e o legado usa a conta de **produção** (§1.3): gerar um secret novo (≥ 32 caracteres) só para o slot `homologation`; **não** reaproveitar nada do legado | H-05 |
| R-7 | PT-6 — mTLS do webhook (ver §4.4) | Tentar o cadastro em sandbox como está (com `x-skip-mtls-checking`, paridade com o SDK). Se a Efí recusar com `webhook_invalido`, decidir pela opção B (mTLS no nginx de TESTE) | H-07, H-10 |
| R-8 | P-B31-04 — webhook secret curto gravado antes da B3.1 | Regravar o secret do slot (≥ 32) antes de ativar | H-05 |
| R-9 | P-B32-02 — checkout legado formata valores ≥ R$ 1.000 errado | Em TESTE usar faturas < R$ 1.000; a v2 já corrige (`toFixed(2)`); decidir se corrige o legado | — |

### 1.2 Insumos que só você tem
- Conta Efí **sandbox** com: aplicação com os escopos `cob.write`, `cob.read`, `pix.read`, `webhook.write`,
  `webhook.read` (habilitados no painel Efí, não no OAuth — PT-4); chave Pix de homologação; Client ID/Secret de
  homologação; certificado P12 de homologação.
- Confirmar que as variáveis `GERENCIANET_*` da VPS de TESTE apontam para a **mesma conta sandbox** e a mesma chave Pix
  que serão cadastradas no slot `homologation` (D-P14; senão H-20 e H-36 não são válidos).
- Acesso Super Admin pessoal em TESTE.
- Acesso operacional (O) à VPS de TESTE: systemd, Redis, nginx, `psql` só leitura, `pg_dump`.
- `BACKEND_URL` público com HTTPS e certificado válido (cadeia de CA) alcançável pela Efí.

### 1.3 Constatações da VPS de TESTE (diagnóstico de 2026-10-21, só leitura)
- Identidade: hostname `vmi3163669`, IP `89.117.79.221`, `api.teste.streamhubchat.com.br`, `/var/www/atendechat`,
  `atendechat-backend.service` (systemd, root). Implantado: `2445edb`. Node 20.20.2, npm 10.8.2, Postgres 16 local,
  Redis local, 133 GB livres.
- **`GERENCIANET_SANDBOX=false`: o checkout legado de TESTE usa a conta Efí de PRODUÇÃO.** Todo Pix gerado pelo
  checkout legado, pelo webhook legado ou por `/subscription/create/webhook` é real. D-P14 **não** vale nesta VPS.
  Consequências:
  - nenhum smoke ou teste gera Pix pelo checkout legado (§5 passo 13);
  - homologação só no caminho `database` (slot `homologation`, sandbox). A guarda B34-T7 impede v2, pipeline e
    varredura fora da fonte `database` efetiva;
  - H-20 e H-36 (comparação com o legado na mesma conta) não são válidos aqui: registrar como não aplicáveis;
  - rollback de `EFI_CREDENTIALS_SOURCE` volta ao legado = conta de produção (§7.2).
- `STREAMHUB_RUNTIME_ENV` ausente: definir `test` antes de configurar o slot (R).
- `EFI_CREDENTIAL_ENCRYPTION_KEY` ausente: definir antes de configurar o slot (R). O código exige string não vazia e
  deriva a chave por SHA-256 (AES-256-GCM). Gerar na própria VPS, uma por ambiente, sem exibir:
  `openssl rand -base64 48`. Nunca trocar depois sem recifrar o slot.
- `WEBHOOK_SUBSCRIPTION_SECRET` ausente com `NODE_ENV=production`: o webhook legado responde 401 a tudo (estado
  pré-existente, inalterado pelo deploy).
- Árvore com `install.sh` (só modo 644→755) e `frontend/yarn.lock` (o `npm install` remove as entradas `fsevents`,
  exclusivas do macOS). Nenhum serviço ou cron usa `install.sh`; o frontend usa npm, yarn não está instalado.
  Cópias em `/root/backups/vps-local-files-20261021-154351/`. Restaurar os dois antes do build (§5 passo 4).
- Backup pré-deploy: `/root/backups/atendechat-teste-20261021-154306-pre-b34-deploy1.dump` (`pg_dump -Fc`,
  158/158 tabelas, leitura completa ok, `.sha256` ao lado).

---

## 2. Pré-requisitos técnicos (conferir antes do deploy 1)

| Item | Como conferir (O) | Esperado |
|------|-------------------|----------|
| Node | `node -v` no usuário do serviço | ≥ 18; ideal o mesmo de produção (`node:20`). P12 legado não abre no Node ≥ 17 (P-B31-02) |
| Redis | `redis-cli -u "$REDIS_URI" ping` (sem imprimir a URI) | `PONG` — o worker usa a mesma `REDIS_URI` das filas atuais |
| Runtime | `STREAMHUB_RUNTIME_ENV` | `test` |
| Chave de cifra | `EFI_CREDENTIAL_ENCRYPTION_KEY` presente; fingerprint ≠ produção (comparar `printf %s "$K" \| sha256sum`, nunca o valor) | presente e distinta (R-21) |
| Controles | variáveis da Fase 8.3-B3 | **todas ausentes** ou no default: `EFI_CREDENTIALS_SOURCE`, `EFI_PIX_CHARGE_V2_ENABLED`, `EFI_WEBHOOK_PIPELINE`, `EFI_WEBHOOK_WORKER_PAUSED`, `EFI_PIX_RECONCILIATION_SWEEP_ENABLED`, `TRUST_PROXY_HOPS`, `EFI_WEBHOOK_IP_ALLOWLIST` |
| Flags 8.4 | `BILLING_AUTOMATION_NORMALIZED_DATES` | **ausente** |
| Flags financeiras | `SAAS_BILLING_AUTO_INVOICE`, `EFI_BOLETO_ENABLED`, `EFI_CARD_ENABLED`, `EFI_COBRANCAS_SETTLE_ENABLED`, `EFI_NATIVE_SUBSCRIPTION_ENABLED` | `false` |
| Git | `git status` no checkout da VPS | árvore limpa (build `dirty: false`; a homologação recusa build sujo) |
| Disco | `df -h` | espaço para `pg_dump` + build |

---

## 3. Verificação prévia das migrations

### 3.1 Migrations novas desta entrega
| Migration | O que faz | Reversão |
|-----------|-----------|----------|
| `20261020120000-saas-payment-attempts-txid-unique` (B3.2) | índice único parcial em `SaaSPaymentAttempts.externalTxid`; **para com erro, sem alterar dados**, se houver txid repetido | `down` só remove o índice |
| `20261021120000-saas-gateway-webhook-events` (B3.3) | cria `SaaSGatewayWebhookEvents` + 6 índices; idempotente | `down` recusado se houver eventos |

Nenhuma altera tabela financeira existente, fatura, pagamento, vencimento ou empresa.

### 3.2 Script somente leitura
`docs/FASE-8.3-B3-EFI/preflight-teste.sql` (O, antes do deploy e de novo depois):
```
psql "<conexão do banco de TESTE>" -f docs/FASE-8.3-B3-EFI/preflight-teste.sql > preflight-antes.txt
```
Roda em `BEGIN READ ONLY … ROLLBACK`; não lê colunas cifradas. Conferir:
1. as 6 migrations pré-requisito aplicadas (se faltar alguma, ela rodará junto — revisar antes);
2. as 2 migrations da B3 **não** aplicadas;
3. **zero** txid repetido em `SaaSPaymentAttempts` (P-B32-04). Se houver, **não** fazer o deploy: a migration para.
   Analisar com o responsável cada par (qual tentativa é a real) antes de qualquer correção;
4. tabela `SaaSGatewayWebhookEvents` inexistente;
5. slots Efí (só máscaras e flags);
6–10. linha de base (cobranças abertas nas últimas 2 h, D-P11, conciliação aberta, contagens financeiras).
Guardar a saída de "antes" e "depois": as contagens da seção 10 **não podem mudar** só pelo deploy.

### 3.3 Ensaio local já feito (evidência)
Banco descartável migrado até a 8.4, com dados (empresa, fatura, tentativas legadas, uma com txid repetido):
- preflight listou o txid repetido; `db:migrate` **parou** com
  `[saas_payment_attempts_external_txid_unique] 1 txid(s) repetidos …; analise e resolva antes de aplicar (nenhum dado foi alterado)`;
  as 3 tentativas ficaram intactas;
- após resolver a duplicidade, `db:migrate` aplicou as duas; tabela + 7 índices + índice único criados;
- segunda execução: `No migrations were executed`; dados preservados; preflight pós-migração ok.

---

## 4. Configuração da Efí e validação de certificados e webhook

### 4.1 Certificado P12 (antes do upload) — O ou R, na máquina com o arquivo
```
cd backend && node scripts/check-efi-p12.js /caminho/seguro/homologacao.p12
```
Mostra só a versão do Node, o tamanho, o **fingerprint SHA-256** (o mesmo exibido pelo painel), titular, emissor e validade;
nunca a chave. Saída `0` = abre com senha vazia no Node em uso. Rodar **com o Node da VPS**. Se aparecer
`Unsupported PKCS12 PFX data`, reconverter o P12 sem `-legacy` (P-B31-02). Conferir que o fingerprint mostrado no painel
depois do upload é o mesmo.

### 4.2 Slot `homologation` pelo painel (R) — H-03…H-05 (deploy 1)
Super Admin → Plataforma → Integração Efí:
1. Cadastrar Client ID/Secret, chave Pix e webhook secret (≥ 32; ver R-6), ambiente sandbox.
2. Enviar o P12. Conferir o fingerprint (§4.1).
3. Teste de conexão: Cobranças ok **e** "Pix validado (mTLS)" (o toast agora mostra o resultado real do Pix).
4. Ativar. O card "Status da integração e controles" deve mostrar: configuração válida, validação Pix, homologação
   inexistente, fingerprint, fonte financeira `legacy_env`, todos os controles "não liberado / inativo".
Nada disso muda checkout ou webhook (fonte `database` não liberada).

### 4.3 Webhook — formato e cadastro (deploy 2)
- Formato atual (pipeline `legacy`): `<BACKEND_URL>/subscription/webhook?token=<secret>`.
- Formato novo (pipeline `async`): `<BACKEND_URL>/subscription/webhook?whToken=<secret>&ignorar=` (DECISOES B33-T6).
- O cadastro é **só** pelo painel (`POST /saas/finance/efi/webhook/register`), exige a cobrança v2 ativa (C3) e
  confere por GET. Escolhe o formato pelo pipeline efetivo (T-ACT-08). Resposta e auditoria com a URL mascarada.
- **Evidência de PT-2/PT-5 (nova):** cada evento persistido grava em `payload.authVia` **qual forma autenticou**
  (`whToken`, `whToken_pix_suffix`, `token`, `token_pix_suffix`, `bearer`), nunca o valor; o log `[webhook:async]
  recebido` também. Com a URL nova e `ignorar=` funcionando, o esperado é `whToken`. Consulta só leitura:
  `SELECT id, "eventType", payload->>'authVia' FROM "SaaSGatewayWebhookEvents" ORDER BY id DESC LIMIT 10;`
- PT-7: a doc oficial diz que a Efí envia notificação de teste no cadastro. Ela vira evento `teste` (`ignored_not_saas`),
  usado como evidência de homologação de produção (D-P17).

### 4.4 mTLS (PT-6) — decisão R-7
A doc oficial (conferida em 2026-10-21) exige mTLS no receptor: cadastro sem mTLS → `400 webhook_invalido`; a Efí faz
um handshake sem certificado (deve ser recusado) e outro com a cadeia pública
(`https://certificados.efipay.com.br/webhooks/certificate-chain-homolog.crt`). `x-skip-mtls-checking` não está na doc
(só no SDK, que o envia hoje).
- **Opção A (tentar primeiro):** cadastrar como hoje (com o cabeçalho). Se aceitar, registrar a evidência e manter
  token + allowlist opcional.
- **Opção B (se A falhar):** mTLS no nginx de TESTE, decisão de infraestrutura fora do código. Exemplo, **não aplicado**:
```
# server { ... } do domínio da API em TESTE
ssl_client_certificate /etc/nginx/efi/certificate-chain-homolog.crt;
ssl_verify_client optional;
location = /subscription/webhook {
    if ($ssl_client_verify != SUCCESS) { return 403; }
    proxy_pass http://coreflow_node;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```
  (`optional` não quebra as outras rotas. Validar antes com `nginx -t` e confirmar com a Efí se a recusa do 1º
  handshake precisa ser no TLS, o que exigiria um `server` dedicado com `ssl_verify_client on`.)

### 4.5 Logs do nginx (S2) — recomendado, O
O token viaja na query; o log de acesso padrão grava `$request` (com query). Sugestão para a rota do webhook, **não
aplicada**:
```
log_format sem_query '$remote_addr - [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';
location = /subscription/webhook {
    access_log /var/log/nginx/webhook.log sem_query;
    proxy_pass http://coreflow_node;
}
```
A aplicação já não loga a query nem envia query/`Authorization` ao Sentry nessa rota (B33-T9).

---

## 5. Deploy 1 — inerte (O, com autorização R-3)

Sequência da 8.4 (HOMOLOGACAO 8.4 §1.3), com parada curta. Alvo: o commit aprovado (hoje `origin/main`).
Tudo como root na VPS de TESTE, depois de conferir `hostname` = `vmi3163669` e `BACKEND_URL` de TESTE.
1. Pré-checagens só leitura (§2) + `preflight-teste.sql` → `/root/backups/preflight-antes.txt`; anotar
   `git rev-parse HEAD` (hoje `2445edb`).
2. Backup: `pg_dump -Fc` em `/root/backups/` (modo 700), sem sobrescrever; conferir com `pg_restore -l` e
   `pg_restore -f /dev/null`. Já existe o de 2026-10-21 (§1.3); refazer se houver mudança no banco desde então.
3. `cp -p install.sh frontend/yarn.lock` para `/root/backups/` (já feito em §1.3) e
   `git checkout -- install.sh frontend/yarn.lock`; `git status --porcelain --untracked-files=no` vazio.
4. `git fetch origin` + `git checkout <commit aprovado>` (os commits novos não tocam esses dois arquivos).
5. `cd backend && npm install --production=false` (serviço no ar; dependências inalteradas desde `2445edb`).
6. `npm run build` **com o serviço no ar** é impossível (o build apaga `dist`): por isso
   `sudo systemctl stop atendechat-backend` imediatamente antes. Início da indisponibilidade da API.
7. `npm run build`. Conferir: `dist/server.js`,
   `dist/database/migrations/20261020120000-saas-payment-attempts-txid-unique.js`,
   `dist/database/migrations/20261021120000-saas-gateway-webhook-events.js`, e `dist/build-info.json` com o commit
   aprovado e `"dirty": false`.
8. `npx sequelize db:migrate`. Se parar por txid repetido: **não** iniciar o backend novo; ver rollback §7.1.
   Conferir: `SELECT name FROM "SequelizeMeta" WHERE name LIKE '2026102%';` → as duas.
9. `sudo systemctl start atendechat-backend` (fim da indisponibilidade); `journalctl -u atendechat-backend -n 200`:
   - linha `[efi] controles de ativação` com todos os controles no default e `webhookPipelineAsyncActive: false`;
   - linha `[gatewayWebhook] pipeline async inativo — worker e recuperação não registrados`;
   - nenhum `does not exist` / `ERR_INTERNAL`.
10. Frontend: `cd frontend && npm install && npm run build`; `sudo nginx -t && sudo systemctl reload nginx`.
11. `git checkout -- frontend/yarn.lock` (o `npm install` volta a alterá-lo; mantém a árvore limpa para o próximo
    build). O `dist/build-info.json` do backend já foi gravado limpo no passo 7.
12. `preflight-teste.sql` → `/root/backups/preflight-depois.txt`: seção 10 igual à de antes; seções 2 e 4 presentes.
13. Smoke **sem cobrança** (H-01/H-02): login; Central de Assinaturas; `/financeiro` do tenant (só abrir a lista de
    faturas); painel Efí → card de status com tudo "não liberado" e fonte `legacy_env`.
    **Proibido** gerar Pix pelo checkout legado ou chamar `/subscription/create/webhook`: nesta VPS é a conta de
    produção (§1.3). A ausência de regressão do checkout legado é coberta pelos testes de contrato (T-ACT-01,
    `efiLegacyContract.spec`), não por cobrança real.
14. H-03…H-05 (§4.2), só depois de `STREAMHUB_RUNTIME_ENV=test` e `EFI_CREDENTIAL_ENCRYPTION_KEY` (R).

---

## 6. Deploy 2 — liberação TESTE e ativações (com autorização R-4)

### 6.1 Commit "liberação TESTE" (A prepara quando autorizado; R aprova)
Único diff de código, em `backend/src/services/SaasBilling/efiFinancialSource.ts`:
```diff
 > = Object.freeze({
-  databaseFinancial: [],
-  pixChargeV2: [],
-  webhookPipeline: [],
-  pixReconciliationSweep: []
+  databaseFinancial: ["test"],
+  pixChargeV2: ["test"],
+  webhookPipeline: ["test"],
+  pixReconciliationSweep: ["test"]
 });
```
mais o ajuste dos testes que afirmam as listas vazias (`efiWebhookReception.spec`, `efiPixChargeV2.spec`,
`efiRuntimeCredentials.spec`, `gatewayWebhookPipeline.it.spec`), que passam a afirmar `["test"]` e "nenhum `production`".
Liberação parcial não tem efeito: pela guarda B34-T7, v2, pipeline e varredura só ativam com a fonte `database`
efetiva no mesmo runtime, e `efiActivationGuard.spec` reprova um release que libere uma delas sem `databaseFinancial`.
Deploy igual ao §5 (sem migration nova). Sem variáveis novas, o comportamento continua o atual: cada controle só muda
algo quando a variável correspondente for ligada.

### 6.2 Ordem de ativação em TESTE (uma variável por vez; restart após cada uma; registrar antes/depois)
As fases D, E e F só têm efeito com a fase C ativa (B34-T7); o card mostra "configurado" e "liberado" sem "efetivo" se C cair.
| Fase | Variável (TESTE) | Cenários | Conferir no card de status |
|------|------------------|----------|----------------------------|
| C | `EFI_CREDENTIALS_SOURCE=database` | H-06 | fonte financeira `database`, slot `homologation`, sandbox, `usable` |
| D | `EFI_PIX_CHARGE_V2_ENABLED=true` | H-07 (cadastro formato atual; formato novo recusado), H-08, H-09, H-17 | v2 ativa |
| E | `EFI_WEBHOOK_PIPELINE=async` + recadastrar o webhook (formato novo) pelo painel | H-10…H-16, H-21, H-22, H-24, H-25, H-27 | pipeline ativo; boot loga `[gatewayWebhook] worker e recuperação registrados` |
| F | ensaios de falha (§6.3) e `EFI_PIX_RECONCILIATION_SWEEP_ENABLED=true` só para H-18; `TRUST_PROXY_HOPS` (+ `EFI_WEBHOOK_IP_ALLOWLIST=34.193.116.226` opcional) só para H-26 | H-18, H-19, H-26, H-28…H-32 | indicadores de pendentes, fila, eventos sem job |
| G | rollbacks | H-20, H-33, H-34 | — |
| H | homologação | H-23, H-35, H-36 | homologação registrada; `versionDiffers` |

`TRUST_PROXY_HOPS` muda `req.ip` em todo o backend: ligar só em H-26, conferir que login/rotas seguem normais e
desligar depois, salvo decisão contrária.

### 6.3 Ensaios de falha (O)
- H-28: `sudo systemctl stop redis` (ou o serviço equivalente), pagar a fatura D → recepção 200, evento `received`.
- H-29: religar o Redis → em até ~1 min a recuperação republica; D processada uma vez.
- H-30: `sudo systemctl restart atendechat-backend` durante o processamento → lock antigo recuperado em ~10 min.
- H-32: `EFI_WEBHOOK_WORKER_PAUSED=true` + restart → recepção ok, nada processado; remover + restart → processado.

---

## 7. Plano de rollback

Do mais leve ao mais pesado. Migrations **nunca** são revertidas (aditivas; `down` da tabela de eventos é recusado com dados).

### 7.1 Durante o deploy
- Falha antes da migration: `git checkout <commit anterior>`, `npm run build`, `systemctl start`.
- Serviço não sobe depois da migration: `journalctl` para o erro; se não for corrigível na hora, `git checkout
  <commit anterior>`, `npm run build`, `systemctl start` (o código anterior ignora a tabela e o índice novos).
- Migration parou por txid repetido: nada foi alterado; voltar ao commit anterior como acima; analisar a duplicidade.
- Falha depois da migration: reverter só o código (as tabelas/índices novos não afetam o código anterior).
- `pg_dump` só em corrupção comprovada, com decisão do responsável.

### 7.2 Durante as ativações (TESTE)
| Situação | Rollback | Efeito |
|----------|----------|--------|
| Pipeline com problema | **preferencial:** `EFI_WEBHOOK_WORKER_PAUSED=true` + restart | recepção segue gravando; nada processado; retomar = remover a variável |
| Pipeline total | `EFI_WEBHOOK_PIPELINE` removida + restart **e** recadastrar a URL antiga (`?token=`) (C4) | webhook legado; eventos já gravados ficam para retomada |
| Cobrança v2 | `EFI_PIX_CHARGE_V2_ENABLED` removida + restart | checkout legado; cobranças v2 abertas seguem pagáveis (`#Fatura:` preservado, T-RB-02) |
| Fonte de credenciais | `EFI_CREDENTIALS_SOURCE` removida + restart | `legacy_env`; pela guarda B34-T7, v2, pipeline e varredura desligam juntas. **Nesta VPS o legado é a conta de produção** (§1.3): depois do rollback, nenhum teste de pagamento |
| Liberação de código | deploy do commit anterior (listas vazias) | tudo volta ao comportamento atual, mesmo com variáveis ligadas |

Depois de qualquer rollback: conferir as cobranças abertas criadas no período por 24 h; nenhum evento `processing`
antigo; `pendingOverdue` e `eventsWithoutJob` no card zerados.

---

## 8. Testes reais previstos (B3.4)

Todos os H-* do `HOMOLOGACAO.md`, com conta **sandbox** e faturas de valor baixo e distinto (< R$ 1.000, R-9). Evidências
(HOMOLOGACAO §5) mais as consultas só leitura abaixo.

| Grupo | Cenários | Evidência adicional desta entrega |
|-------|----------|-----------------------------------|
| A — default | H-01, H-02 | `preflight` antes/depois idêntico na seção 10; card de status |
| B — slot | H-03…H-05 | `check-efi-p12.js` + fingerprint do painel; auditoria `activate` |
| C/D — fonte e v2 | H-06…H-09, H-17 | `SaaSPaymentAttempts.payloadSummary` com `source`, `configId`, commit |
| E — pipeline | H-10…H-16, H-21, H-22, H-24, H-25, H-27 | eventos (`status`, `result.reason`, `payload.authVia`), itens de conciliação |
| F — falhas | H-18, H-19, H-26, H-28…H-32 | indicadores do card; `attemptLog` dos eventos |
| G — rollback | H-20, H-33, H-34 | contagens antes/depois; nenhum evento perdido |
| H — homologação | H-23, H-35, H-36 | auditoria `homologate` com fingerprint, ambiente, commit |

Consultas só leitura úteis (O):
```
-- eventos recentes
SELECT id, "eventType", status, right(txid,6) txid, right("endToEndId",6) e2e, amount, "invoiceId",
       "paymentId", "reconciliationItemId", attempts, result->>'reason' motivo, payload->>'authVia' auth,
       "receivedAt", "processedAt"
FROM "SaaSGatewayWebhookEvents" ORDER BY id DESC LIMIT 20;
-- pendentes e locks antigos (H-31: esperado 0 além do limite)
SELECT status, COUNT(*), MIN("receivedAt") FROM "SaaSGatewayWebhookEvents"
WHERE status IN ('received','retry_scheduled','processing') GROUP BY status;
-- todo evento de conciliação tem item ou classificação (H-31)
SELECT id, status, result->>'reason' FROM "SaaSGatewayWebhookEvents"
WHERE status IN ('reconciliation','failed_exhausted') AND "reconciliationItemId" IS NULL;
-- renovação única por fatura
SELECT "invoiceId", COUNT(*) FROM "SaaSSubscriptionRenewals" WHERE "invoiceId" IS NOT NULL
GROUP BY 1 HAVING COUNT(*) > 1;
```
(`reconciliation` sem item é esperado só quando não há empresa conhecida — fatura inexistente/txid sem vínculo,
DECISOES B33-T16.)

Homologação (H-23) no painel ("Registrar homologação"): TESTE exige o evento `applied` de H-10, o pagamento gateway e
a renovação dele, todos com a fonte `database` e o fingerprint atual.

---

## 9. Checklist resumido

- [ ] R-1…R-4 aprovados; R-5…R-9 decididos ou registrados
- [ ] Commit único revisado (inclui `backend/scripts/`); árvore limpa na VPS
- [ ] §2 conferido sem expor valores
- [ ] `preflight-antes.txt` sem txid repetido
- [ ] Backup do dia
- [ ] Deploy 1 (§5) com boot logando controles no default e pipeline inativo
- [ ] `preflight-depois.txt` com seção 10 idêntica
- [ ] Smoke + H-01…H-05
- [ ] Commit "liberação TESTE" (§6.1) aprovado e deploy 2
- [ ] Ativações §6.2 uma a uma, com registro
- [ ] Ensaios §6.3, rollbacks §7.2, homologação H-23/H-35/H-36
- [ ] Relatório `RELATORIO-HOMOLOGACAO.md` com aprovado/reprovado por cenário e o commit homologado
