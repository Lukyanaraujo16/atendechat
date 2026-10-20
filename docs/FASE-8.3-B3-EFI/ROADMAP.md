# Fase 8.3-B3 — Roadmap

Quatro etapas sequenciais. Cada etapa só começa após a aprovação explícita da anterior.
Validação local antes de TESTE; nada vai para PRODUÇÃO sem aprovação explícita; a VPS de PRODUÇÃO não é ambiente de
desenvolvimento. Referências: `AUDITORIA.md` (R*), `DECISOES.md` (D-P*, R-*, PT-*, SF-*, C*), `PRD.md` (RF*), `TESTES.md` (T-*).

| Etapa | Nome | Estado |
|-------|------|--------|
| B3.1 | Integração de credenciais | **IMPLEMENTADA + fechamento técnico — aguardando aprovação final** (2026-10-20) |
| B3.2 | Geração e consulta de cobranças Pix | **NÃO INICIADO** |
| B3.3 | Webhooks assíncronos, confirmação e conciliação | **NÃO INICIADO** |
| B3.4 | Testes e homologação completa | **NÃO INICIADO** |

## Regras transversais (aprovadas — DECISOES §8)

- **Implementar não significa ativar.** Concluir uma etapa entrega código com **todos os controles no default**
  (comportamento atual). Nenhuma etapa autoriza alterar o fluxo financeiro ativo.
- Controles: `EFI_CREDENTIALS_SOURCE`, `EFI_PIX_CHARGE_V2_ENABLED`, `EFI_WEBHOOK_PIPELINE`, `EFI_WEBHOOK_WORKER_PAUSED`,
  `EFI_PIX_RECONCILIATION_SWEEP_ENABLED`, `TRUST_PROXY_HOPS`.
  - Em TESTE, a ativação ocorre só na B3.4, ou pontualmente para validar uma PT-*, com registro.
  - Em PRODUÇÃO, só após HOMOLOGACAO §9 e aprovação explícita, **um controle por vez**.
- Compatibilidade com as cobranças abertas e identificação da fonte de credenciais de cada cobrança (R-13).
- Nada de duplicidade financeira, renovação indevida ou descarte de notificações.
- `BILLING_AUTOMATION_NORMALIZED_DATES` não é lida, escrita nem documentada como ativável. Sem mudança em bloqueio automático.
- Sem commit/push/deploy pelo agente; a entrega de cada etapa traz diff, testes e relatório.
- Toda etapa roda T-ACT-01 (controles no default = comportamento atual) e a regressão 8.4 (T-REG-01/02).

---

## B3.1 — Integração de credenciais

**Estado:** IMPLEMENTADA localmente em 2026-10-20; fechamento técnico concluído no mesmo dia (P-B31-01, 03, 08). Aguardando aprovação final. Sem commit, push ou deploy.
Controles no default; nenhum fluxo financeiro trocado. Progresso por tarefa em “Progresso B3.1” abaixo.

**Objetivo:** provedor único de credenciais, cliente Pix próprio com mTLS em memória e separação entre configuração
válida e integração homologada (fingerprint e bloqueio de produção). Nenhum fluxo financeiro é trocado.

**Pré-requisitos:** documentação aprovada; PT-4 (contratos/bases Pix na documentação oficial) e PT-9 (origem do commit
em runtime) resolvidos na tarefa 0.

**Arquivos/módulos previstos:**
- novo `backend/src/services/SaasBilling/efiRuntimeCredentials.ts` (seleção de fonte, cache por `configId+updatedAt`)
- novo `backend/src/services/SaasBilling/efiPixClient.ts` (axios + `https.Agent({ pfx })`, OAuth, timeouts, erros tipados)
- novo `backend/src/services/SaasBilling/efiConfigFingerprint.ts`
- `backend/src/config/saasBillingFlags.ts` (leitura de todos os controles de DECISOES §8.2, com defaults)
- `backend/src/services/SaasBilling/efiCredentialResolver.ts` (regra D-P2; status unificado)
- `backend/src/services/SaasBilling/PlatformEfiConfigAdminService.ts` (invalidar cache; validar P12 e OAuth Pix; secret mínimo)
- `backend/src/services/SaasBilling/efiIntegrationStatus.ts` + `controllers/EfiIntegrationController.ts`
- `backend/src/services/SaasBilling/efiCobrancasClient.ts` (token por credencial; base pelo slot)
- `backend/.env.example` (documentar os controles, todos no default)
- testes em `services/SaasBilling/__tests__/`

