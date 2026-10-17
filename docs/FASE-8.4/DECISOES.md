# Fase 8.4 — Decisões técnicas

Registro das decisões tomadas durante a execução autônoma. Cada item: decisão, motivo, impacto.

## D1 — Causa raiz do P0 e correção (normalização de datas)
- **Confirmado em Postgres real isolado** (container Docker descartável, migrations do repositório):
  `Companies.dueDate` é `timestamp with time zone`; o `pg` devolve `Date` em runtime (o model declara `string`).
  `applySubscriptionRenewal` gravava esse `Date` em `SaaSSubscriptionRenewals.previousDueDate` (`STRING(16)`).
  Erro real reproduzido: `SequelizeValidationError: string violation: previousDueDate cannot be an array or an object`
  → HTTP 500 (`ERR_INTERNAL_SERVER_ERROR`), transação revertida, empresa permanece vencida/bloqueada.
- Atinge todo caminho que passa por `applySubscriptionRenewal`: baixa manual (renova por padrão), cortesia,
  renovação administrativa (`POST /companies/:id/renew`), ajuste de vencimento e confirmação Pix via webhook.
- **Correção**: helper único `backend/src/helpers/saasDueDate.ts#toDomainDate(value, tz)` → `YYYY-MM-DD` no fuso da empresa,
  aceitando `Date`, ISO com offset (faturas legadas), `YYYY-MM-DD` ou vazio. Usado em todo o motor de renovação.
- Nenhuma migration alterada; nenhuma mudança de tipo de coluna (evita migração de dados em produção).

## D2 — Regra do novo vencimento (preservar calendário contratual)
- Sem vencimento: hoje + período.
- Em dia (vencimento ≥ hoje): vencimento + período.
- **Vencido**: avança em múltiplos do período **a partir da âncora original** até ficar estritamente no futuro.
  Ex.: venc. 05/07, mensal, hoje 17/10 → 05/11 (3 ciclos pulados). Antes: base = hoje (deslocava o dia contratual).
- Motivo: requisito de preservar o calendário e nunca gerar vencimento já expirado.
- Consequência registrada: ciclos pulados **não são cobrados automaticamente**; faturas abertas desses ciclos continuam
  abertas (decisão comercial do Super Admin: cobrar, cancelar com justificativa). `cyclesSkipped` é exibido na prévia.
- Deriva de fim de mês: calcular sempre `âncora + k×período` evita 31→28→28 dentro de uma renovação.
  Entre renovações a deriva é inerente ao modelo (só existe um `dueDate`) — limitação documentada.

## D3 — Uma renovação por fatura (idempotência entre baixa manual e gateway)
- Chave `renew-invoice:<invoiceId>` (antes: `renew-manual:<invoice>:<payment>` e `renew:gw-pay:<txid>` — chaves diferentes
  permitiam duas renovações para a mesma fatura).
- O lock da empresa (`SELECT … FOR UPDATE`) é adquirido **antes** da checagem de idempotência; a segunda chamada concorrente
  enxerga a renovação já commitada. Violação de unique residual vira `409 ERR_RENEWAL_DUPLICATE` (não tenta reler numa
  transação abortada do Postgres).
- Baixa manual: lock da fatura + status → segunda baixa recebe `409 ERR_INVOICE_NOT_OPEN`.

## D4 — "Período já coberto" (evitar renovar duas vezes o mesmo período)
- Ao renovar por pagamento de fatura, se `vencimento atual ≥ vencimento da fatura + período`, o pagamento é registrado
  (receita, fatura paga, ledger) mas **não estende** o vencimento; evento `renewal_skipped_period_already_covered`,
  resposta `renewalSkippedReason: "period_already_covered"`.
- Cobre: renovação administrativa seguida do pagamento da fatura do mesmo ciclo; pagamento tardio de fatura de ciclo pulado.
- Faturas com vencimento ilegível → renovação normal (comportamento anterior).

