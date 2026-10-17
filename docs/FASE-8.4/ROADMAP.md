# Fase 8.4 — Recuperação financeira e reestruturação da Gestão de Empresas

Execução autônoma local. **Proibido**: deploy, acesso/alteração de banco de produção ou compartilhado,
cobranças Efí reais, alteração de credenciais, commit/push, `npm test` (roda `db:migrate:undo:all`).

Banco isolado para testes: container Docker descartável `atendechat-f84-testdb`
(`127.0.0.1:55499`, user `f84`, senha `f84local`, db `atendechat_f84`). Nenhum outro container deve ser tocado.
Para rodar migrations nele: `npm run build && DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=55499 DB_USER=f84 DB_PASS=f84local DB_NAME=<db> npx sequelize db:migrate`.

Testes unitários: `cd backend && NODE_ENV=test npx jest --coverage=false <caminho>` (nunca `npm test`).
Baseline pré-fase: `tsc --noEmit` limpo; suíte `AiAgentService/__tests__/aiAgentNaturalResponsePacing.spec.ts` já falhava (fora de escopo).

## Marcos

| Marco | Escopo | Responsável | Estado |
|---|---|---|---|
| A | Correção P0 (renovação/baixa/ajuste/webhook), idempotência, regra de vencimento | Líder (Agente 1 — P0) | concluído localmente (testado em Postgres isolado) |
| B | Navegação Empresas → página individual com guias | Agente 3 (frontend) | concluído localmente (falta validação visual em TESTE) |
| C | Gestão financeira completa (backend: Agente 1; UI: Agente 5) | Agentes 1 e 5 | concluído localmente |
| D | Cadastro, plano, funcionalidades, usuários (backend: Agente 2; UI: Agente 3) | Agentes 2 e 3 | concluído localmente |
| E | Integração, regressão, validação final | Agente 4 (QA) + Líder | concluído localmente; pendente decisão 401×403 |

## Propriedade de arquivos (nunca editar arquivo de outro agente)

- **Líder / P0**: `backend/src/services/SaasBilling/applySubscriptionRenewal.ts`, `computeNextDueDate.ts`,
  `registerManualPayment.ts`, `confirmGatewayPayment.ts`, `backend/src/helpers/saasDueDate.ts`,
  `backend/src/services/CompanyService/RenewCompanyDueDateService.ts`,
  `CompanyController.renewDueDate` (somente essa função), `SubscriptionController.ts` (webhook),
  testes em `backend/src/services/SaasBilling/__tests__/` e `backend/src/helpers/__tests__/`, `docs/FASE-8.4/*`.
- **Agente 1 — Financeiro backend (Marco C)**: `backend/src/controllers/SaasFinanceController.ts`,
  `backend/src/routes/saasFinanceRoutes.ts`, `backend/src/services/SaasBilling/ListCompanyFinanceService.ts`,
  `cancelSaasInvoice.ts`, novos arquivos `backend/src/services/SaasBilling/ManageSaasInvoiceService.ts`
  e testes `backend/src/services/SaasBilling/__tests__/manageSaasInvoice*.spec.ts`.
- **Agente 2 — Backend administrativo**: nova migration `backend/src/database/migrations/20261017120000-company-registration-fields.ts`,
  `backend/src/models/Company.ts` (somente novos campos), `CompanyController.ts` (exceto `renewDueDate`),
  `backend/src/services/CompanyService/UpdateCompanyService.ts`/`CreateCompanyService.ts`/`ShowCompanyService.ts`,
  novos `backend/src/controllers/SaasCompanyUsersController.ts`, `backend/src/routes/saasCompanyUsersRoutes.ts`,
  `backend/src/services/SaasCompanyUsers/*`, `backend/src/helpers/brDocuments.ts`, registro da rota em `backend/src/routes/index.ts`.
- **Agente 3 — Frontend páginas**: `frontend/src/components/CompaniesManager/**`, `frontend/src/pages/Platform/PlatformModule.js`,
  `PlatformCompanies.js`, `PlatformFinance.js` (somente link de empresa), novo diretório `frontend/src/pages/Platform/CompanyDetail/**`,
  `frontend/src/hooks/useCompanies/index.js`, novo `frontend/src/helpers/brMasks.js`.
