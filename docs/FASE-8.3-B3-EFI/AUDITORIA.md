# Fase 8.3-B3 — Auditoria técnica da integração Efí

**Data:** 2026-10-20 · **Base:** `main` @ `2445edb` (working tree limpo) · **Tipo:** somente leitura

Escopo: credenciais, cobrança Pix, webhook, confirmação, renovação, conciliação, segurança e compatibilidade.
Nenhum código, banco, ambiente ou servidor foi alterado. As afirmações marcadas **[FATO]** foram comprovadas no código
deste commit. As marcadas **[INFERÊNCIA]** decorrem do código somado à documentação oficial da Efí, mas não podem ser
confirmadas sem acesso a logs/VPS (proibido nesta fase). As marcadas **[A VERIFICAR]** dependem de homologação.

---

## 1. Resumo executivo

1. **Existem duas integrações Efí paralelas e desconectadas.** [FATO]
   - **Legada (em uso):** checkout Pix, registro de webhook e webhook leem `process.env` (`GERENCIANET_*`,
     `WEBHOOK_SUBSCRIPTION_SECRET`) via `backend/src/config/Gn.ts` e o SDK `gn-api-sdk-typescript@1.0.7`.
   - **Nova (B1/B2):** credenciais cifradas no banco (`PlatformEfiConfigs`), administradas pelo Super Admin. O resolvedor
     `resolveEfiCredentials()` **não tem nenhum consumidor** em código de produção.
2. **Nenhum fluxo de cobrança/pagamento usa a configuração do Super Admin hoje.** O próprio código declara isso
   (`efiCredentialResolver.ts:22`, `PlatformEfiConfigAdminService.ts` “checkout legado inalterado”).
3. **O estado `operational` é inalcançável.** O resolvedor exige `status === "operational"` por padrão; o serviço admin só
   calcula `operational` com `pixHomologated && adminEnabled`, e **nenhum código define `pixHomologated = true`**. [FATO]
4. **Risco alto, não confirmável sem logs: o webhook legado pode estar rejeitando 100% das notificações reais.**
   A Efí acrescenta `/pix` ao **final** da URL cadastrada. O código cadastra `…/subscription/webhook?token=<secret>`.
   A notificação chega como `…?token=<secret>/pix` → `token` ≠ secret → **401**. [INFERÊNCIA — doc oficial Efí + código]
   Se confirmado, toda baixa Pix em produção depende de baixa manual (o que é coerente com a regularização operacional
   feita na 8.4) e o webhook nunca funcionou ponta a ponta.
5. **Cobrança duplicada por design:** cada `POST /subscription` cria **uma nova** cobrança Pix (txid gerado pela Efí),
   sobrescreve `Invoices.externalTxid` e deixa as anteriores pagáveis. A proteção é *a posteriori* (conciliação
   “possível duplicidade”), não preventiva. [FATO]
6. **Pagamentos confirmados podem ser descartados silenciosamente:** fatura não encontrada, valor divergente ou
   `solicitacaoPagador` ausente → apenas `logger.warn` e HTTP 200. Nenhum item de conciliação. [FATO]
7. **Núcleo financeiro 8.4 é sólido e reaproveitável:** `confirmGatewayPayment` (lock `FOR UPDATE`, índice único em
   `SaaSPayments.externalTxid`, renovação idempotente `renew-invoice:<id>`, conciliação para fatura já quitada).
   A B3 deve **trocar a origem das credenciais e o transporte**, não reescrever o núcleo.
8. `BILLING_AUTOMATION_NORMALIZED_DATES` permanece fora do escopo e deve continuar ausente. Nada nesta auditoria a altera.

---

## 2. Documentação das fases anteriores

| Fase | Documento | Situação |
|------|-----------|----------|
| 8.3-B1 | — | **Não existe documento dedicado.** Decisões estão em comentários de código (`efiCredentialResolver.ts`, `efiCertificateStore.ts`, `streamhubRuntimeEnv.ts`) e nas migrations `20261015120000`/`20261015140000`. |
| 8.3-B2 | — | **Não existe documento dedicado.** Referenciada em `docs/FASE-8.4/CHECKLIST-TRANSFERENCIA-ALEX.md` (“procedimento da fase 8.3-B2”), mas o procedimento não está escrito. |
| Marco 0 | `docs/EFI-PAY-CONTRACTS-MATRIX.md` | Matriz de contratos Efí e flags. Base de URL Pix lá (`pix.api.efipay.com.br`) **difere** da usada pelo SDK (ver §6.4). |
| 8.4 / 8.4-F | `docs/FASE-8.4/*` (ROADMAP, DECISOES, TESTES, HOMOLOGACAO, RELATORIO-FINAL) | Completa. D9/D17 (webhook 500 em falha), D11 (cancelamento com Pix ativo), HOMOLOGACAO §4 (recuperação de Pix perdidos). |
| Geral | `docs/ATENDECHAT-ROADMAP-FINANCEIRO-SAAS-EFIPAY.md`, `docs/SAAS-FINANCE-HOMOLOGATION.md` | Roadmap macro e checklist de homologação antigo. |

Não há `CLAUDE.md` nem `AGENTS.md` no projeto. Vale a instrução global do usuário (segurança, sem segredos, sem ações
externas sem aprovação).

---

## 3. Arquitetura atual comprovada

### 3.1 Mapa