**Tarefas:**
0. Confirmar na documentação oficial as bases Pix, o endpoint OAuth e os escopos (PT-4), e definir a origem do commit em
   runtime (PT-9). Registrar no relatório.
1. Leitura centralizada dos controles (RF0), com log de boot e exposição no status. *Aceite:* T-ACT-01, T-ACT-02.
2. Provedor `getEfiRuntimeCredentials()`, com o mesmo formato para as duas fontes. *Aceite:* T-CRED-01…10.
3. Status unificado (R18): uma função usada pelo admin e pelo resolvedor, sem mudar os status persistidos. Remover a
   exigência cega de `operational` em `efiCredentialResolver.ts:140`. *Aceite:* teste de tabela com todas as
   combinações → mesmo status nas duas pontas (T-CRED-16).
4. `configFingerprint` e as regras D-P2: TESTE opera com configuração válida; PRODUÇÃO exige registro de homologação
   correspondente. Esse registro só pode existir após a B3.3, por isso a fonte `database` fica **inutilizável em
   produção** até lá, por construção. *Aceite:* T-HOM-01, T-HOM-02.
5. Cliente Pix próprio: base pelo slot, mTLS com P12 em Buffer, OAuth com cache e invalidação, timeouts, sanitização.
   Sem gravação de certificado. *Aceite:* T-CERT-01, T-NET-01, 02, 09.
6. Teste de conexão Pix (OAuth com mTLS, sem cobrança) + validação do P12 com `tls.createSecureContext`, no teste e na
   ativação. Resultado separado do de Cobranças. *Aceite:* T-CRED-12.
7. Webhook secret com mínimo de 32 caracteres ou gerado no servidor. *Aceite:* T-CRED-14.
8. `efiCobrancasClient`: cache por credencial; base pelo slot na fonte `database`. *Aceite:* T-CRED-09, 13.
9. Status/diagnóstico: fonte, prontidão, fingerprint, homologação. *Aceite:* T-ENV-06.

**Dependências:** nenhuma etapa anterior.

**Testes obrigatórios:** T-ACT-01, 02 · T-CRED-01…04, 06…10, 12…16 · T-HOM-01, 02 · T-CERT-01…04, 06 · T-ENV-01…06 ·
T-NET-01, 02, 09 · T-SEC-01…04, 13 · T-REG-01, 02. (T-CERT-05 → B3.4.)

**Critérios de aceite:**
- Com os controles no default, as respostas de checkout e webhook são idênticas às atuais (T-ACT-01).
- Com `database` em teste local (mock HTTP), o provedor devolve credenciais do slot certo; slot ou ambiente errado → erro.
- Slot `production` com a fonte `database` é bloqueado sem homologação (T-HOM-02).
- Nenhum P12 gravado em disco no caminho `database` (T-CERT-01).
- Cache invalidado por cada ação admin; nenhum segredo em log, DTO ou auditoria.

**Riscos:** confusão de ambiente (R9); P12 com senha (o SDK usa senha vazia), a documentar; regressão no painel B2.

**Condições para avançar:** relatório B3.1 aprovado; suíte local verde; PT-4 e PT-9 registrados.

### Progresso B3.1 (2026-10-20)