- **Agente 5 — Frontend financeiro**: `frontend/src/components/CompanyFinanceSection/**`.
- **Agente 4 — QA**: `backend/jest.integration.config.js`, `backend/src/__integration__/**`, `scripts/test-integration-f84.sh`,
  `docs/FASE-8.4/TESTES.md` (seção de integração). Revisa, não edita código de produção (reporta ao líder).

## Contratos de API (backend ↔ frontend)

Todos exigem `isAuth` + `isSuper`. Erros: `{ error: "ERR_CODE", message?: "texto pt-BR legível" }`.
Datas de domínio sempre `YYYY-MM-DD` (fuso da empresa). Valores em número (reais, 2 casas).

### Renovação (Líder)
- `GET /saas/companies/:companyId/finance/renewal-preview` (rota no Agente 1, chama `previewSubscriptionRenewal(companyId)` exportado de `applySubscriptionRenewal.ts`)
  → `{ currentDueDate: string|null, recurrence: string, months: number, newDueDate: string, overdue: boolean, cyclesSkipped: number }`
- `POST /companies/:id/renew` body `{ reason: string (>=3), expectedCurrentDueDate: string|null }`
  → `{ ...company, autoUnblocked, renewal }`. `409 ERR_RENEWAL_STALE` se o vencimento mudou desde a tela (proteção clique duplo/concorrência).
  `400 ERR_RENEWAL_REASON_REQUIRED` sem justificativa.

### Baixa manual (Líder no serviço; rota existente)
- `POST /saas/companies/:companyId/finance/manual-payment` body `{ invoiceId, kind: "paid_offline"|"courtesy", amount, method, paidAt: "YYYY-MM-DD", reason, renewSubscription?: boolean }`
  - `paid_offline`: `amount` deve ser igual ao valor da fatura (centavos) → senão `400 ERR_PAYMENT_AMOUNT_INSUFFICIENT` / `ERR_PAYMENT_AMOUNT_EXCEEDS`.
  - `409 ERR_INVOICE_NOT_OPEN` se já paga/cancelada.
  - Resposta `{ payment, invoice, gatewaySyncStatus, renewed, renewalSkippedReason: null|"period_already_covered"|"disabled" , company: { id, dueDate, status } }`.

### Faturas (Agente 1)
- `GET /saas/companies/:companyId/finance/invoices?status=&legacy=true|false&page=&limit=` → itens incluem `isLegacy` (legacyUnknown || cycleKey nulo), `isOverdue`, `paymentsCount`.
- `POST /saas/companies/:companyId/finance/invoices` body `{ dueDate, value?, competence? (YYYY-MM), detail?, reason }` → 201 `{ invoice }`; `409 ERR_INVOICE_CYCLE_DUPLICATE`. Nunca emite cobrança Efí.
- `PUT /saas/companies/:companyId/finance/invoices/:invoiceId` body `{ value?, dueDate?, detail?, reason }` → só faturas `open` sem pagamentos e sem cobrança externa ativa; senão `409 ERR_INVOICE_NOT_EDITABLE`. Ledger `invoice_updated` com before/after.
- `POST .../invoices/:invoiceId/cancel` (existente) `{ reason }`.
- `GET /saas/companies/:companyId/finance/summary` → acrescenta `totals: { billed, received, open, overdue, courtesy }` e `nextDueDate`, `plan: { id, name }`, `contractedValue`.

### Cadastro de empresa (Agente 2)
Novos campos opcionais em `Companies` (todos nullable): `tradeName`, `legalName`, `document` (só dígitos), `documentType` ("cpf"|"cnpj"),
`addressZipCode` (8 dígitos), `addressStreet`, `addressNumber`, `addressComplement`, `addressNeighborhood`, `addressCity`, `addressState` (UF).
`PUT /companies/:id` aceita esses campos; valida só quando preenchidos (`ERR_INVALID_DOCUMENT`, `ERR_INVALID_EMAIL`, `ERR_INVALID_PHONE`, `ERR_INVALID_ZIPCODE`, `ERR_INVALID_STATE`). `GET /companies/:id` os retorna.

### Usuários da empresa (Agente 2)
- `GET /saas/companies/:companyId/users?searchParam=&pageNumber=` → `{ users: [{id,name,email,profile,active,super,online,createdAt}], count, hasMore }` (nunca hash).
- `POST /saas/companies/:companyId/users` `{ name, email, password, profile: "admin"|"user" }`
- `PUT /saas/companies/:companyId/users/:userId` `{ name?, email?, profile? }`
- `PATCH /saas/companies/:companyId/users/:userId/active` `{ active: boolean }` → `409 ERR_LAST_ADMIN` ao desativar/rebaixar o último admin ativo.
- `POST /saas/companies/:companyId/users/:userId/password` `{ password }` (mín. 8) → define senha e `mustChangePassword=true`, invalida sessões (`tokenVersion++`).
- Sem exclusão física nesta fase (desativação). Usuário de outra empresa → `404 ERR_USER_NOT_FOUND`.