```
                        ┌──────────────── LEGADO (em uso) ────────────────┐
Tenant /financeiro ──► POST /subscription ──► SubscriptionController.createSubscription
 (CheckoutPage.js:79)                          │  Gerencianet(options)  ◄── config/Gn.ts ◄── process.env GERENCIANET_*
                                               │  pixCreateImmediateCharge → pixGenerateQRCode
                                               │  SaaSPaymentAttempt.create + Invoices.update(externalTxid)
                                               └─ pixConfigWebhook(chave, url?token=SECRET)   (a cada checkout)

Efí ──► POST /subscription/webhook (público) ──► SubscriptionController.webhook
                                               │  verifyWebhookSecret (query token | Bearer)
                                               │  para cada pix: pixDetailCharge(txid) → CONCLUIDA?
                                               │  "#Fatura:<id>" → Invoices.findByPk → valor confere?
                                               └─ confirmGatewayPayment ──► SaaSPayment + Invoice paid
                                                                        └─► applySubscriptionRenewal (renew-invoice:<id>)

Super Admin ──► GET /saas/finance/efi/status, POST /saas/finance/efi/test-auth  (env; diagnóstico legado)
                        └───────────────────────────────────────────────────┘

                        ┌──────────────── NOVO (B1/B2, sem consumidor) ───────┐
Super Admin ──► /saas/finance/efi/config[/:slot][/certificate|test-auth|activate|deactivate|revoke|audits]
                 PlatformEfiConfigAdminService ──► PlatformEfiConfigs (cifrado efic1:) + PlatformEfiConfigAudits
resolveEfiCredentials()  ──► (nenhum chamador)
                        └─────────────────────────────────────────────────────┘
```

### 3.2 Arquivos e serviços envolvidos

| Área | Arquivo | Papel |
|------|---------|-------|
| Config legado | `backend/src/config/Gn.ts:4-16` | Opções do SDK a partir de `GERENCIANET_CLIENT_ID/SECRET/PIX_CERT`, `sandbox` por flag |
| Flags | `backend/src/config/saasBillingFlags.ts` | `EFI_PIX_ENABLED` (default **true**), `GERENCIANET_SANDBOX` (default true se ausente), `requireWebhookSecret` |
| Runtime | `backend/src/config/streamhubRuntimeEnv.ts` | `STREAMHUB_RUNTIME_ENV` test→slot `homologation`/sandbox; production→slot `production`/production |
| Checkout/webhook | `backend/src/controllers/SubscriptionController.ts` | `createSubscription` (81-180), `createWebhook` (185-218), `webhook` (220-315) |
| Rotas | `backend/src/routes/subScriptionRoutes.ts` | `/subscription` (isAuth + feature), `/subscription/create/webhook` (isSuper), `/subscription/webhook` (público) |
| Confirmação | `backend/src/services/SaasBilling/confirmGatewayPayment.ts` | Núcleo idempotente da confirmação |
| Renovação | `backend/src/services/SaasBilling/applySubscriptionRenewal.ts` | Motor único, idempotente por `idempotencyKey` (354-356) |
| Baixa manual | `backend/src/services/SaasBilling/registerManualPayment.ts` | Copia `externalTxid` da fatura (263); Pix → `unsupported` + conciliação (237-245, 302-330) |
| Cancelamento | `backend/src/services/SaasBilling/cancelSaasInvoice.ts` | Soft cancel; **não cancela na Efí**; registra `externalChargeActive` |
| Edição | `backend/src/services/SaasBilling/ManageSaasInvoiceService.ts:308` | Bloqueia edição com cobrança externa |
| Cobranças (boleto/settle) | `backend/src/services/SaasBilling/efiCobrancasClient.ts` | axios direto, **env**, token em cache de módulo |
| Retry settle | `backend/src/services/SaasBilling/retryReconciliationSettle.ts` + `jobs/billingAutomationScheduler.ts` (cron `40 * * * *`) | Só Cobranças, flag OFF |
| Diagnóstico legado | `backend/src/services/SaasBilling/efiIntegrationStatus.ts`, `controllers/EfiIntegrationController.ts` | Status/OAuth a partir de **env** |
| Config nova | `backend/src/models/PlatformEfiConfig.ts`, `PlatformEfiConfigAudit.ts` | Slot global (sem `companyId`), único por `slot` |
| Admin novo | `backend/src/services/SaasBilling/PlatformEfiConfigAdminService.ts`, `controllers/EfiConfigAdminController.ts` | Upsert, certificado, teste OAuth, ativação, revogação, auditoria |
| Cripto | `backend/src/helpers/efiCredentialCrypto.ts` | AES-256-GCM, `efic1:`, chave `EFI_CREDENTIAL_ENCRYPTION_KEY` |
| Certificado | `backend/src/services/SaasBilling/efiCertificateStore.ts` | Blob cifrado no banco; materialização em `os.tmpdir()/streamhub-efi-certs` |
| Resolvedor | `backend/src/services/SaasBilling/efiCredentialResolver.ts` | Só banco, sem fallback env, **sem chamador** |
| OAuth Cobranças (banco) | `backend/src/services/SaasBilling/efiCobrancasOAuth.ts` | Teste de conexão com credenciais do banco |
| Conciliação | `backend/src/controllers/SaasFinanceController.ts:493-518`, `models/SaaSReconciliationItem` | Fila global + resolver |
| Frontend | `frontend/src/components/CheckoutPage/CheckoutPage.js`, `frontend/src/pages/Platform/EfiIntegrationPanel.js`, `frontend/src/components/CompanyFinanceSection/*` | Checkout tenant, painel Efí admin, conciliação por empresa |
| SDK | `backend/node_modules/gn-api-sdk-typescript@1.0.7` | Ver §6.4 |
| Migrations | `20261013120000-saas-finance-foundation.ts`, `20261015120000-platform-efi-configs.ts`, `20261015140000-platform-efi-admin-flags.ts` | Base de dados financeira e Efí |
| Deploy | `docker-compose.yml:14-22`, `backend/.env.example:36-64` | Variáveis Efí legadas e novas |