## D5 — Renovação administrativa: justificativa e anti-duplicidade no backend
- `POST /companies/:id/renew` exige `reason` (≥ 3) → `400 ERR_RENEWAL_REASON_REQUIRED`.
- `expectedCurrentDueDate` (vencimento exibido na tela) é comparado sob lock → `409 ERR_RENEWAL_STALE` se mudou
  (clique duplo, duas abas, dois administradores).
- Cliente antigo sem o campo: janela de 30 s por empresa → `409 ERR_RENEWAL_TOO_SOON`.
- Não cria pagamento, não quita fatura, não conta receita (inalterado). Justificativa vai ao ledger e ao CompanyLog.

## D6 — Desbloqueio
- Achado: `Company.status=false` **não é verificado no login** nem no `isAuth`; o corte efetivo de acesso é a
  inadimplência por `dueDate` (`requireCompanyNotDelinquent` + UI). Renovar o vencimento é o que restaura o acesso.
- `status` volta a `true` quando a renovação deixa o vencimento em dia, **exceto** se o último registro de bloqueio for
  manual (`CompanyLog.action = "block"`) e a renovação vier de pagamento/cortesia — bloqueio não financeiro não é desfeito
  por pagamento. Renovação administrativa e ajuste (ações explícitas do Super Admin) reativam, como antes.

## D7 — Pagamento manual: valor exato
- Pagamento parcial não está modelado de forma consistente (fatura só tem `open|paid|cancelled`) → `paid_offline` exige
  valor igual ao da fatura em centavos: `ERR_PAYMENT_AMOUNT_INSUFFICIENT` / `ERR_PAYMENT_AMOUNT_EXCEEDS`.
  Desconto acordado: editar a fatura aberta (auditado) antes da baixa.
- Cortesia grava `amount = valor da fatura` com `countsAsRevenue=false`.
- Pix offline continua `gatewaySyncStatus="unsupported"` + item de conciliação (não há baixa manual Pix na Efí).

## D8 — Auditoria pós-commit
- `CompanyLog` e notificações de renovação rodavam **dentro** da transação externa da baixa manual/gateway, mas sem a
  transação (poderiam registrar uma renovação que depois sofreu rollback). Agora `runRenewalSideEffects` roda após o commit.

## D9 — Webhook Pix
- Falha de processamento agora responde `500 ERR_WEBHOOK_PROCESSING_FAILED` (antes: 200 `{ok:true}` e o pagamento se perdia).
  Reprocessamento pela Efí é seguro: idempotência por `txid` (`SaaSPayment.externalTxid` único) e por fatura (D3).
- Casos de validação (cobrança não `CONCLUIDA`, fatura inexistente, valor divergente) continuam respondendo 200 e logando
  — reenviar não mudaria o resultado.

## D10 — Fora de escopo, registrado como risco
- `BillingAutomationJob` ignora `dueDate` que não seja string (`typeof !== "string"`) → com `timestamptz` o bloqueio
  automático e os avisos de cobrança **provavelmente não rodam em produção**. Corrigir passaria a bloquear/avisar clientes
  em massa → exige decisão comercial e homologação próprias. Não alterado.
- Geração automática de faturas segue atrás de `SAAS_BILLING_AUTO_INVOICE` (default OFF); a nova geração manual cobre o
  incidente.

## D11 — Faturas manuais (Agente 1)
- `cycleKey = competência (YYYY-MM)`; duplicidade checada sob lock da empresa contra a mesma `cycleKey` **e** contra faturas
  legadas (sem `cycleKey`) com o mesmo vencimento → `409 ERR_INVOICE_CYCLE_DUPLICATE` (+ `existingInvoiceId`).
- Edição só de fatura `open`, sem pagamento e sem cobrança externa (`externalTxid`/`externalChargeId`); ledger com antes/depois.
- Cancelamento: nunca exclusão física; bloqueado se houver pagamento. Cancelar fatura com cobrança Efí ativa ainda é
  permitido (marcado no ledger como `externalChargeActive`) — **risco**: o cliente ainda pode pagar o Pix; o webhook
  registrará o pagamento (dinheiro recebido não é descartado). Decisão comercial pendente.