### Rotas frontend (Agente 3)
- `/saas/companies` listagem; `/saas/companies/:companyId/:tab?` página individual, guias:
  `cadastro` | `plano` | `financeiro` | `funcionalidades` | `usuarios` (padrão `cadastro`).
- Compatibilidade: `/saas/companies?focus=ID&section=finance` redireciona para `/saas/companies/ID/financeiro`.
- Guia Financeiro renderiza `<CompanyFinanceSection companyId={id} company={company} onCompanyChanged={reload} />` (Agente 5).
- Diálogo de renovação compartilhado: `frontend/src/components/CompanyFinanceSection/RenewSubscriptionDialog.js`
  props `{ open, company: {id,name,dueDate,recurrence}, onClose, onRenewed(companyData) }` (Agente 5) — usado também pelo botão da listagem (Agente 3).

---

# Fase 8.4-F — Gestão operacional de assinaturas e regularização histórica

Operador financeiro: **Alex** (Super Admin). Objetivo: Alex opera sozinho, sem SQL/SSH.
Mesmas proibições da 8.4 (sem commit/push/deploy/VPS/bancos compartilhados/`npm test`/Efí real/credenciais).
Banco isolado: container `atendechat-f84-testdb` (127.0.0.1:55499, f84/f84local) — cada agente cria o SEU database
(`f84_<agente>`), compila em `backend/dist-<agente>` (`npx tsc --outDir dist-<agente>`) e apaga ao final.
NÃO rodar `npm run build` no backend nem no frontend (o líder roda no fim). `routes/index.ts` é do LÍDER: os agentes
NÃO registram routers; o líder registra no fim (para testes, monte o router direto num express mínimo).

## Marcos 8.4-F
| Marco | Escopo | Responsável |
|---|---|---|
| F1 | Central de assinatura (backend) | Agente Assinaturas |
| F2 | Linha do tempo (backend) | Agente Assinaturas |
| F3 | Regularização histórica (backend + migration) | Agente Financeiro |
| F4 | Prévias com a mesma regra da execução + revalidação | Agente Assinaturas (pagamento/renovação), Agente Financeiro (regularização) |
| F5 | Listagem operacional (status em lote) | Agente Automação (backend) + Frontend Operação |
| F6 | Revisão pagamento/cortesia/renovação/histórico | Agente Assinaturas + QA |
| F7 | Motor puro de avaliação + simulação somente leitura | Agente Automação |
| F1–F4 UI | Página da empresa | Frontend Empresa |
| F3/F5/F7 UI | Listagem, fila histórica, simulação | Frontend Operação |
| QA | Integração em Postgres isolado | Agente QA |
| F8 | Guia do Alex, checklist de transferência, docs | Líder |

**Estado (2026-10-17):** F1–F8 concluídos localmente e validados (integração 90/90, unitários 483/483, frontend 78/78, builds OK).
Pendente: deploy em TESTE, validação visual, homologação e a regularização operacional pelo Alex em produção.

## Propriedade de arquivos (8.4-F)
- **Automação**: novos `backend/src/services/SaasBilling/billingEvaluation.ts`, `backend/src/services/SaasBilling/BillingSimulationService.ts`,
  `backend/src/controllers/BillingSimulationController.ts`, `backend/src/routes/billingSimulationRoutes.ts`;
  `backend/src/services/CompanyService/BillingAutomationJob.ts`; testes `backend/src/services/SaasBilling/__tests__/billingEvaluation*.spec.ts`,
  `billingSimulation*.spec.ts`, `backend/src/services/CompanyService/__tests__/billingAutomationJob*.spec.ts`.
- **Assinaturas**: `applySubscriptionRenewal.ts`, `computeNextDueDate.ts`, `registerManualPayment.ts`, `confirmGatewayPayment.ts`,
  `RenewCompanyDueDateService.ts`, `CompanyController.renewDueDate` (só essa função), novos `backend/src/services/SaasBilling/SubscriptionCenterService.ts`,
  `CompanyTimelineService.ts`, `backend/src/controllers/SaasSubscriptionController.ts`, `backend/src/routes/saasSubscriptionRoutes.ts`;
  testes correspondentes em `backend/src/services/SaasBilling/__tests__/` (os seus + os já existentes desses serviços).