---

## 4. Credenciais e configuração (A)

| Pergunta | Resposta comprovada |
|----------|---------------------|
| Onde ficam? | **Legado:** `process.env` (`GERENCIANET_CLIENT_ID`, `GERENCIANET_CLIENT_SECRET`, `GERENCIANET_PIX_KEY`, `GERENCIANET_PIX_CERT`, `WEBHOOK_SUBSCRIPTION_SECRET`, `EFI_COBRANCAS_CLIENT_ID/SECRET`). **Novo:** `PlatformEfiConfigs` (colunas `*Encrypted`, máscaras em `*Masked`). |
| Criptografia | AES-256-GCM, IV 12 bytes aleatório, tag 16, formato `efic1:<base64(iv‖tag‖ct)>` (`efiCredentialCrypto.ts:9-35`). Chave = `SHA-256(EFI_CREDENTIAL_ENCRYPTION_KEY)` (26-27). Sem fallback de chave. Sem AAD (o ciphertext não é amarrado à coluna/slot). Sem rotação de chave (prefixo versiona o formato, não a chave). |
| Descriptografia | Segredos de texto: só em memória, no resolvedor (`efiCredentialResolver.ts:159-196`) e no teste OAuth (`PlatformEfiConfigAdminService.testEfiAdminAuth`). **P12: com `requireCertificate`, o resolvedor grava o certificado em claro no disco** (`efiCredentialResolver.ts:210` → `efiCertificateStore.ts:154`). |
| Certificado P12 | Upload via multer `memoryStorage`, limite 2 MB, 1 arquivo (`EfiConfigAdminController.ts:17-19`). A validação é **heurística**: `buf[0]===0x30` + presença de um prefixo de OID PKCS (`efiCertificateStore.ts:42-61`). **Não** verifica se o P12 abre, se tem passphrase ou se está vencido. Um P12 inválido só falha na primeira chamada Pix. Fingerprint SHA-256; cifrado no banco. Materialização em `EFI_CERT_RUNTIME_CACHE_DIR` ou `os.tmpdir()/streamhub-efi-certs`, caminho fixo `<storageKey>.p12` sobrescrito a cada chamada, com 0700/0600 (107-164). Legado: `backend/certs/<GERENCIANET_PIX_CERT>.p12`, copiado de `certificates/` **no build da imagem** (`backend/Dockerfile:25-35`, `copy_cert_assets.sh`). O comentário em `efiCertificateStore.ts:17` (“no start”) está impreciso. |
| Homologação × produção | **Legado:** `GERENCIANET_SANDBOX` — default `true` no código (`saasBillingFlags.ts:38-42`) mas **default `false` no `docker-compose.yml:18`**. **Novo:** `STREAMHUB_RUNTIME_ENV` obrigatório; slot e ambiente amarrados e verificados (`streamhubRuntimeEnv.ts:50-72`). As duas chaves são independentes: é possível `STREAMHUB_RUNTIME_ENV=test` com `GERENCIANET_SANDBOX=false`. |
| Plataforma × empresa | **Somente plataforma.** `PlatformEfiConfig` não tem `companyId`; único por `slot`. Não há credencial por empresa. |
| Serviços que usam env | `Gn.ts` → `SubscriptionController` (checkout, createWebhook, webhook); `efiCobrancasClient.ts` (boleto/settle/cancel/detail); `efiIntegrationStatus.ts` (status/test-auth legados); `buildSubscriptionWebhookUrl` (`BACKEND_URL`, `WEBHOOK_SUBSCRIPTION_SECRET`). |
| Serviços que usam a nova config | Apenas o próprio admin B2 (`PlatformEfiConfigAdminService`, `efiCobrancasOAuth`). `resolveEfiCredentials` sem chamador. |
| Cache de credenciais | **Novo:** nenhum (lê o banco a cada chamada). **Legado:** `Gn.ts` lê env no import (fixo até restart). **Cobranças:** token OAuth em variável de módulo (`efiCobrancasClient.ts:19-53`), por 600 s menos 30 s, **sem invalidação** e sem chave por credencial/ambiente. **SDK Pix:** nenhum cache — faz OAuth a cada chamada (nova instância de `GnAuth` por requisição). |
| Invalidação | Inexistente para o token Cobranças. Troca de credencial no admin zera `lastAuthTestOk`/`adminEnabled` (bom), mas não afeta nada em runtime porque nada consome a config nova. |
| Segredos em logs | Bom: `sanitizeEfiAuthErrorMessage` remove `Bearer`, `client_secret`, PEM; DTOs só com máscaras. Riscos: `logger.error(error)` cru em `createSubscription` (`SubscriptionController.ts:177`) e `logger.warn({err})` em retry; **o secret do webhook trafega na query string**. Ele entra nos logs de acesso do proxy/nginx e nos eventos do **Sentry**: `Sentry.Handlers.requestHandler/errorHandler` (`app.ts:76,81`) capturam a URL com a query em qualquer erro não tratado. Exemplo: `for…of` sobre `req.body.pix` não iterável, fora do `try` (`SubscriptionController.ts:239-241`). O log `path: req.originalUrl` de `AppError` (`app.ts:96`) não alcança o webhook, que responde 401 sem lançar `AppError`. |
| Teste de conexão | Só OAuth **Cobranças** (`/v1/authorize`, sem mTLS). **Não valida Pix nem o P12** — o certificado é checado só por presença. Rate limit em memória 5/min por usuário (`efiIntegrationStatus.ts`), não compartilhado entre réplicas. |

