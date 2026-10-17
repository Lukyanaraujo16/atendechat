# Fase 8.4 — Testes

## Integração (Agente 4 — QA)

Testes contra **Postgres real isolado** (container descartável `atendechat-f84-testdb`, 127.0.0.1:55499).
Motivo: os testes unitários mockam os models e não pegaram o incidente P0 (`Companies.dueDate` é `timestamptz` →
chega como `Date` → `SaaSSubscriptionRenewals.previousDueDate` STRING → `SequelizeValidationError` → HTTP 500).

### Como rodar

```bash
scripts/test-integration-f84.sh                 # suíte completa
scripts/test-integration-f84.sh -t "Baixa manual"   # filtro do jest
KEEP_DB=1 scripts/test-integration-f84.sh       # mantém o database para inspeção
```

O script:
1. cria um database próprio `f84_it_<timestamp>_<pid>` no container (nunca usa `atendechat_f84`/`f84_agent*`);
2. compila **apenas** config + migrations para `backend/dist-it` (não toca em `backend/dist`);
3. roda `sequelize db:migrate` com até 5 tentativas (ver "Limitações");
4. roda `npx jest -c jest.integration.config.js --runInBand`;
5. `dropdb` + remoção de `dist-it` no `trap` (inclusive em falha/Ctrl+C).

Variáveis definidas pelo script (somente teste): `DB_*`, `NODE_ENV=test`, `JWT_SECRET`/`JWT_REFRESH_SECRET` de teste,
flags Efí seguras (`EFI_COBRANCAS_SETTLE_ENABLED=false`, `GERENCIANET_SANDBOX=true`). Nenhum `.env.test` é criado.
O SDK `gn-api-sdk-typescript` é mockado com `jest.mock` — nenhuma chamada real à Efí.

Arquivos:
- `backend/jest.integration.config.js` — `testMatch: **/__integration__/**/*.it.spec.ts`, ts-jest, sem coverage.
  A config de unidade (`jest.config.js`, `**/__tests__/**/*.spec.ts`) **não** encontra esses arquivos (verificado com `--listTests`).
- `backend/src/__integration__/helpers/fixtures.ts` — fixtures (empresa recarregada do banco → `dueDate` é `Date`),
  guarda `assertDisposableDatabase()` (aborta se o database não começar com `f84_it_`).
- `backend/src/__integration__/helpers/miniApp.ts` — Express mínimo com routers reais e `isAuth`/`isSuper` reais
  (o `app.ts` completo importa Bull/Redis, Sentry e webhooks externos).
- `smoke.it.spec.ts`, `renewal.it.spec.ts`, `manualPayment.it.spec.ts`, `gatewayPayment.it.spec.ts`, `httpPermissions.it.spec.ts`.

### Cenários