- **Financeiro**: migration `backend/src/database/migrations/20261018120000-saas-historical-review.ts`, model `backend/src/models/SaaSInvoiceHistoricalReview.ts`,
  registro do model em `backend/src/database/index.ts`, `backend/src/models/SaaSPayment.ts`, novos `backend/src/services/SaasBilling/HistoricalReviewService.ts`,
  `backend/src/controllers/SaasHistoricalReviewController.ts`, `backend/src/routes/saasHistoricalReviewRoutes.ts`;
  `ListCompanyFinanceService.ts`, `PlatformFinanceDashboardService.ts`, `cancelSaasInvoice.ts`, `ManageSaasInvoiceService.ts`,
  `SaasFinanceController.ts`, `saasFinanceRoutes.ts`; testes `historicalReview*.spec.ts` e os existentes desses serviços.
- **Frontend Empresa**: `frontend/src/components/CompanyFinanceSection/**`, `frontend/src/pages/Platform/CompanyDetail/CompanyDetailHeader.js`,
  `frontend/src/pages/Platform/CompanyDetail/index.js` (só para carregar/passar o resumo de assinatura).
- **Frontend Operação**: `frontend/src/components/CompaniesManager/**`, `frontend/src/pages/Platform/PlatformFinance.js`,
  novo `frontend/src/pages/Platform/HistoricalReview/**`, `frontend/src/pages/BillingAutomation/**`, `frontend/src/pages/Platform/PlatformModule.js`,
  `frontend/src/hooks/useCompanies/index.js`.
- **QA**: `backend/src/__integration__/**`, `backend/jest.integration.config.js`, `scripts/test-integration-f84.sh`, seção própria em `docs/FASE-8.4/TESTES.md`.
- **Líder**: `backend/src/routes/index.ts`, `docs/FASE-8.4/*` (exceto seção do QA).

## Contratos 8.4-F
Todos os endpoints: `isAuth` + `isSuper` (não-super recebe 401 "Acesso não permitido" — contrato mantido). `companyId` do path
sempre no `where`. Erros `{ error, message }` pt-BR. Datas de domínio `YYYY-MM-DD` no fuso da empresa (`toDomainDate`).

### C1 — Motor puro de avaliação (Automação) — `billingEvaluation.ts` (entregar PRIMEIRO; outros importam)
```ts
export type BlockKind = "none" | "manual" | "financial" | "unknown";
export type FinancialStatus = "sem_vencimento" | "em_dia" | "vence_hoje" | "carencia" | "vencido";
export type BillingSettingsInput = { daysBeforeDueWarning: number; daysAfterDueWarning: number; daysAfterDueBlock: number;
  enableAutoBlock: boolean; enableAutoWarning: boolean };
export type BillingEvaluationInput = { company: { id: number; dueDate: Date | string | null; status: boolean; timezone?: string | null };
  lastBlockAction?: string | null; settings: BillingSettingsInput; today?: string /* YYYY-MM-DD */ };
export type BillingEvaluation = { companyId: number; dueDate: string | null; today: string; daysUntilDue: number | null;
  daysLate: number | null; financialStatus: FinancialStatus; operationalStatus: "ativa" | "bloqueada"; blockKind: BlockKind;
  wouldBlock: boolean; wouldWarnBeforeDue: boolean; wouldWarnAfterDue: boolean; reasons: string[] };
export function resolveBlockKind(status: boolean, lastBlockAction?: string | null): BlockKind;
export function evaluateCompanyBilling(input: BillingEvaluationInput): BillingEvaluation;
export async function loadLastBlockActions(companyIds: number[]): Promise<Map<number, string>>; // CompanyLog block|unblock|auto_block|auto_unblock_after_renew
```
Regras: `carencia` = 0 < daysLate < daysAfterDueBlock; `vencido` = daysLate ≥ daysAfterDueBlock; `vence_hoje` = daysLate 0.
blockKind: status true → none; false + último log `block` → manual; `auto_block` → financial; senão unknown.
`wouldBlock` = enableAutoBlock && status && daysLate ≥ daysAfterDueBlock (espelha o job). Sem I/O em `evaluateCompanyBilling`.