---

## 5. Geração de cobranças (B)

**Pontos que criam cobrança Efí:**

| Ponto | Arquivo | Ativo? |
|-------|---------|--------|
| Pix imediata (`POST /v2/cob`) | `SubscriptionController.ts:134` | **Sim** (`EFI_PIX_ENABLED` default true) |
| Boleto (`POST /v1/charge/one-step`) | `efiCobrancasClient.ts:114-145` | Não — `EFI_BOLETO_ENABLED=false`; **sem chamador** |
| Settle/cancel Cobranças | `efiCobrancasClient.ts:71-94` | Settle só com `EFI_COBRANCAS_SETTLE_ENABLED`; cancel sem chamador |

**Fluxo Pix atual (`createSubscription`):**
1. Valida `invoiceId`, `users`, `connections` (os dois últimos não são usados). Confere `invoice.companyId === req.user.companyId` (isolamento OK), rejeita `paid`/`cancelled`. **Não rejeita** outros status (ex.: valor zero, fatura aberta com cobrança ativa).
2. `pixCreateImmediateCharge(null, body)` — txid **gerado pela Efí**. `expiracao: 3600` (1 h). `solicitacaoPagador: "#Fatura:<id>"` é a **única ligação** usada pelo webhook para achar a fatura.
3. `SaaSPaymentAttempt.create` (status `pending`, `externalTxid`, `locId`).
4. `invoice.update({ externalTxid: <último txid>, gatewayStatus, gatewaySyncStatus: "pending" })` — **fora de transação** com o passo 3.
5. `pixConfigWebhook` a cada checkout (efeito colateral global: reescreve o webhook da chave Pix).
6. Qualquer erro em 2–5 → `400 ERR_SUBSCRIPTION_PIX_CREATE`. Se a falha ocorrer no passo 5, **a cobrança já existe e é pagável**, mas o cliente não recebe o QR.

**Relação fatura ↔ cobrança:** 1 fatura : N cobranças (`SaaSPaymentAttempts`). `Invoices.externalTxid` guarda só a última.
O webhook ignora `SaaSPaymentAttempts` para localizar a fatura (usa o texto `#Fatura:`).

**Tratamento de erro/tentativas:** sem retry, sem timeout próprio (o do SDK é o do axios padrão = infinito), sem
idempotência de requisição. Clique duplo ou duas abas → duas cobranças válidas.

**Riscos de duplicidade:** ver R3, R4 (§8).

**Compatibilidade com 8.4:** confirmação, renovação e conciliação são compatíveis. A edição de fatura com cobrança é
bloqueada (correto). O cancelamento **não** cancela a cobrança na Efí (D11 já registrada).

---

## 6. Webhooks e confirmação (C)

### 6.1 Endpoint e autenticação
- `POST /subscription/webhook`, público (`subScriptionRoutes.ts:22`), sem rate limit, `bodyParser.json` 10 MB.
- Auth: `?token=` **ou** `Authorization: Bearer` igual a `WEBHOOK_SUBSCRIPTION_SECRET`; comparação `===` (não tempo
  constante). Obrigatório fora de development/test (`saasBillingFlags.ts:45-51`).
- **Não há** mTLS no repositório (`deploy/nginx-api-proxy.example.conf` não tem `ssl_verify_client`) nem allowlist de IP.
- O SDK envia `x-skip-mtls-checking: true` em **toda** chamada, porque `validateMtls` nunca é definido
  (`gn-endpoints.js:149`). Logo o webhook é cadastrado sem exigência de mTLS. A Efí então recomenda HMAC na URL + IP.
- **Sufixo `/pix` [INFERÊNCIA crítica]:** documentação oficial — “o caminho `/pix` será acrescentado ao final da URL
  cadastrada”; recomenda terminar a URL com `?ignorar=`. URL cadastrada hoje: `${BACKEND_URL}/subscription/webhook?token=<secret>`
  (`SubscriptionController.ts:16-30`). Resultado provável: `token=<secret>/pix` → 401 em toda notificação real.
  Sem secret (dev): `/subscription/webhook/pix` → 404 (rota não existe). **Confirmar em TESTE e pelos logs de produção.**
- O secret é **embutido na URL registrada na Efí** e repetido a cada checkout.