| # | Tarefa | Estado | Onde |
|---|--------|--------|------|
| 0 | PT-4 e PT-9 | concluída | DECISOES §5 (PT-4, PT-9 resolvidas) |
| 1 | Controles RF0 + log de boot + status | concluída | `config/saasBillingFlags.ts` (`getEfiActivationControls`), `logEfiActivationControlsAtBoot` em `server.ts` |
| 2 | Provedor `getEfiRuntimeCredentials()` | concluída (não ligado a checkout/webhook) | `efiRuntimeCredentials.ts` |
| 3 | Status unificado | concluída | `derivePlatformEfiConfigStatus` em `efiCredentialResolver.ts` |
| 4 | Fingerprint + D-P2 | concluída | `efiConfigFingerprint.ts`, `findEfiHomologationForConfig` |
| 5 | Cliente Pix próprio | concluída | `efiPixClient.ts`; gravação de P12 removida de `efiCertificateStore.ts` |
| 6 | Teste de conexão Pix + validação P12 | concluída | `testEfiPixOAuth`; `testEfiAdminAuth` e `activateEfiAdminConfig` |
| 7 | Webhook secret ≥ 32 | concluída (sem geração no servidor) | `PlatformEfiConfigAdminService.ts` |
| 8 | `efiCobrancasClient` | concluída | cache por credencial; base pelo slot no `database` |
| 9 | Status/diagnóstico | concluída | `credentialsSource` em `efiIntegrationStatus.ts` |

**Fechamento técnico (2026-10-20):**
- P-B31-08: fonte `database` isolada do financeiro real (checkout, webhook, settle/boleto seguem `legacy_env`) — B31-T17.
- P-B31-01: versão por `dist/build-info.json` gerado no `npm run build` — B31-T15. Docker sem `.git` fica `null` (ajuste opcional de infraestrutura, para aprovação).
- P-B31-03: configuração só é válida com validação Pix registrada para o fingerprint atual — B31-T16.
- Testes parciais completados ou justificados (TESTES §Registro B3.1 — fechamento).

Decisões de implementação: DECISOES §10. Pendências: DECISOES §10.1 (P-B31-01…09). Resultados: TESTES §Registro B3.1.
Itens da lista de testes obrigatórios sem cobertura completa estão marcados como parciais ou não executados em TESTES.

---

## B3.2 — Geração e consulta de cobranças Pix

**Estado:** NÃO INICIADO

**Objetivo:** com `EFI_PIX_CHARGE_V2_ENABLED=true`, o checkout cria ou reusa uma única cobrança por fatura, com txid
local e sem chamada Efí sob lock. A etapa também entrega a consulta administrativa por txid e o cadastro de webhook pelo
Super Admin. Com o controle em `false`, o checkout é o atual.

**Pré-requisitos:** B3.1 aprovada; PT-2, PT-3 e PT-5 validados em sandbox (tarefa 0, com ativação pontual registrada em TESTE).

**Arquivos/módulos previstos:**
- `backend/src/controllers/SubscriptionController.ts` (`createSubscription` com bifurcação pelo controle; `createWebhook`)
- novo `backend/src/services/SaasBilling/createOrReusePixCharge.ts`
- `backend/src/models/SaaSPaymentAttempt.ts` + migration aditiva (índice único parcial em `externalTxid`; fonte, `configId`, slot, ambiente, commit e `expiresAt` em `payloadSummary`)
- `backend/src/routes/saasFinanceRoutes.ts` (consulta txid, cadastro e consulta de webhook)
- extensão de `EfiConfigAdminController.ts`
- `frontend/src/pages/Platform/EfiIntegrationPanel.js` (webhook cadastrado, consulta txid)
- `frontend/src/components/CheckoutPage/CheckoutPage.js` (sem mudança de contrato)

**Tarefas:**
0. Em sandbox (TESTE, ativação pontual registrada), validar:
   - o `PUT /v2/cob/:txid` repetido (PT-3);
   - o path e a query reais do webhook com o sufixo `/pix`, se `ignorar=` funciona e o nome do parâmetro do token (PT-2/PT-5).

   O formato da URL só é fixado depois dessa validação.