### C2 — Simulação e status em lote (Automação) — `billingSimulationRoutes.ts`
- `GET /saas/billing-automation/simulation?today=YYYY-MM-DD` → `{ generatedAt, today, readOnly: true, settings,
  jobMode: "legacy"|"normalized", summary: { total, wouldBlock, inGrace, active, wouldWarnBeforeDue, wouldWarnAfterDue, noDueDate,
  blockedManual, blockedFinancial, blockedUnknown }, companies: [BillingEvaluation & { name }] }`. ZERO escrita (nem log).
- `GET /saas/companies/billing-status` → `{ companies: [{ companyId, dueDate, financialStatus, operationalStatus, blockKind, daysLate }] }` (uma consulta em lote).
- Job: nova flag `BILLING_AUTOMATION_NORMALIZED_DATES` (default **false**). false = comportamento atual idêntico (Date ignorado).

### C3 — Central de assinatura (Assinaturas) — `GET /saas/companies/:companyId/subscription`
`{ company: {id,name,timezone}, plan: {id,name}|null, recurrence, months, contractedValue, currentDueDate, nextCycleDueDate,
  status: { operational: "ativa"|"bloqueada", blockKind, financial: FinancialStatus, subscription: "em_dia"|"vencida"|"sem_vencimento",
  daysLate, daysUntilDue },
  lastConfirmedPayment: { id, invoiceId, amount, paidAt: string|null, paidAtUnknown: boolean, method, source } | null,
  nextExpectedCharge: { invoiceId, value, dueDate, isHistoricalCandidate } | null,
  pendencies: { openInvoices, overdueInvoices, openAmount, reconciliationPending, historicalReviewPending } }`
`status.financial`/`blockKind` vêm do motor C1 (configurações reais do sistema). `nextCycleDueDate` = mesma regra da renovação.
`lastConfirmedPayment` = último SaaSPayment com countsAsRevenue=true. `historicalReviewPending` via C5 `countHistoricalReviewPending`.

### C4 — Linha do tempo (Assinaturas) — `GET /saas/companies/:companyId/timeline?before=<ISO>&limit=30`
`{ items: [{ id: "evt:<id>"|"log:<id>"|"inv:<id>", occurredAt, kind, title, amount: number|null, actor: {id,name}|null,
  invoiceId: number|null, source: "ledger"|"company_log"|"invoice", details }], nextBefore: string|null, historyStartsAt: string|null }`
Fontes: SaaSFinancialEvents, CompanyLogs (block/unblock/auto_block/auto_unblock_after_renew/renew*/due_date_manual_edit/
registration_update/user_*), e Invoices.createdAt apenas para faturas SEM evento `invoice_created*` ("Fatura registrada (sem
histórico detalhado)"). Sem duplicar (renovações já geram evento no ledger). Paginação por cursor `before` (limit ≤ 100).
`kind` ∈ invoice_created, invoice_updated, invoice_cancelled, payment_manual, payment_gateway, payment_historical, courtesy,
courtesy_historical, renewal_payment, renewal_admin, renewal_skipped, due_date_adjusted, due_date_manual_edit, block_manual,
block_auto, unblock, unblock_after_renew, historical_review, registration_update, user_admin, other.

### C5 — Regularização histórica (Financeiro)
- Data de referência `HISTORICAL_REVIEW_REFERENCE_DATE = "2026-10-17"` (override `SAAS_HISTORICAL_REFERENCE_DATE`).
- Candidata: status não `paid`/`cancelled`, sem SaaSPayment, sem decisão terminal, e (createdAt < referência no fuso da empresa
  OU legacyUnknown OU cycleKey nulo). A referência só CLASSIFICA; nunca quita.
- Sinais (indícios, nunca decidem): `coveredByCurrentDueDate` (vencimento atual ≥ fim do ciclo da fatura), `adminRenewalsAfterDue`
  (qtd. de `manual_renew` após o vencimento da fatura), `efiCharge` (externalTxid/externalChargeId), `pendingReconciliation`.
- `GET /saas/finance/historical-review?companyId=&state=pending|kept_pending|resolved|all&page=&limit=` →
  `{ items: [{ invoice, company: {id,name}, signals, review: {decision, note, createdAt, actor}|null, blockedReason: string|null }], count, hasMore }`