- Ajuste de vencimento: justificativa obrigatória, `expectedCurrentDueDate` e chave determinística com sufixo da última renovação.

## D12 — Cadastro e usuários (Agente 2)
- 11 colunas nullable em `Companies` (migration aditiva e idempotente). Validação só de campos preenchidos/alterados;
  valores legados inválidos e inalterados não bloqueiam a edição.
- Usuários: só perfis `admin`/`user`; super não é criado/alterado por essas rotas; último admin ativo protegido sob lock;
  troca de senha força `mustChangePassword` e incrementa `tokenVersion`; sem exclusão física; e-mail único global
  (constraint existente). Limite do plano conta usuários **ativos**.
- PUT com `dueDate` alterado registra `due_date_manual_edit` (antes/depois) — edição direta do vencimento foi mantida por
  compatibilidade, mas agora é auditada; a UI orienta usar "Renovar".

## D13 — Navegação (Agente 3)
- `/saas/companies/:companyId/:tab?`; Cadastro, Plano e Funcionalidades compartilham um formulário e um "Salvar"; só campos
  alterados são enviados (não sobrescreve renovação feita no Financeiro). "Nova empresa" continua em diálogo.
- Links antigos `?focus=ID[&section=finance]` redirecionam.

## D14 — HTTP 401 do isSuper (DECIDIDO no fechamento: manter 401)
- `isSuper` responde **401** (não 403) para usuário autenticado sem permissão. O acesso é negado em todos os casos testados.
  Trocar para 403 muda o comportamento global do interceptor do frontend (refresh+retry); não alterado. Na execução
  autônoma, 2 testes de integração ficaram vermelhos para manter a decisão visível; no fechamento foram ajustados (abaixo).

**Fechamento (decisão do proprietário):** manter o comportamento atual do `isSuper` (401 "Acesso não permitido") e não
alterar o contrato global de autenticação nesta fase. Os 2 testes de integração foram ajustados para exigir exatamente
401 **com** `error: "Acesso não permitido"` (distingue recusa por permissão de sessão expirada/token inválido) e a ausência
de efeitos colaterais continua verificada. Resultado: 46/46.

## D15 — Automação de bloqueios adiada (decisão do proprietário)
`BillingAutomationJob` não foi alterado. Inconsistência registrada para fase posterior: o job ignora `Company.dueDate`
que não seja string, e a coluna é `timestamptz` (chega como `Date`), logo bloqueios/avisos automáticos provavelmente não
rodam em produção. Corrigir exige decisão comercial, comunicação aos clientes e homologação própria. Nenhum novo
bloqueio, aviso ou geração automática de cobrança foi habilitado (`SAAS_BILLING_AUTO_INVOICE` permanece OFF).

## D16 — Dados financeiros no deploy
Nenhuma exclusão, cancelamento, ajuste em massa de vencimentos ou alteração automática de faturas no deploy.
A migration da fase só adiciona colunas nullable. A recuperação de clientes é manual, pelo Super Admin, com justificativa.

## D17 — Webhook Pix
Mantida a resposta 500 em falha de processamento. Idempotência confirmada por testes de integração em Postgres real
(txid repetido, txid simultâneo, reenvio do webhook, baixa manual seguida de confirmação do gateway). Procedimento de
recuperação de Pix confirmados e não registrados: HOMOLOGACAO.md §4. Nenhum reprocessamento real executado.

## D18 — Procedimento de deploy
Auditoria: systemd `Restart=always` + `MINIMAL_UPDATE` compila e migra com o backend antigo no ar (≈259 imports tardios)
→ risco de o processo reiniciar com código novo e schema antigo. Recomendado nesta release: parar o serviço → build →
`npx sequelize db:migrate` → iniciar (HOMOLOGACAO.md §1.3). Não usar `npm start` (nodemon reinicia a cada rebuild) nem
`npm run db:migrate` (recompila antes de migrar). Os scripts de deploy não foram alterados nesta fase.