1. txid local, um por tentativa (R-4). `PUT /v2/cob/:txid` pelo cliente próprio (`database`) ou pelo SDK
   `pixCreateCharge` (`legacy_env`). Conflito ou repetição → GET + comparação. *Aceite:* T-CHG-07, 17; T-IDEM-02.
2. Fluxo de três passos (RF2.2) e recuperação de tentativa órfã. *Aceite:* T-CHG-13, 14, 15; T-IDEM-01.
3. Reuso conferido na Efí; `expiresAt`; cobrança legada expira 1 h após a criação. *Aceite:* T-CHG-02, 03; T-IDEM-04.
4. `solicitacaoPagador = "#Fatura:<id>"` mantido (RF2.4a). *Aceite:* T-RB-02.
5. Com v2, remover `pixConfigWebhook` do checkout. *Aceite:* T-CHG-08, T-ACT-04.
6. Endpoints Super Admin: consultar txid e consultar/cadastrar webhook (auditado). O cadastro é recusado com v2
   desligado (C3). Nesta etapa, só o formato atual da URL (`token`); o formato novo depende do pipeline `async` (B3.3,
   T-ACT-08). *Aceite:* T-CHG-10, 12; T-ACT-05; T-SEC-08.
7. Resposta enxuta no checkout v2. *Aceite:* T-CHG-09 + checkout do frontend sem regressão.
8. Migration aditiva. *Aceite:* T-MIG-01, 02; T-CHG-11, 16.

**Dependências:** B3.1 (provedor e cliente).

**Testes obrigatórios:** T-ACT-01, 03, 04, 05 · T-CHG-01…17 · T-IDEM-01, 02, 04 · T-NET-03, 04 · T-MT-01…03 ·
T-SEC-08, 13 · T-MIG-01, 02 · T-RB-02 · T-REG-01…03. (T-IDEM-03 → B3.4.)

**Critérios de aceite:**
- Com v2 desligado, o checkout é idêntico ao atual (T-ACT-01/04).
- Com v2:
  - 2 checkouts concorrentes → 1 cobrança;
  - o retry da mesma tentativa recupera o txid;
  - nenhuma chamada Efí com lock aberto;
  - nenhuma cobrança sem tentativa;
  - fatura de outra empresa → 403.
- O cadastro admin do webhook é auditado, não expõe o secret e fica indisponível com v2 desligado.

**Riscos:** txid recusado pela Efí; comportamento do PUT diferente do esperado (PT-3); cobranças legadas abertas sem
`expiresAt`; o cadastro de webhook em TESTE afeta só a conta sandbox.

**Condições para avançar:** relatório B3.2 aprovado; PT-2, PT-3 e PT-5 registrados com evidência.

---

## B3.3 — Webhooks assíncronos, confirmação e conciliação

**Estado:** NÃO INICIADO

**Objetivo:** com `EFI_WEBHOOK_PIPELINE=async`, entregar:
- recepção durável no PostgreSQL antes do 200;
- processamento por fila/worker com claim atômico;
- retentativas, recuperação e reprocessamento auditado;
- casos D-P6/D-P7/D-P8;
- conciliação auditada;
- registro de homologação.

Com `legacy`, o webhook é o atual (C4).

**Pré-requisitos:** B3.2 aprovada; resolvidos: PT-6 (mTLS), PT-8 (dedupe de `jobId` no Bull 4) e PT-10 (retenção).
Já decididos em 2026-10-20: PT-1 (Bull 4), SF-1, SF-2 e SF-3.