| Arquivo | Cenário |
|---|---|
| smoke | conecta no DB descartável; `Companies.dueDate` é `timestamp with time zone` |
| renewal | pré-condição: `dueDate` lido do banco é `Date` |
| renewal | MENSAL/TRIMESTRAL/SEMESTRAL/ANUAL × (dueDate futuro `Date` → venc.+período; dueDate null → hoje+período); `previousDueDate` `YYYY-MM-DD` |
| renewal | empresa bloqueada e vencida → `status=true`, vencimento futuro, `autoUnblocked=true` |
| renewal | motor direto `manual_renew` e `due_date_adjustment` com `Date` |
| renewal | sem justificativa → `ERR_RENEWAL_REASON_REQUIRED` sem gravação |
| renewal | duplicada sequencial e **simultânea** (Promise.all) com o mesmo `expectedCurrentDueDate` → 1 extensão, `409 ERR_RENEWAL_STALE`; `expected=null` com vencimento existente → STALE |
| manualPayment | vencida+bloqueada → pagamento, fatura `paid`, ledger (`manual_payment_recorded`, `renewal_payment_confirmed`), renovação, desbloqueio |
| manualPayment | valor menor/maior → `ERR_PAYMENT_AMOUNT_INSUFFICIENT`/`EXCEEDS` sem estado parcial |
| manualPayment | repetição → `409 ERR_INVOICE_NOT_OPEN`, sem 2ª renovação |
| manualPayment | cortesia → `countsAsRevenue=false`, `paymentSource=courtesy` |
| manualPayment | concorrência (Promise.all) → exatamente 1 pagamento e 1 renovação |
| manualPayment | recorrência `SEMANAL` → `ERR_INVALID_RECURRENCE` com rollback total (sem pagamento/ledger, fatura `open`, empresa bloqueada) |
| manualPayment | invoiceId de outra empresa → `404 ERR_INVOICE_NOT_FOUND` sem efeitos |
| manualPayment | período já coberto → `renewalSkippedReason=period_already_covered`, sem renovação |
| gateway | `confirmGatewayPayment` repetido e simultâneo com o mesmo txid → 1 pagamento / 1 renovação |
| gateway | baixa manual seguida de confirmação gateway → não renova de novo |
| gateway | `POST /subscription/webhook` (Efí mockada) → 200, renova; reenvio não renova de novo |
| gateway | falha de processamento no webhook → `500 ERR_WEBHOOK_PROCESSING_FAILED` com rollback; valor divergente → 200 sem baixa |
| http | usuário comum e admin de tenant: recusados em `POST /companies/:id/renew`, `manual-payment`, `summary`, `renewal-preview`, todas as rotas `/saas/companies/:id/users` — sem efeitos |
| http | idem, exigindo **403** (contrato da tarefa) |
| http | sem token → 401; Super Admin: summary 200, renewal-preview (contrato), manual-payment cruzado 404, campos ausentes → 400, renew 200 + 409 STALE, renew sem justificativa 400, manual-payment 201 (contrato de resposta) + 409, adjust-due-date 200 |

### Resultados reais (2026-10-17)

**Linha de base (código do commit `17c221a`, antes das correções da fase)** — mesmos testes rodados num snapshot
`git archive HEAD` contra DB descartável migrado: **23 falharam / 10 passaram** (suíte HTTP não carregou:
`saasCompanyUsersRoutes` ainda não existia). Erro reproduzido 22 vezes:
`SequelizeValidationError: string violation: previousDueDate cannot be an array or an object` — renovação administrativa
(todas as recorrências), ajuste de vencimento, baixa manual, cortesia, `confirmGatewayPayment` e webhook Pix.

**Árvore de trabalho atual (correções do líder/agentes)** — `scripts/test-integration-f84.sh`:
`Test Suites: 1 failed, 4 passed` — `Tests: 3 failed, 43 passed, 46 total`. Falhas restantes:

1. `manual-payment sem campos obrigatórios → 400` — recebe **500**: `SaasFinanceController.manualPayment` usa
   `await schema.validate(req.body)` (linha ~265) em vez de `validateOr400`; o `ValidationError` do Yup vira 500.
2. e 3. `recusa com 403` (usuário comum / admin de tenant) — `isSuper` responde **401** "Acesso não permitido"
   (`backend/src/middleware/isSuper.ts:12-15`). Ver observação no relatório: no frontend, 401 dispara logout imediato e
   403 dispara refresh+retry e, se repetir, também logout.

### Limitações

- Migration legada `20231220192536-add-unique-constraint-to-Tickets-table` usa operador vírgula
  (`removeConstraint`/`addConstraint` sem `await`) e falha intermitentemente em banco novo
  (`relation "contactid_companyid_unique" already exists`); o script repete o `db:migrate` (continua de onde parou).
- Em banco migrado do zero, `UserNotifications.companyId` permanece `NOT NULL` (o `changeColumn` da migration
  `20260424100000-notification-center-phase6` não remove o NOT NULL no Sequelize 5/Postgres), então as notificações de
  cobrança para Super Admin (`companyId: null`) falham e são apenas logadas (`[UserNotification] … violates not-null`).
  Não afeta a renovação (pós-commit, com try/catch).