---

# Fase 8.4-F — Decisões

## F-D1 — Uma regra, duas chamadas (prévia = execução)
Toda prévia (pagamento, renovação, regularização histórica) chama a mesma função de planejamento/validação usada pela
execução; a execução revalida dentro da transação, com lock, e recusa (409) se o estado mudou desde a prévia
(`expectedCurrentDueDate`). Motivo: Alex decide com base na prévia; ela não pode divergir do efeito real.

## F-D2 — Status separados
A central de assinatura exibe três dimensões independentes: **operação** (empresa ativa/bloqueada e o tipo de bloqueio:
manual, financeiro, desconhecido), **financeiro** (em dia, vence hoje, carência, vencido, sem vencimento) e
**assinatura** (em dia, vencida, sem vencimento). "Empresa ativa" não significa "assinatura em dia".
O tipo de bloqueio vem do último registro de bloqueio/desbloqueio em `CompanyLogs`; sem registro → "desconhecido"
(não inventamos o motivo de bloqueios antigos).

## F-D3 — Motor puro de avaliação de cobrança
`billingEvaluation.ts` (sem I/O) é a fonte única para: status financeiro da listagem, central de assinatura e simulação.
Carência = dias de atraso abaixo de `daysAfterDueBlock` (configuração do sistema). O job real só usa o motor com a flag
`BILLING_AUTOMATION_NORMALIZED_DATES=true` (default **false**: comportamento atual idêntico, decisão D15).

## F-D4 — Regularização histórica é por fatura, manual e auditada
- Data de referência 17/10/2026 apenas **classifica** candidatas (junto com `legacyUnknown`/sem ciclo); nunca quita.
- Quatro decisões: pagamento histórico confirmado (receita, **sem renovação**), fatura indevida (cancelada, sem receita),
  cortesia histórica (sem receita, sem renovação), manter pendente (só registro, pode ser decidida depois).
- Indícios exibidos (vencimento atual já cobre o ciclo, renovações administrativas após o vencimento, cobrança Efí)
  **não** são prova: renovação antiga não comprova pagamento.
- Nada é inventado: data real ou explicitamente "desconhecida" (`SaaSPayments.paidAt` passa a aceitar NULL com
  `metadata.paidAtUnknown=true` — relaxamento compatível com o código anterior; pagamentos sem data entram nos totais
  e aparecem separados, nunca numa competência fictícia); forma de pagamento "não sei" permitida explicitamente.
- Valor exato da fatura (sem parcial disfarçado); fatura com qualquer pagamento registrado não é elegível (sem receita
  duplicada); conflito com pagamento/conciliação Efí bloqueia e direciona à conciliação; cobrança Efí apenas gerada exige
  confirmação explícita de que foi verificada na Efí.
- Idempotência: lock da fatura + índice único parcial para decisões terminais.

## F-D5 — Pagamento Efí chegando em fatura já quitada fora do gateway
Não renova nem conta receita de novo; abre item de conciliação "possível pagamento em duplicidade" (idempotente por txid)
para Alex tratar (estorno/crédito é decisão comercial).

## F-D6 — Listagem operacional sem N+1
Status financeiro/bloqueio em lote (`GET /saas/companies/billing-status`) e contagem de históricas em lote
(`/saas/finance/historical-review/summary`); a listagem continua carregando as empresas como antes.
Ações de cobrança apenas abrem o lembrete manual existente — nada é enviado ou cobrado automaticamente.

## F-D7 — Decisões de implementação (agentes, revisadas pelo líder)
- **Motor C1**: `daysLate`/`daysUntilDue` nunca negativos (0 quando não se aplica); dias contados em datas de domínio
  (UTC) — imune a horário de verão. `wouldBlock`/avisos só para empresas ativas (o job só processa `status=true`) e sem
  considerar deduplicação de avisos já enviados ("se ainda não enviado").