**Arquivos/módulos previstos:**
- `backend/src/controllers/SubscriptionController.ts` (`webhook` com bifurcação pelo controle; recepção nova)
- novo model + migration aditiva `SaaSGatewayWebhookEvents` (índice único em `eventKey`; índices por status/`nextAttemptAt`, txid e empresa)
- novo `backend/src/services/SaasBilling/webhookReception.ts` (autenticação, validação, persistência, publicação)
- novo `backend/src/services/SaasBilling/processGatewayWebhookEvent.ts` (claim, consulta, classificação, confirmação, resultado)
- novo `backend/src/libs/gatewayWebhookQueue.ts` (Bull 4, já instalado; PT-1) e registro do processador em `backend/src/queues.ts`
- novo job `node-cron` de recuperação em `backend/src/jobs/billingAutomationScheduler.ts` (ou arquivo irmão)
- `backend/src/services/SaasBilling/confirmGatewayPayment.ts` — **só** o ramo de fatura cancelada (D-P6, SF-1, SF-2), ativado por parâmetro explícito usado apenas pelo pipeline `async`
- `backend/src/controllers/SaasFinanceController.ts` (resolução auditada, fila paginada, reprocessar, converter `unlinked`)
- novo `backend/src/services/SaasBilling/pixReconciliationSweep.ts`
- ação `homologate` em `PlatformEfiConfigAdminService.ts` (D-P17)
- `backend/src/app.ts` (Sentry `beforeSend`, `TRUST_PROXY_HOPS`, sanitização de log da rota)
- frontend: telas de eventos, conciliação global e homologação

**Tarefas:**
1. Autenticação v2 (token novo + `token`, tolerância ao `/pix`, `timingSafeEqual`), só com `async`. Corpo sem estrutura
   → 400; item inválido no lote → `invalid_permanent`. Cadastro admin do formato novo da URL liberado só com `async`.
   *Aceite:* T-WH-01…05, 16, 19, 20; T-ACT-06, 08.
2. Recepção durável: transação única por lote, `ON CONFLICT (eventKey) DO NOTHING`, 200 só após o commit, 503 em falha,
   payload mínimo. *Aceite:* T-ASY-01…03, 09, 19…21.
3. Publicação pós-commit, independente do Redis. *Aceite:* T-ASY-04, 05.
4. Worker: claim atômico, consulta com as credenciais da fonte de origem, classificação RF3.10,
   `confirmGatewayPayment` e registro do resultado. *Aceite:* T-ASY-08, 10, 11, 22…31; T-WH-06…12, 15.
5. Retentativas e estados terminais. *Aceite:* T-ASY-12…14.
6. Recuperação (cron): pendentes, locks antigos, jobs × eventos. *Aceite:* T-ASY-06, 07, 15, 16.
7. Pausa do worker (R-33). *Aceite:* T-ASY-17; T-RB-03.
8. D-P6 com SF-1 e SF-2: recebimento idempotente, fora da receita consolidada até a conciliação, fatura `cancelled`,
   sem renovação, conciliação; com substituta, conciliação manual sem aplicação automática. *Aceite:* T-ASY-29;
   T-DUP-06…08; T-REN-05.
9. D-P7, D-P8 e SF-3 (Pix de pagamento devolvido: evidência + conciliação, sem renovação nem estorno). *Aceite:* T-WH-11, 12; T-ASY-26; T-REC-10.
10. Reprocessamento manual e conversão de `unlinked`, auditados. *Aceite:* T-ASY-18; T-REC-03, 10.
11. Conciliação auditada e paginada. *Aceite:* T-REC-01, 02, 07…09.
12. Varredura manual atrás de flag. *Aceite:* T-REC-04…06.
13. Ação `homologate` (D-P17), em TESTE e PRODUÇÃO. *Aceite:* T-HOM-03…05.
14. Sentry, logs e `TRUST_PROXY_HOPS`. *Aceite:* T-SEC-05, 06, 10…12.
15. Telas: eventos (filtros, detalhe, reprocessar, indicadores), conciliação global e homologação. *Aceite:* T-UI-01…03.

**Dependências:** B3.1 (credenciais, secret, fingerprint) e B3.2 (txid local, vínculo forte, fonte da cobrança).