### 6.2 Processamento
- Confia só no `txid` do payload e **consulta a cobrança na Efí** (`pixDetailCharge`) — boa prova de pagamento.
- Só processa `status === "CONCLUIDA"`; demais ignorados com 200.
- Fatura achada por `solicitacaoPagador` (texto). Não confere se o txid pertence a um `SaaSPaymentAttempt` daquela fatura.
- Valor comparado em centavos com `invoice.value` (pagamento parcial não suportado).
- `confirmGatewayPayment`: transação, `SELECT … FOR UPDATE` na fatura, idempotência por `SaaSPayments.externalTxid`
  (índice único parcial `saas_payments_external_txid_unique`), evento no ledger com chave única, renovação com
  `renew-invoice:<invoiceId>` (mesma chave da baixa manual → uma renovação por fatura).

### 6.3 Respostas HTTP e falhas
| Situação | Resposta | Efeito |
|----------|----------|--------|
| Token inválido | 401 | Efí retenta (até 9× em ~5 h), depois desiste |
| `evento: teste_webhook` | 200 | — |
| Cobrança não `CONCLUIDA` | 200 | Ignorado (correto) |
| `solicitacaoPagador` ausente | 200 | **Pagamento descartado**, só `warn` |
| Fatura não encontrada | 200 | **Pagamento descartado**, só `warn` |
| Valor divergente | 200 | **Pagamento descartado**, só `warn` |
| Pix recebido na chave **sem txid** (Pix direto, não cobrança) | `pixDetailCharge({txid: undefined})` falha → **500** | Efí retenta 9× algo que nunca terá sucesso; lote inteiro responde 500 |
| Erro de rede/DB em qualquer item | 500 | Efí retenta o lote; itens já aplicados são replay idempotente (OK) |
| Fatura **cancelada** paga | 200 ou **500 em loop** | Só checa `paid` (`confirmGatewayPayment.ts:177`). (a) Sem fatura substituta do mesmo ciclo: **marca `paid`, cria receita e renova**. (b) **Com** substituta do mesmo `cycleKey`: `invoices_company_cycle_unique` (migration `20261013120000:87-89`, exclui só `cancelled`) é violado no `update` → 500 → a Efí retenta até desistir → **Pix não registrado**. (c) Cada txid distinto pago para a cancelada cria **outro** `SaaSPayment` e receita, sem alerta. (d) Renovação dupla do ciclo: `renew-invoice:<cancelada>` + `renew-invoice:<substituta>`, porque a idempotência é por fatura, não por ciclo. D11 aceitou registrar o dinheiro; renovar não foi decidido. |
| Fatura já `paid` | 200 | Conciliação “possível duplicidade” (idempotente por txid) |
| Devolução (`pix[].devolucoes`) | 200 | Replay ignorado; **estorno não é refletido** (fatura segue `paid`, receita contada) |

### 6.4 SDK `gn-api-sdk-typescript@1.0.7` [FATO — código em `node_modules`]
- Bases **`api-pix.gerencianet.com.br`** / **`api-pix-h.gerencianet.com.br`** (`gn-constants.js:9-10`); a matriz Marco 0 e a
  doc atual usam `pix.api.efipay.com.br`. **[A VERIFICAR]** se os domínios antigos seguem suportados.
- Lê o P12 **do disco** a cada chamada (`fs.readFileSync(pathCert)`), sem passphrase → compatível com materialização B1.
- OAuth a cada chamada; falha de OAuth é engolida (`getAccessToken().catch(err => err)`) e a chamada segue com
  `Bearer undefined`.
- Erro de rede sem `response.data` não resolve nem rejeita a promise (`directReqCallback`) → **requisição pendurada**
  (checkout preso; webhook estoura o timeout de 60 s da Efí → retry).
- Exceção síncrona se o P12 não existir (vira 400 no checkout).
- Lê o P12 duas vezes por chamada (`GnAuth` e `GnEndpoints`).
- A promise só fica pendurada quando o erro de rede vem sem `response`.
- Endpoint `pixCreateCharge` (`PUT /v2/cob/:txid`) existe no SDK.

### 6.5 Concorrência e ordem
- Mesmo txid simultâneo: serializado pelo lock + índice único (testado na 8.4).
- Dois txids diferentes da mesma fatura **aberta**: o 1º quita; o 2º abre conciliação “possível duplicidade” (sem renovação).
  Para fatura **cancelada** não há essa proteção (ver §6.3).
- `SaaSPaymentAttempts.externalTxid` tem só índice comum (migration `20261013120000:256`), sem unicidade.
  `Invoices.externalTxid` guarda só o último txid. Localizar a fatura pelo txid exige índice único novo.
- Fora de ordem: só `CONCLUIDA` importa; devolução antes da confirmação não é tratada.
- `SaaSPaymentAttempt.update` roda **depois** e **fora** da transação de confirmação; falha nele devolve 500 e gera
  retry (idempotente, mas ruído).

### 6.6 Pagamento externo confirmado sem baixa local
Possível hoje por: (a) 401 do sufixo `/pix` [INFERÊNCIA]; (b) fatura não encontrada/valor divergente (descarte);
(c) esgotamento das 9 tentativas; (d) incidente `b2a3f30` já documentado (8.4 HOMOLOGACAO §4).
**Não existe** varredura que compare cobranças `CONCLUIDA` na Efí com faturas locais.

---

## 7. Conciliação e observabilidade (D)