- **Job**: lógica atual preservada como `planLegacy`; caminho novo `planNormalized` só com
  `BILLING_AUTOMATION_NORMALIZED_DATES=true|1`. Ligar a flag bloquearia de imediato empresas vencidas há muito tempo —
  medir antes pela simulação (`summary.wouldBlock`). Com `enableAutoWhatsAppWarning` ligado, também passaria a avisar.
- **Planner único**: `planSubscriptionRenewal` (puro) usado por execução, `previewSubscriptionRenewal`, prévia de
  pagamento e central de assinatura. Pagamento com `expectedCurrentDueDate` trava fatura → empresa (mesma ordem do gateway).
- **Central**: "vence hoje" conta como assinatura em dia; `lastConfirmedPayment` ordenado pela data do pagamento
  (data desconhecida por último, para uma regularização feita hoje não parecer o pagamento mais recente);
  `nextExpectedCharge` prefere faturas não históricas.
- **Linha do tempo**: logs `renew*` que já têm evento `renewal_*` no ledger (±10 min, mesmo `newDueDate`) são omitidos
  para não duplicar — heurística documentada; faturas sem evento de criação entram uma única vez.
- **Regularização**: ordem de checagem já revisada → conflito Efí → fatura não aberta → não elegível → dados inválidos;
  confirmação de cobrança Efí exigida nas três decisões terminais (inclusive cancelar); cortesia histórica sempre com o
  valor da fatura e data opcional; pagamento histórico **não** copia `externalTxid`/`externalChargeId` (únicos, usados na
  idempotência do webhook) — guardados em `metadata`; `countHistoricalReviewPending` inclui as "mantidas pendentes"
  (tudo que ainda não foi resolvido). A classificação da fila roda em memória (fuso por empresa) — adequado ao volume
  atual; migrar para SQL se crescer muito.
- **Gateway em fatura já quitada (F-D5)**: inclui fatura legada paga sem nenhum pagamento registrado (antes geraria
  receita e renovação de novo). Item de conciliação idempotente por txid + evento no ledger; sem receita, sem renovação.
- **Rollback**: o undo de `20261018120000` recusa reverter se houver pagamento com data desconhecida (não perde dados).
- **Integração (líder)**: routers registrados (simulação/status em lote antes das rotas parametrizadas); controller de
  pagamento passou a repassar `expectedCurrentDueDate` (defeito encontrado pelo QA: a revalidação existia no serviço mas
  o campo não chegava); item de menu "Revisão de históricas".

---

# Fechamento final pré-homologação (8.4 + 8.4-F)

## FF-D1 — Notificações financeiras do Super Admin (causa raiz e correção)
- **Causa raiz (confirmada em Postgres real migrado do zero):** as migrations `20260424100000-notification-center-phase6`
  e `20260428120000-user-notification-preferences-nullable-company` usaram `changeColumn(..., { allowNull: true, references })`.
  No Postgres, o Sequelize 5 gera para isso **apenas** `ALTER TABLE ... ADD FOREIGN KEY` (verificado gerando o SQL offline)
  e descarta o `DROP NOT NULL`. As colunas `UserNotifications.companyId` e `UserNotificationPreferences.companyId`
  continuaram `NOT NULL` (e ficou uma FK duplicada `UserNotifications_companyId_fkey1`, inofensiva).
- **Efeito:** notificações de plataforma (`companyId NULL`: renovação, reativação, avisos de cobrança ao Super Admin)
  falhavam no INSERT; `CreateUserNotificationService` captura e só loga → falha silenciosa. Preferências de âmbito
  plataforma do Super Admin também não podiam ser gravadas.
- **Modelo de escopo (inalterado):** `companyId NULL` = âmbito plataforma, criado só para `super`; usuário comum lista só
  `companyId = empresa do token` (NULL nunca aparece para tenant); Super Admin vê plataforma + empresa logada.