- O app HTTP é mínimo (routers reais + isAuth/isSuper reais); middlewares globais do `app.ts` (CORS, Sentry,
  `agentOsSecurityHeaders`) não são exercitados.
- Máquina compartilhada: tempos de execução variam muito (até minutos por suíte com outros `tsc` rodando).

## Consolidação final (Líder — 2026-10-17)

Todos os resultados abaixo foram executados de fato nesta máquina; nada foi simulado.

| Verificação | Comando | Resultado |
|---|---|---|
| TypeScript backend | `cd backend && npx tsc --noEmit -p .` | exit 0 |
| Build backend | `cd backend && npm run build` | exit 0 (migration nova compilada em `dist/`) |
| Unitários backend (áreas tocadas) | `NODE_ENV=test npx jest --coverage=false --bail=0 src/services/SaasBilling src/services/SaasCompanyUsers src/helpers src/services/CompanyService` | 45/45 suítes, 320/320 testes |
| Integração (Postgres real isolado) | `scripts/test-integration-f84.sh` | 44/46 — as 2 falhas são a decisão pendente 401×403 do `isSuper` (acesso é negado; muda só o código HTTP) |
| Integração contra o código anterior (`17c221a`) | snapshot `git archive` (Agente 4) | 23 falhas, 22 delas `string violation: previousDueDate cannot be an array or an object` — reproduz o incidente |
| Reprodução manual do P0 | script no scratchpad, banco `atendechat_f84` | antes: `SequelizeValidationError`; depois: renovação OK, `previousDueDate=2026-09-10`, `newDueDate=2026-11-10`, `status=true` |
| Testes frontend (áreas tocadas) | `CI=true npx react-scripts test --watchAll=false src/components/CompanyFinanceSection src/components/CompaniesManager src/pages/Platform/CompanyDetail src/helpers/__tests__` | 7/7 suítes, 39/39 testes |
| Build frontend | `cd frontend && npm run build` | exit 0; "Compiled with warnings" apenas em arquivos não tocados nesta fase |
| ESLint frontend (arquivos novos/alterados) | executado pelos Agentes 3 e 5 | 0 erros/avisos |

Não executado:
- Suíte unitária completa do backend: a execução de baseline travou ~2 h em suítes fora de escopo (handles abertos) e foi
  encerrada; a suíte `AiAgentService/__tests__/aiAgentNaturalResponsePacing.spec.ts` já falhava antes da fase.
- Validação visual no navegador: o app completo exige Redis/filas/sessões; a UI foi validada por testes de componente e build.
  **Homologação visual em TESTE é obrigatória** (ver HOMOLOGACAO.md).
- `npm test` não foi usado (pretest/posttest fazem migrate e `db:migrate:undo:all`).

## Fechamento técnico (2026-10-17) — resultado final