| Pergunta | Situação |
|----------|----------|
| Consulta de status de cobrança | Só dentro do webhook. Não há endpoint/admin para “consultar este txid agora”. `gatewayStatus` da fatura fica `ATIVA` para sempre após expirar. |
| Conciliação automática | Só `retryPendingSettles` (Cobranças, flag OFF). Nenhuma para Pix. |
| Conciliação manual | `SaaSReconciliationItems` com tela **por empresa** (`CompanyFinanceSection`). Fila global `GET /saas/finance/reconciliation` **sem tela**. `POST …/:id/resolve` **sem tela**, sem nota obrigatória, **sem ator**, sem evento no ledger, e **sobrescreve `message`** (perde o texto original). |
| Registro de tentativas/falhas | `SaaSPaymentAttempts` (criação), `SaaSFinancialEvents` (confirmações), logs. **Webhooks recebidos não são persistidos**; rejeições 401/descartes só existem em log. |
| Rastreabilidade | Boa para pagamentos aplicados (payment ↔ invoice ↔ evento ↔ renovação). Ruim para notificações rejeitadas/descartadas. |
| Reprocessar confirmação com segurança | Só via reenvio pela Efí (`POST /v2/gn/webhook/reenviar`, 30 dias, não exposto pelo SDK) ou baixa manual (8.4 §4). Nenhum “reprocessar txid” administrativo. |
| Alertas de divergência | Itens de conciliação + contador na Central de Assinaturas. Sem alerta ativo (e-mail/notificação). |
| Super Admin sem SSH | Vê conciliação por empresa e o status de config. **Não vê** falhas de webhook, 401, descartes nem erros do checkout. |

---

## 8. Problemas e riscos

Severidade: **C** crítico · **A** alto · **M** médio · **B** baixo.

| # | Sev. | Risco | Evidência |
|---|------|-------|-----------|
| R1 | C | Webhook provavelmente rejeita notificações reais (sufixo `/pix` após `?token=`) | `SubscriptionController.ts:16-30` + doc Efí [INFERÊNCIA] |
| R2 | C | Config do Super Admin não usada; `operational` inalcançável; troca de credencial no painel não tem efeito | `efiCredentialResolver.ts:140`, `PlatformEfiConfigAdminService.ts:45-66`, ausência de `pixHomologated = true` |
| R3 | A | N cobranças Pix pagáveis por fatura (sem reuso, sem txid determinístico) | `SubscriptionController.ts:134,155` |
| R4 | A | Pagamentos descartados com 200 (fatura inexistente, valor divergente, sem `solicitacaoPagador`) | `SubscriptionController.ts:252-285` |
| R5 | A | Pix sem txid na chave → 500 em loop até a Efí desistir; bloqueia o lote | `SubscriptionController.ts:244` |
| R6 | A | Fatura cancelada paga: reativa e renova; com substituta do ciclo → 500 em loop e Pix perdido; N txids → N receitas; renovação dupla do ciclo | `confirmGatewayPayment.ts:177,239`, `invoices_company_cycle_unique` |
| R7 | A | `pixConfigWebhook` a cada checkout: efeito global, falha deixa cobrança órfã sem QR, secret reenviado | `SubscriptionController.ts:162-170` |
| R8 | A | Secret do webhook na query string (logs do nginx, eventos Sentry com URL) e comparação não constante | `SubscriptionController.ts:27,73`, `app.ts:76,81` |
| R9 | A | Ambientes inconsistentes: `GERENCIANET_SANDBOX` default true no código e false no compose; independente de `STREAMHUB_RUNTIME_ENV` | `saasBillingFlags.ts:38`, `docker-compose.yml:18` |
| R10 | M | SDK 1.0.7: domínios legados, promise pendurada em erro de rede, OAuth engolido, OAuth a cada chamada | `gn-endpoints.js`, `gn-auth.js`, `gn-constants.js:9-10` |
| R11 | M | Devolução Pix não tratada (fatura paga e receita contada após estorno) | Ausência de tratamento de `devolucoes` |
| R12 | M | Sem webhook persistido / sem varredura Efí × local → divergências invisíveis | §7 |
| R13 | M | Resolver conciliação sem ator, sem ledger, sobrescrevendo mensagem, sem lock nem checagem de estado; fila global limitada a 100 itens sem paginação | `SaasFinanceController.ts:493-518` |
| R14 | M | Token Cobranças em cache de módulo sem invalidação; mistura credenciais se a fonte mudar em runtime | `efiCobrancasClient.ts:19-53` |
| R15 | M | P12 em claro no disco (`<storageKey>.p12`, sobrescrito a cada chamada) até a troca ou revogação; leitura concorrente do SDK pode pegar o arquivo meio escrito; `os.tmpdir()` como padrão | `efiCertificateStore.ts:107-164` |
| R16 | M | Chave de cifra única derivada por SHA-256 sem rotação/versão de chave; perda da env = perda das credenciais | `efiCredentialCrypto.ts:14-27` |
| R17 | M | Teste de conexão não valida Pix nem P12; `auth_validated` não garante Pix funcional | `PlatformEfiConfigAdminService.testEfiAdminAuth` |
| R18 | M | Duas regras de status divergentes: o resolvedor deriva `operational` de `activatedAt && lastAuthTestOk`, e o admin de `pixHomologated && adminEnabled`. Ao ligar o consumo, divergem de fato | `efiCredentialResolver.ts:59-96,140`, `PlatformEfiConfigAdminService.ts:45-66` |
| R19 | B | Resposta do checkout devolve o objeto inteiro da cobrança (inclui chave Pix da plataforma) | `SubscriptionController.ts:172-175` |
| R20 | B | Rate limit do teste em memória, por processo | `efiIntegrationStatus.ts` |
| R21 | B | `isSuper` responde 401 (não 403) — decisão pendente da 8.4 | `middleware/isSuper.ts` |
| R22 | A | Sem `app.set("trust proxy")`: atrás do nginx, `req.ip` é o IP do proxy. Allowlist de IP e rate limit por IP (propostos) não funcionariam | ausência em `backend/src` |
| R23 | M | `webhookSecret` digitado livremente, sem tamanho mínimo nem geração no servidor; é o único fator da rota pública | `PlatformEfiConfigAdminService.upsertEfiAdminConfig` |
| R24 | M | Mesma `EFI_CREDENTIAL_ENCRYPTION_KEY` em TESTE e PRODUÇÃO tornaria o slot de produção decifrável em TESTE (ex.: restore de backup) | `efiCredentialCrypto.ts:14-27` |
| R25 | M | Base de URL Cobranças segue `GERENCIANET_SANDBOX` mesmo se a credencial vier do banco → mistura sandbox/produção | `efiCobrancasClient.ts:13-17` |
| R26 | B | `postgres123` fixo em `docker-compose.yml:68` (dívida fora da B3) | `docker-compose.yml:68` |