- **Correção mínima:** migration aditiva `20261019120000-notifications-nullable-company-scope` com
  `ALTER COLUMN "companyId" DROP NOT NULL` explícito nas duas tabelas (idempotente; down no-op intencional, pois voltar a
  NOT NULL reintroduziria o defeito). Nenhum código de notificações alterado; tickets/mensagens/atendimento intactos.
  A FK duplicada não foi removida (fora do necessário; registrada).

## FF-D2 — Datas de vencimento e fuso da empresa
- Achado da revisão: vencimentos são gravados como "YYYY-MM-DD" em `timestamptz` (meia-noite na sessão `-03:00`) e
  eram lidos no fuso da empresa → empresas a oeste de Brasília (Manaus, Rio Branco, Cuiabá) perdiam 1 dia por renovação.
- Correção: `toDomainDate` converte valores com horário no **offset de armazenamento** (`DB_STORAGE_UTC_OFFSET = "-03:00"`,
  igual a `config/database.ts`, verificado por teste); o fuso da empresa continua definindo "hoje".
- Distinção explícita entre duas semânticas (descoberta pelos próprios testes durante o fechamento):
  - **data de calendário gravada** (vencimentos, `Invoices.dueDate`) → `toDomainDate` (offset de armazenamento);
  - **instante real** (`createdAt` da fatura para a elegibilidade histórica, datas dos logs de renovação, `paidAt` do
    último pagamento) → `instantToDomainDate` (fuso da empresa). Aplicar a regra de armazenamento a instantes
    deslocaria a classificação da data de referência 17/10/2026 para empresas fora de São Paulo.
- O teste do motor de cobrança que afirmava a leitura antiga (vencimento em Manaus = dia anterior) foi atualizado para a
  regra correta; o teste de elegibilidade histórica por fuso foi mantido como estava (ele estava certo).

## FF-D3 — Demais correções da revisão de integração
- Pix confirmado pela Efí com o mesmo txid de uma baixa manual → conciliação "possível pagamento em duplicidade" (antes só log).
- Recorrência inválida no webhook → Pix registrado + conciliação "Pix registrado, assinatura não renovada" (antes: rollback e
  reenvio infinito pela Efí). Apenas para `ERR_INVALID_RECURRENCE`, lançado antes de qualquer escrita.
- Checagem de ciclo duplicado em faturas manuais sem `FOR UPDATE` (evita deadlock fatura→empresa × empresa→fatura;
  índice único segue como garantia, tratado como 409).
- CPF/CNPJ mascarado (últimos 4 dígitos) na auditoria `registration_update`.
- `GET /companies/:id` devolve `plan` e `primaryAdmin` para Super Admin (página da empresa mostrava "Sem plano").
- Fila histórica: estado `unresolved` (pendentes + mantidas pendentes) — contadores e listas passam a bater.
- Descrição de fatura pode ser limpa; mensagens legíveis para erros de cancelamento; rótulos pt-BR para eventos e
  conciliações; data "sem hora" no último pagamento; "data não informada" no financeiro global.

## FF-D4 — Pendências não impeditivas (registradas, não corrigidas)
- Settle Efí Cobranças roda antes de erros que podem reverter a baixa (pré-existente; flag `EFI_COBRANCAS_SETTLE_ENABLED` OFF).
- Controllers antigos aceitam `companyId` não numérico (500 em vez de 400; sem vazamento).
- Baixa manual aceita `paidAt` futuro; `MANUAL_PAYMENT_METHODS` não aplicado; ledger da cortesia grava o valor informado.
- `isAuth` não verifica usuário desativado até o token expirar (pré-existente, ~15 min).
- `/finance/summary` do tenant expõe contadores internos da própria empresa (históricas/cortesia).
- `canAccessSaasPlatform` no frontend aceita `profile=admin` sem empresa; backend recusa (401 → logout).
- FK duplicada em `UserNotifications`.