Após a decisão de manter o 401 do `isSuper` (DECISOES.md D14), os 2 testes de permissão passaram a exigir
exatamente `401` com `error: "Acesso não permitido"` — mais estrito que antes (distingue de sessão expirada), e a
verificação de ausência de efeitos colaterais foi mantida.

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit -p .` (backend) | exit 0 |
| `npm run build` (backend) | exit 0; `dist/server.js` e a migration `20261017120000` presentes |
| Unitários backend (SaasBilling, SaasCompanyUsers, helpers, CompanyService) | 45/45 suítes, 320/320 testes |
| Integração em Postgres isolado (`scripts/test-integration-f84.sh`) | **5/5 suítes, 46/46 testes**; database temporário removido |
| Testes frontend (áreas tocadas) | 7/7 suítes, 39/39 testes |
| `npm run build` (frontend) | exit 0; avisos apenas em arquivos não tocados nesta fase |

Nenhum teste foi desabilitado; nenhum banco compartilhado foi usado; `npm test` não foi executado.

## Integração 8.4-F (Agente QA)

Mesmo harness (`scripts/test-integration-f84.sh`, `--runInBand`, database descartável `f84_it_*` no container
`atendechat-f84-testdb`, todas as migrations — inclusive `20261018120000-saas-historical-review` —, SDK Efí sempre
mockado). Os routers novos (`saasSubscriptionRoutes`, `saasHistoricalReviewRoutes`, `billingSimulationRoutes`) são
montados direto no app mínimo; ainda não dependem de `routes/index.ts`. Módulos ausentes falham com
`FUNCIONALIDADE INEXISTENTE: <módulo>` (helper `helpers/f84f.ts`), sem derrubar as outras suítes.

Arquivos novos: `backend/src/__integration__/historicalReview.it.spec.ts` (18), `subscriptionCenter.it.spec.ts` (19),
`billingSimulation.it.spec.ts` (4), `permissions84f.it.spec.ts` (3), `helpers/f84f.ts`.

| Área | Cenários |
|---|---|
| Regularização histórica (C5) | candidata × não candidata (409 `ERR_HISTORICAL_NOT_ELIGIBLE`); historical_payment com data real e com data desconhecida (`SaaSPayments.paidAt` NULL no banco, `metadata.paidAtUnknown`); valor exato (400 INSUFFICIENT/EXCEEDS); sem renovação (dueDate/status/SaaSSubscriptionRenewals inalterados); receita só em historical_payment; courtesy e improper_cancel sem receita; keep_pending → terminal → 2ª terminal 409; concorrência (2 cenários `Promise.all`, exatamente 1 efeito); conflito Efí (CONCLUIDA, conciliação pendente, pagamento gateway → 409); ack obrigatório com cobrança gerada; isolamento 404; preview = apply (mesmos códigos) e preview sem escrita (snapshot global); fila por estado e summary; evento `historical_*` com ator |
| Prévia de pagamento (C6) | sem escrita; prévia = execução (newDueDate/willRenew/renewalSkippedReason/willUnblock) em 3 situações; 409 `ERR_PAYMENT_STATE_CHANGED`; bloqueio manual mantém bloqueada; alerta HISTORICAL_CANDIDATE; isolamento; renewal-preview com willUnblock/blockKind/alerts |
| Gateway após quitação | baixa manual e regularização histórica + txid NOVO (serviço e webhook reenviado): sem renovação, receita única, 1 item `gateway_payment_on_settled_invoice` |
| Central (C3) | ativa+vencida, bloqueada manual em dia, sem vencimento, último pagamento com data desconhecida, nextCycleDueDate = renewal-preview, isolamento/404 |
| Timeline (C4) | ordem decrescente, ids únicos, fatura legada sem evento uma vez (source invoice), fatura com evento só pelo ledger, renovação sem duplicar (ledger × CompanyLog), cursor `before` sem sobreposição/perda, isolamento/404 |
| Simulação (C2) | zero escrita (Companies status/dueDate, CompanyLogs, UserNotifications, ledger, pagamentos, faturas…); classificação (bloquearia, carência, em dia, vence hoje, sem vencimento, manual, financeiro, desconhecido); billing-status em lote; job real sem `BILLING_AUTOMATION_NORMALIZED_DATES` não bloqueia dueDate `Date` vencida (envio WhatsApp substituído por espião não chamado) |
| Permissões | 9 endpoints novos: usuário comum e admin do tenant → 401 "Acesso não permitido", sem efeitos; sem token → 401 |

### Resultados reais (2026-10-17, 2 execuções completas consecutivas)
**9 suítes, 90 testes: 89 passaram, 1 falhou** (os 46 anteriores continuam passando).

Falha (defeito real, reproduzível): `C6 — vencimento muda entre prévia e execução → 409` recebe **201**. O
`POST /saas/companies/:companyId/finance/manual-payment` (`backend/src/controllers/SaasFinanceController.ts:269-283`)
não repassa `req.body.expectedCurrentDueDate` para `registerManualPayment` (que já implementa a revalidação). O
frontend (`ManualPaymentDialog.js:254`) já envia o campo — hoje ele é ignorado e o pagamento é registrado com o
vencimento alterado por outro operador.

### Limitações 8.4-F
- App mínimo (sem `app.ts`/Redis); routers novos montados direto, não via `routes/index.ts`.
- Datas relativas a "hoje" (SP); a classificação histórica por `createdAt` usa `createdAt` retroativo gravado via SQL.
- O job real é exercitado só no modo legado (flag ausente); o modo normalizado não é testado em integração.

## Fase 8.4-F — resultado final (líder, 2026-10-17)

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit -p .` (backend) | exit 0 |
| `npm run build` (backend) | exit 0; migrations `20261017120000` e `20261018120000` compiladas |
| Unitários backend (SaasBilling, SaasCompanyUsers, helpers, CompanyService) | 55/55 suítes, **483/483** testes |
| Integração em Postgres isolado (`scripts/test-integration-f84.sh`) | 9/9 suítes, **90/90** (46 da 8.4 + 44 da 8.4-F); database temporário removido |
| Testes frontend (CompanyFinanceSection, CompaniesManager, pages/Platform, BillingAutomation, helpers) | 12/12 suítes, **78/78** |
| `npm run build` (frontend) | exit 0; avisos apenas em arquivos não tocados (o item de menu em SaaSModuleLayout.js são +6 linhas; os avisos são de hooks preexistentes) |