---

## 9. Compatibilidade e segurança (E)

- **Clientes existentes:** a B3 não deve alterar `dueDate`, status ou faturas existentes. A troca de credencial só afeta
  novas cobranças **se** a mesma conta Efí/chave Pix for mantida.
- **Faturas já emitidas:** campos `externalTxid`, `gatewayProvider` (`efi`/`gerencianet`) e `SaaSPayments.externalTxid`
  precisam continuar válidos para idempotência. Não renomear nem migrar.
- **Cobranças Pix abertas:** expiram em 1 h; o risco real é o **webhook**. Se a conta Efí mudar, `pixDetailCharge` de
  um txid antigo falha com as novas credenciais (cobrança pertence à outra conta) → 500 em loop. Mitigação: registrar em
  cada tentativa qual configuração/ambiente a criou e, na transição, manter a conta.
- **Troca de credenciais:** o admin já invalida auth/ativação ao trocar segredo ou P12 (bom). Falta: efeito imediato em
  runtime, cache invalidado, e confirmação de que a chave Pix/webhook correspondem à conta nova.
- **Rollback:** hoje é trivial porque nada usa a config nova. A B3 deve preservar isso com seleção de fonte por flag
  (ver DECISOES D-P1).
- **Multiempresa:** checkout confere `companyId`; webhook acha a fatura por id vindo de cobrança da própria conta
  (`pixDetailCharge`) — o texto não é controlado pelo pagador. Credencial é global (da plataforma); não há vazamento
  entre empresas. Rotas de config são `isAuth + isSuper`.
- **Permissões:** Super Admin = `user.super === true || profile === "superadmin"` (`helpers/isInternalUser.ts`).
- **Dados sensíveis:** DTOs mascarados; P12 cifrado; mas ver R8 (secret em URL), R15 (P12 em claro no tmp), R16 (chave).
- **Dependências de migrations:** `20261013120000-saas-finance-foundation` (Invoices gateway fields, SaaSPayments,
  Attempts, Events, Renewals, ReconciliationItems), `20261015120000-platform-efi-configs`,
  `20261015140000-platform-efi-admin-flags`, e as da 8.4-F (`20261017120000`, `20261018120000`, `20261019120000`).
  Qualquer migration nova da B3 deve ser **aditiva** e depender destas.

## 10. Automação de bloqueios (F)

`BILLING_AUTOMATION_NORMALIZED_DATES` é lida em `billingEvaluation.ts:256-265` e `BillingAutomationJob.ts:27`;
ausente → modo `legacy`. A B3 **não** toca nessas leituras, nem no job horário, nem nas regras de inadimplência.
A renovação disparada por um webhook que passe a funcionar (R1 corrigido) **muda** `dueDate` de clientes que pagarem
Pix — comportamento esperado e já existente na 8.4, mas que hoje pode não estar acontecendo. Isso precisa ser comunicado
antes de ativar (ver DECISOES D-P11).

---

## 11. Lacunas identificadas

1. Nenhum consumidor da configuração do Super Admin (Pix, webhook, Cobranças, status).
2. Nenhum cliente Pix próprio com mTLS a partir do P12 do banco; SDK depende de path em disco e tem falhas (§6.4).
3. Nenhum critério nem ação para `pixHomologated`.
4. Nenhum reuso de cobrança ativa / txid determinístico.
5. Nenhuma persistência de webhooks recebidos e nenhum tratamento de Pix sem txid e de devoluções.
6. Nenhuma consulta administrativa de status de txid, nem reprocessamento seguro, nem varredura Efí × local.
7. Nenhuma tela global de conciliação; resolução sem trilha.
8. Registro de webhook acoplado ao checkout, em vez de ação administrativa explícita.
9. Documentação B1/B2 inexistente.

## 12. Recomendações técnicas (resumo — detalhes em PRD/ROADMAP/DECISOES)

1. **B3.1:** um único “provedor de credenciais Efí” com seleção de fonte por flag (`legacy_env` | `database`), default
   `legacy_env`; cliente Pix próprio (axios + `https.Agent({ pfx })` do P12 em memória, sem disco) com timeout; cache de
   token por `configId`+`updatedAt`, invalidado em toda escrita admin.