- `GET /saas/finance/historical-review/summary` → `{ total, byCompany: { [companyId]: number } }`
- `POST /saas/companies/:companyId/finance/invoices/:invoiceId/historical-review/preview` e `POST .../historical-review` — body:
  `{ decision: "historical_payment"|"improper_cancel"|"historical_courtesy"|"keep_pending", note (≥5), confirmationSource
  (obrigatório em historical_payment/historical_courtesy), paidAt?: "YYYY-MM-DD", paidAtUnknown?: boolean (exatamente um dos dois
  em historical_payment), amount? (= valor da fatura em historical_payment), method? ("pix"|"transfer"|"cash"|"boleto"|"credit_card"|"other"|"unknown"),
  efiChargeAcknowledged?: boolean (obrigatório se a fatura tem cobrança Efí gerada) }`.
  Preview → `{ valid, errors:[{code,message}], alerts:[{code,message}], decision, revenueEffect: "revenue"|"no_revenue",
  invoiceStatusAfter, willRenew: false, payment: { amount, paidAt, paidAtUnknown } | null }`.
  Apply → 201 `{ review, invoice, payment|null }`. Mesma função valida preview e apply (dentro da transação, com lock da fatura).
- Efeitos: historical_payment → SaaSPayment `source "historical_payment"`, countsAsRevenue=true, `paidAt` real ou **null**
  (migration torna `SaaSPayments.paidAt` nullable; `metadata.paidAtUnknown=true`), fatura `paid`, **sem renovação**.
  historical_courtesy → `source "historical_courtesy"`, countsAsRevenue=false, fatura `paid`, sem renovação.
  improper_cancel → fatura `cancelled` (mesma semântica de cancelSaasInvoice), sem receita. keep_pending → só registro.
  Todos geram evento no ledger (`historical_*`) com ator, nota e fonte.
- Erros: 409 `ERR_HISTORICAL_ALREADY_REVIEWED`, `ERR_HISTORICAL_NOT_ELIGIBLE`, `ERR_HISTORICAL_EFI_CONFLICT` (pagamento gateway,
  gatewayStatus CONCLUIDA ou conciliação pendente → conciliar), `ERR_INVOICE_NOT_OPEN`; 400 `ERR_PAYMENT_AMOUNT_INSUFFICIENT|EXCEEDS`,
  `ERR_HISTORICAL_PAID_AT_REQUIRED`, `ERR_HISTORICAL_SOURCE_REQUIRED`, `ERR_HISTORICAL_EFI_ACK_REQUIRED`.
- Idempotência: lock FOR UPDATE da fatura + índice único parcial em `SaaSInvoiceHistoricalReviews(invoiceId)` para decisões terminais.
- Exporta `countHistoricalReviewPending(companyId?: number): Promise<number>` e `isHistoricalCandidate(invoice, company)`.

### C6 — Prévias de pagamento/renovação (Assinaturas)
- `POST /saas/companies/:companyId/finance/manual-payment/preview` (mesmo body do manual-payment) →
  `{ valid, errors, alerts:[{code,message}], company:{id,name}, invoice:{id,value,dueDate,status,detail}, kind, amount, method,
  previousDueDate, newDueDate: string|null, willRenew, renewalSkippedReason: null|"period_already_covered"|"disabled",
  revenueEffect, invoiceStatusAfter: "paid", willUnblock, blockKind, expectedCurrentDueDate }`.
  Alertas: AMOUNT_MISMATCH, PERIOD_ALREADY_COVERED, MANUAL_BLOCK_KEEPS_BLOCKED, CYCLES_SKIPPED, EFI_CHARGE_EXISTS,
  INVOICE_NOT_OPEN, HISTORICAL_CANDIDATE (sugere regularização histórica em vez de pagamento atual).
- `POST .../manual-payment` aceita `expectedCurrentDueDate` opcional → `409 ERR_PAYMENT_STATE_CHANGED` se o vencimento mudou.
- `renewal-preview` (rota existente) passa a incluir `willUnblock`, `blockKind`, `alerts` (compatível).
- Prévia e execução usam a MESMA função de planejamento (`planSubscriptionRenewal`), revalidada na transação.

### C7 — Componentes compartilhados de UI (Frontend Empresa → usados pelo Frontend Operação)
- `CompanyFinanceSection/HistoricalReviewDialog.js` props `{ open, companyId, invoice, onClose, onDone }`.
- `CompanyFinanceSection/ManualPaymentDialog.js` (existente) props atuais preservadas.
- `CompanyFinanceSection/RenewSubscriptionDialog.js` (existente).