Defeito encontrado pelo QA e corrigido pelo líder antes desta rodada: `manual-payment` não repassava
`expectedCurrentDueDate` ao serviço (revalidação da prévia não acontecia). Após a correção, o cenário
"vencimento muda entre prévia e execução → 409" passou.

Não executado: validação visual em navegador (app completo exige Redis/filas); modo normalizado do job em integração
(coberto por testes unitários; a flag permanece desligada); suíte unitária completa do backend fora das áreas tocadas.

## Fechamento final pré-homologação — resultado definitivo (2026-10-17)

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit -p .` (backend) | exit 0 |
| `npm run build` (backend) | exit 0; 3 migrations novas compiladas (`20261017120000`, `20261018120000`, `20261019120000`) |
| Unitários backend (SaasBilling, SaasCompanyUsers, helpers, CompanyService, UserNotificationService) | 55/55 suítes, **491/491** |
| Integração em Postgres isolado (`scripts/test-integration-f84.sh`) | 11/11 suítes, **102/102** (90 anteriores + 4 notificações + 8 fechamento); databases temporários removidos |
| Testes frontend (CompanyFinanceSection, CompaniesManager, pages/Platform, BillingAutomation, helpers) | 14/14 suítes, **91/91** |
| `npm run build` (frontend) | exit 0; avisos só em arquivos não tocados |
| Migration de notificações num banco no estado "legado" (atendechat_f84, migrado do zero antes da correção) | `companyId` NOT NULL → nullable nas 2 tabelas; 2ª execução: "No migrations were executed" |

Testes novos desta rodada: `notificationsPlatformScope.it.spec.ts` (schema, notificação de plataforma gravada para cada
Super Admin, tenant não vê, notificação de ticket intacta, preferência de plataforma), `fechamentoFinal.it.spec.ts`
(fuso Manaus/Rio Branco/SP em renovações sucessivas, Pix após baixa manual → conciliação idempotente, recorrência inválida
no gateway, `GET /companies/:id` com plano/admin só para super, fila `unresolved`), casos novos em `saasDueDate.spec.ts`.

Testes ajustados (comportamento intencionalmente alterado, sem enfraquecer verificações):
- `confirmGatewayPayment.settledInvoice.spec.ts`: Pix com txid da baixa manual agora exige item de conciliação (antes: só log).
- `gatewayPayment.it.spec.ts`: o gatilho da "falha de processamento → 500" passou de recorrência inválida (agora tratada)
  para falha transitória da consulta à Efí; as asserções (500 + nada gravado) são as mesmas.
- `billingEvaluation.spec.ts`: vencimento gravado passa a ser o mesmo dia em qualquer fuso (correção FF-D2).
Observação honesta: numa rodada intermediária sob carga, duas suítes unitárias falharam; a investigação mostrou que a
correção de fuso estava sendo aplicada também a instantes — corrigido com `instantToDomainDate` (FF-D2), não por ajuste de teste.