2. **B3.2:** txid gerado localmente por tentativa e `PUT /v2/cob/:txid`; repetição tratada com GET (**[A VERIFICAR]**).
   A tentativa é reservada em transação curta, com commit, e a Efí é chamada **fora** do lock. Reuso da cobrança ativa
   após conferir na Efí. Consulta administrativa de txid. Registro de webhook como ação do Super Admin.
3. **B3.3:** URL `…/subscription/webhook?hmac=<secret>&ignorar=` (compatível com a rota atual), comparação em tempo
   constante, allowlist de IP opcional, persistência de cada notificação, 200 para itens irrecuperáveis com item de
   conciliação, tratamento explícito de Pix sem txid / fatura cancelada / devolução, varredura periódica (flag OFF).
4. **B3.4:** homologação completa em TESTE com conta sandbox; promoção só com aprovação explícita.

## 13. Questões pendentes

Ver `DECISOES.md` §3 (D-P1 … D-P18). A matriz “decisão × etapa que bloqueia” está em `DECISOES.md` §4 e é a única fonte.

## 14. Revisão cruzada (2026-10-20)

Três revisores independentes, todos somente leitura:
1. Arquitetura Efí e credenciais.
2. Financeiro e idempotência.
3. Completude documental.

Achados incorporados neste documento e nos demais:

- **Correções de fato.**
  - O P12 é gravado em claro no disco pelo resolvedor (§4).
  - A validação do P12 é heurística (§4).
  - O certificado legado é copiado no build (§4).
  - O vazamento do secret ocorre via Sentry e nginx, não via `AppError` (§4, R8).
  - Na materialização o arquivo é sobrescrito, não multiplicado (R15).
  - A divergência entre as regras de status é média, não baixa (R18).
- **Riscos novos.**
  - Fatura cancelada com substituta do ciclo → 500 em loop; N receitas; renovação dupla (§6.3, R6).
  - Attempts sem txid único (§6.5).
  - Fila de conciliação truncada e resolução não atômica (R13).
  - R22 (`trust proxy`), R23 (entropia do secret), R24 (mesma chave de cifra), R25 (base Cobranças) e R26.
- **Desenho corrigido no PRD/ROADMAP.**
  - Nenhuma chamada Efí dentro de lock.
  - Tentativa reservada com commit próprio e recuperação de tentativa órfã.
  - `PUT /v2/cob/:txid` repetido marcado **[A VERIFICAR]**, com GET de fallback.
  - Dedupe do webhook só por resultado terminal, incluindo devolução.
  - Webhook responde rápido.
- **Coerência documental.**
  - Matriz única decisão×etapa.
  - IDs de teste realinhados por etapa.
  - Testes para RFs sem cobertura.
  - Cenários H novos.
  - Aplicação das correções ao `legacy_env` virou decisão explícita (D-P15).

Não verificado pelos revisores nem nesta auditoria:
- comportamento real da Efí para `PUT /v2/cob` repetido;
- suporte atual aos domínios `api-pix.gerencianet.com.br`;
- logs de produção que confirmem R1.

## 15. Decisões aprovadas (2026-10-20) — referência

Esta seção só aponta para as decisões. **Os fatos, as evidências e os riscos das §1–§14 continuam como foram
registrados** e não foram reescritos.

- D-P1…D-P17 aprovadas na alternativa A, com ajustes. D-P18 aprovada na alternativa **B** (webhook assíncrono, com
  persistência durável no PostgreSQL antes do HTTP 200). Detalhes, condições e histórico em `DECISOES.md` §3.
- As referências desta auditoria a “questões pendentes” (§13) e às recomendações (§12) devem ser lidas à luz de
  `DECISOES.md` §3–§8:
  - **§12.3:** o termo “HMAC” foi substituído por “token secreto de autenticação” (D-P3).
  - **§12.3:** o tratamento síncrono foi substituído pelo pipeline assíncrono (D-P18).
  - **§12.2:** o formato da URL depende da validação do contrato Efí (PT-2).
- Fatos novos registrados na consolidação, sem alterar as seções anteriores:
  - **F15:** a fila instalada é Bull 4, não BullMQ (PT-1 resolvida em 2026-10-20: usar Bull 4);
  - **F16:** os agendamentos usam `node-cron`.
- Contradições e pendências técnicas: `DECISOES.md` §5 (PT-1…PT-12; PT-1 resolvida), §6 (SF-1…SF-3, aprovadas) e §7 (C1…C7).
  Fechamento do planejamento: `DECISOES.md` §9.
- Como cada risco é tratado:

| Risco | Tratamento aprovado |
|-------|---------------------|
| R1 | D-P3, D-P16, PT-2, C4 |
| R2 | D-P1, D-P2, D-P17 |
| R3 | D-P4 |
| R4, R5 | D-P18 + R-8 |
| R6 | D-P6 + SF-1 + SF-2 |
| R7 | R-10 + C3 |
| R8 | D-P3, R-17 |
| R9 | D-P1/RF1.2 |
| R10 | D-P12 |
| R11 | D-P7 |
| R12 | D-P9/D-P18 |
| R13 | R-11 |
| R14 | R-3 |
| R15 | D-P12 |
| R16 | D-P13 |
| R17 | R-19 |
| R18 | B3.1 tarefa 3 |
| R22 | R-16 |
| R23 | R-18 |
| R24 | R-21 |
| R25 | R-20 |

  R19, R20, R21 e R26 seguem como dívida ou decisão herdada.