**Testes obrigatórios:** T-ACT-01, 03, 06…08 · T-ASY-01…31 · T-WH-01…20 · T-DUP-01…08 · T-ORD-01…04 · T-NET-05…08 ·
T-REN-01…06 · T-REC-01…10 · T-MT-04…07 · T-HOM-03…05 · T-SEC-05…07, 09…13 · T-MIG-01, 02 · T-RB-01, 03…05 · T-REG-01…06.

**Critérios de aceite:**
- Com `legacy`, o webhook é idêntico ao atual (T-ACT-06).
- Com `async`:
  - nenhum 200 sem a linha persistida (T-ASY-01…03);
  - Redis fora → 200 e processamento posterior (T-ASY-04…06);
  - reinício do worker sem perda nem duplicidade (T-ASY-07, 08);
  - concorrência entre workers → uma única execução (T-ASY-10, 11);
  - nenhuma renovação duplicada (T-ASY-30);
  - toda linha de RF3.10 coberta por teste;
  - fatura cancelada conforme D-P6/SF-1/SF-2; Pix após devolução conforme SF-3.
- O Super Admin vê os eventos pendentes, falhos e sem vínculo e os reprocessa com auditoria.
- A homologação em PRODUÇÃO não exige pagamento real (T-HOM-04).
- Nenhum segredo ou dado do pagador em logs, Sentry ou eventos.

**Riscos:**
- reenvios represados da Efí (D-P11);
- acúmulo de eventos com o worker pausado e sem monitoramento;
- dedupe de `jobId` no Bull 4 (PT-8);
- mudança D-P6 sobre a 8.4 D11;
- migration nova em produção (aditiva, mas exige aprovação);
- volume de Pix sem txid.

**Condições para avançar:** relatório B3.3 aprovado; suíte local verde; D-P11 planejada.

---

## B3.4 — Testes e homologação completa

**Estado:** NÃO INICIADO

**Objetivo:** executar `TESTES.md` e `HOMOLOGACAO.md` na VPS de TESTE com conta sandbox, ativando os controles **em
TESTE**, um a um. Produzir as evidências e o registro `homologate` do slot `homologation` para a decisão de promoção.

**Pré-requisitos:** B3.1–B3.3 aprovadas; VPS de TESTE com backup recente; conta Efí sandbox; aprovação para deploy em TESTE.

**Arquivos/módulos previstos:** nenhum código novo. Só correções de defeitos encontrados, cada uma voltando à etapa de
origem com aprovação. Relatório `docs/FASE-8.3-B3-EFI/RELATORIO-HOMOLOGACAO.md`.

**Tarefas:**
1. Deploy em TESTE com todos os controles no default (HOMOLOGACAO §7).
2. Configurar o slot `homologation`; testar Cobranças e Pix (mTLS).
3. Ativar os controles em TESTE na ordem de HOMOLOGACAO §4, conferindo cada um.
4. Cenários H-01…H-36, com evidências.
5. Ensaios de falha: Redis indisponível, reinício do worker, eventos pendentes, pausa do worker.
6. Ensaio de rollback de cada controle, com cobranças abertas.
7. Registro `homologate` no slot `homologation` (D-P17).
8. Relatório com aprovado/reprovado por cenário e o commit homologado.

**Dependências:** todas as anteriores.

**Testes obrigatórios:** toda a matriz `TESTES.md` (incluindo T-CERT-05, T-IDEM-03, T-UI-01…03) + H-01…H-36.

**Critérios de aceite:** HOMOLOGACAO §6; zero divergência financeira não explicada; rollback ensaiado; nenhum evento
perdido nos ensaios de falha.

**Riscos:** sandbox Efí instável; webhook de sandbox exige `BACKEND_URL` público; tentação de “testar em produção”
(proibido); dados de TESTE contaminados.

**Condições para avançar (promoção):** HOMOLOGACAO §9 — aprovação explícita por escrito, plano candidato C7 validado no H-36 e aprovado,
tratamento do PT-12, ativação em produção **um controle por vez** e D-P11 executada.
