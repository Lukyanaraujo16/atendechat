# Fase 8.3-B3 — Decisões

Organização:
- **§1 Fatos** — comprovados no código, não são escolhas.
- **§2 Recomendações técnicas** — propostas que detalham as decisões aprovadas.
- **§3 Decisões aprovadas** — decisões do responsável, com condições, justificativa, impacto e histórico das alternativas.
- **§4 Matriz** — decisão × etapa.
- **§5 Pendências técnicas** — o que ainda depende de validação, e não de decisão.
- **§6 Subdecisões financeiras** — SF-1…SF-3 aprovadas em 2026-10-20.
- **§9 Registro de fechamento do planejamento** (2026-10-20).
- **§7 Contradições registradas**.
- **§8 Regras transversais aprovadas**.

Nada aqui foi implementado.

**Registro de aprovação:** 2026-10-20, responsável pelo projeto:
- D-P1 a D-P17 → alternativa **A**, com os ajustes descritos em cada item;
- D-P18 → alternativa **B** (processamento assíncrono com persistência durável no PostgreSQL).

---

## 1. Fatos comprovados (herdados de B1/B2/8.4)

| ID | Fato | Evidência |
|----|------|-----------|
| F1 | Configuração Efí é **global da plataforma**, um registro por slot (`homologation`, `production`); sem `companyId`. | `models/PlatformEfiConfig.ts:24-43` |
| F2 | `STREAMHUB_RUNTIME_ENV` (`test`/`production`) define o único slot e ambiente de API permitidos; ausência bloqueia o resolvedor. | `config/streamhubRuntimeEnv.ts` |
| F3 | Segredos cifrados com AES-256-GCM, formato `efic1:`, chave `EFI_CREDENTIAL_ENCRYPTION_KEY` sem fallback. | `helpers/efiCredentialCrypto.ts` |
| F4 | P12 cifrado no banco é a fonte durável; o deploy não tem volume persistente para certificados. | `efiCertificateStore.ts:12-26` |
| F5 | O resolvedor lê **só o banco**, sem fallback para env (decisão B1). | `efiCredentialResolver.ts:16-23` |
| F6 | Escrita de segredo ou P12 invalida `lastAuthTestOk`, `adminEnabled` e `activatedAt`. | `PlatformEfiConfigAdminService.ts` (upsert/upload/delete) |
| F7 | O teste de conexão valida apenas OAuth Cobranças; Pix não é validado. | `testEfiAdminAuth` |
| F8 | Checkout, webhook e Cobranças continuam lendo env. | `config/Gn.ts`, `efiCobrancasClient.ts` |
| F9 | Idempotência de pagamento: índice único parcial `SaaSPayments.externalTxid`; renovação `renew-invoice:<invoiceId>`. | migration `20261013120000`, `confirmGatewayPayment.ts:214-281` (8.4 D3/D9) |
| F10 | Webhook responde 500 em falha de processamento para a Efí reenviar. | `SubscriptionController.ts:308-312` (8.4 D9) |
| F11 | Pix não tem baixa manual na Efí; baixa local abre conciliação `manual_pix_no_settle`. | `registerManualPayment.ts:237-245` (Matriz Marco 0) |
| F12 | Cancelar fatura não cancela a cobrança na Efí; o pagamento posterior é registrado. | `cancelSaasInvoice.ts`, 8.4 D11 |
| F13 | `isSuper` responde 401. | `middleware/isSuper.ts` (8.4, pendente 401×403) |
| F14 | `BILLING_AUTOMATION_NORMALIZED_DATES` ausente = modo legacy. Fora do escopo da B3. | `billingEvaluation.ts:256-265` |
| F15 | A fila instalada é **Bull 4** (`bull@^4.8.2`, lock `4.16.5`), não BullMQ (ausente do `package-lock.json`). As filas são criadas com `REDIS_URI` e processadas **no mesmo processo do backend** (`queues.ts:1424-1451`). | `backend/package.json:42`, `src/libs/knowledgeDocumentQueue.ts`, `src/queues.ts` |
| F16 | Agendamentos financeiros usam `node-cron` no processo do backend. | `jobs/billingAutomationScheduler.ts` |

---

## 2. Recomendações técnicas (detalham as decisões aprovadas)

Os itens marcados **(revisado 2026-10-20)** foram ajustados às decisões aprovadas. O texto original continua no histórico do respectivo D-P.

| ID | Recomendação | Motivo |
|----|--------------|--------|
| R-1 | Criar **um** provedor de credenciais (`getEfiRuntimeCredentials`) usado por checkout, webhook, consulta, registro de webhook e Cobranças. A fonte é escolhida por flag (D-P1). | Elimina as duas integrações paralelas; o rollback é trocar a flag. |
| R-2 | Cliente Pix próprio para o caminho `database`: axios + `https.Agent({ pfx: Buffer })` com o P12 em memória, timeout explícito, erros sanitizados, **sem gravar o certificado em disco**. O SDK continua só no `legacy_env`. As bases de URL e os contratos são confirmados na documentação oficial antes de fixar (PT-4). | D-P12. |
| R-3 | Cache de token OAuth por `(configId, updatedAt, ambiente)`, invalidado em toda escrita admin; nunca em escopo de módulo sem chave. | R14. |
| R-4 | txid local, **um por tentativa**: o retry da mesma tentativa reusa o txid; uma nova tentativa gera nova sequência. Prefixo + `invoiceId` + sequência, com padding até 26–35 alfanuméricos. `PUT /v2/cob/:txid`; repetição ou conflito → `GET /v2/cob/:txid` + conferência de valor e chave (PT-3). | D-P4. |
| R-5 | Reuso da cobrança ativa conferida na Efí. Nenhuma chamada Efí sob `FOR UPDATE`: reserva com commit → chamada fora do lock → atualização e revalidação. Tentativa `creating` órfã é recuperada via GET. | D-P4; R3. |
| R-6 | Localizar a fatura pelo txid; `#Fatura:` só como conferência e fallback legado. **O `solicitacaoPagador` `#Fatura:<id>` continua sendo gravado** em toda cobrança nova, para o pipeline legado conseguir processá-la após um rollback. | Compatibilidade de rollback. |
| R-7 | **(revisado 2026-10-20)** Persistência durável de cada notificação em `SaaSGatewayWebhookEvents` (PostgreSQL) **antes** do HTTP 200, com processamento assíncrono (ver R-22…R-30). | D-P9 + D-P18. |
| R-8 | Itens irrecuperáveis nunca são descartados: viram item de conciliação, ou registro classificado e visível (D-P8). | R4, R5. |
| R-9 | **(revisado 2026-10-20)** URL do webhook com um **token secreto de autenticação** em parâmetro novo, de nome provisório `whToken` (o nome final sai do PT-2). Comparação em tempo constante. `token` aceito durante a transição, tolerando o sufixo `/pix`. O formato definitivo (incluindo `ignorar=`) só é fixado após o PT-2. **Não** é uma assinatura HMAC. | D-P3. |
| R-10 | Registrar o webhook só por ação explícita do Super Admin, com `GET /v2/webhook/:chave` para conferir. | R7; ver C3. |
| R-11 | Resolver conciliação com nota, ator, ledger, lock e a mensagem original preservada. | R13. |
| R-12 | Varredura Pix Efí × local, só leitura na Efí, saída em conciliação, disparo manual atrás de flag. | D-P10. |
| R-13 | Cada `SaaSPaymentAttempt` grava fonte, `configId`, slot, ambiente e versão da aplicação. | Identificação da fonte que originou cada cobrança. |
| R-14 | **(revisado 2026-10-20)** Registro de homologação (`PlatformEfiConfigAudit` com ação `homologate`) associado a `configFingerprint`, slot, ambiente e versão da aplicação (commit). Os detalhes estão em D-P17. | D-P2, D-P17. |
| R-15 | Índice único parcial em `SaaSPaymentAttempts.externalTxid`. | RF3.3. |
| R-16 | `trust proxy` configurável (`TRUST_PROXY_HOPS`; ausente = comportamento atual) antes de controles por IP. A mudança é global e exige validação própria. | R22. |
| R-17 | Sentry `beforeSend` e logs sem a query string nem o header `Authorization` da rota de webhook. | R8, D-P3. |
| R-18 | Webhook secret gerado no servidor (≥ 32 bytes) ou com tamanho mínimo; nunca reexibido. | R23. |
| R-19 | Teste de conexão e ativação validam o P12 (`tls.createSecureContext`) e fazem OAuth Pix com mTLS. | F7, R17. |
| R-20 | Base Cobranças pelo ambiente do slot na fonte `database`. | R25. |
| R-21 | `EFI_CREDENTIAL_ENCRYPTION_KEY` distinta entre TESTE e PRODUÇÃO. | R24. |
| R-22 | **Recepção:** autenticar → validar a forma → numa transação, gravar cada item com `INSERT … ON CONFLICT (eventKey) DO NOTHING` → **commit** → HTTP 200. Erro de persistência → **503** (a Efí retenta). Nenhuma chamada à Efí e nenhuma dependência do Redis antes do 200. | D-P18 req. 1–3, 15, 18. |
| R-23 | **Chave de idempotência da recepção (`eventKey`):** `pix:<e2eId>` (com ou sem txid) · `devolucao:<e2eId>:<idDevolucao>:<status>` · `teste:<hash do corpo>`. Reentrega do mesmo evento → 200 sem nova linha. Só um corpo sem estrutura reconhecível recebe 400; um item inválido dentro do lote é persistido como `invalid_permanent`, e o lote não é rejeitado. | D-P18 req. 5, 12, 14. |
| R-24 | **Publicação na fila após o commit**, com `jobId = <id do evento>` e timeout curto. Falha ao publicar → o evento fica `received` e é recuperado (R-27). O status do evento nunca depende do job. | D-P18 req. 4, 16, 18. |
| R-25 | **Claim atômico no worker:** `UPDATE … SET status='processing', lockedBy, lockedAt, attempts=attempts+1 WHERE id=$1 AND status IN ('received','retry_scheduled') AND nextAttemptAt<=now() RETURNING *`. Zero linhas → outro worker já pegou ou o evento terminou → job encerrado sem efeito. | D-P18 req. 17. |
| R-26 | **Processamento:** consultar a cobrança na Efí com as credenciais da fonte que a criou (R-13; legado sem registro = conta env), validar e chamar `confirmGatewayPayment` (idempotente, inalterado exceto D-P6), depois gravar o resultado terminal e a referência (`paymentId`, `reconciliationItemId`). Um crash entre a confirmação e o registro do resultado leva a reprocessamento, que cai em replay. | D-P18 req. 5, 11, 12. |
| R-27 | **Recuperação (`node-cron`, a cada minuto):** (a) `received`/`retry_scheduled` vencidos e sem job ativo → republicar (mesmo `jobId`); (b) `processing` com `lockedAt` mais antigo que o limite (proposta: 10 min) → `retry_scheduled`; (c) conferência fila × banco: job sem evento ou com evento terminal → remover; evento não terminal sem job → republicar. Sempre idempotente. | D-P18 req. 7, 8. |
| R-28 | **Retentativas controladas:** falha transitória (rede, timeout, Efí 5xx/429, banco) → `retry_scheduled` com backoff exponencial (proposta: 1, 5, 15, 60, 360 min; máx. 8). Esgotou → `failed_exhausted` (terminal sem sucesso) + item de conciliação + destaque na tela. **Nunca** descartado. | D-P18 req. 6, 9, 12. |
| R-29 | **Falha permanente** (forma inválida após o 200, txid inexistente na conta, cobrança de outra chave) → `invalid_permanent`, evidência preservada; abre conciliação “notificação não verificável” se houver valor informado. Sem retentativa automática. | D-P18 req. 9. |
| R-30 | **Reprocessamento manual (Super Admin):** permitido para `failed_exhausted`, `invalid_permanent`, `unlinked` e `reconciliation`. Exige nota e é auditado; volta a `received` e percorre o mesmo pipeline idempotente. Evento `applied`/`replay` não é reprocessável. | D-P18 req. 10. |
| R-31 | **Payload persistido mínimo:** `e2eId`, `txid`, valor, horário, sufixo mascarado da chave, ids/valor/status de devolução e a fonte da credencial. **Não** persistir `infoPagador`, `gnExtras.pagador` (nome, CPF/CNPJ), cabeçalhos nem a query. | D-P18 req. 13. |
| R-32 | Flags de ativação independentes, todas com default **desligado** (ver §8.2). | D-P15, regras transversais. |
| R-33 | `EFI_WEBHOOK_WORKER_PAUSED=true` suspende o worker e a recuperação; a recepção durável continua. Eventos ficam `received` e são visíveis na tela. Retomar = desligar a flag; a recuperação (R-27) republica. | Rollback sem perda e sem recadastro (C4, D-P16). |

---

## 3. Decisões aprovadas

Formato de cada item: decisão aprovada · condições/ajustes · justificativa · impacto · histórico (alternativas consideradas).

### D-P1 — Fonte das credenciais ✅ APROVADA: A
- **Decisão:** flag `EFI_CREDENTIALS_SOURCE=legacy_env|database`, default `legacy_env`. Rollback = voltar a flag + restart.
- **Justificativa:** rollback imediato; preserva a decisão B1 de não fazer fallback (F5).
- **Impacto:** nenhum enquanto a flag estiver ausente.
- **Histórico:** B — banco com fallback para env (rejeitada: mascara erro e contradiz F5). C — corte direto (rejeitada: sem rollback).

### D-P2 — Ativação da configuração do banco ✅ APROVADA: A (ajustada)
- **Decisão:** separar **configuração válida** de **integração homologada**.
  - *Configuração válida:* `adminEnabled=true`, P12 que abre, OAuth Pix com mTLS ok, chave Pix e webhook secret presentes.
  - *Integração homologada:* registro de homologação (R-14/D-P17) cujo `configFingerprint`, slot e ambiente batem com a configuração atual.
- **TESTE (slot `homologation`):** com configuração válida, a fonte `database` pode operar de forma controlada antes da homologação final.
- **PRODUÇÃO (slot `production`):** exige configuração válida **e** integração homologada (D-P17, sem pagamento real).
- **Condições:**
  - Toda troca de segredo ou P12 invalida a homologação. O fingerprint muda, e isso já é coerente com F6.
  - Homologação antiga nunca vale para outra configuração.
  - `configFingerprint` = hash de (`slot`, `efiEnvironment`, `clientIdMasked`, `certificateFingerprint`, `pixKeyMasked`, versão dos segredos/`updatedAt` das colunas cifradas). Nunca inclui segredo em claro.
- **Justificativa:** torna `operational` alcançável sem um “ovo e galinha” em TESTE e mantém a exigência em PRODUÇÃO.
- **Impacto:** a regra de status precisa ser unificada (R18). O resolvedor deixa de exigir `operational` cegamente.
- **Histórico:** B — exigir `operational` também em TESTE (rejeitada: impossível homologar). C — `auth_validated` (rejeitada: valida só Cobranças).

### D-P3 — Autenticação do webhook ✅ APROVADA: A (ajustada)
- **Decisão:** **token secreto de autenticação** na URL (não é HMAC; o nome “hmac” não deve ser usado). Parâmetro novo de nome provisório `whToken`.
- **Condições:**
  - Compatibilidade temporária com `token`, tolerando o sufixo `/pix`.
  - Comparação em tempo constante (`crypto.timingSafeEqual`).
  - Logs, Sentry e observabilidade sanitizados: sem query e sem `Authorization` (R-17).
  - Antes de fixar a URL, verificar o contrato oficial da Efí em sandbox (PT-2), incluindo onde o `/pix` é inserido e se `ignorar=` funciona. **Não** assumir `ignorar=` sem essa validação.
  - Allowlist de IP opcional, que depende de `trust proxy` (R-16).
  - **mTLS** registrada como alternativa a avaliar conforme as exigências da Efí (PT-6).
- **Justificativa:** corrige R1 sem mexer no proxy; reduz a exposição do segredo.
- **Impacto:** a URL na Efí precisa ser recadastrada (R-10), o que tem dependência com C3.
- **Histórico:** B — mTLS no nginx (mantida como alternativa a avaliar, PT-6). C — manter `?token=` + `&ignorar=` (rejeitada como solução final; `token` fica só na transição).

### D-P4 — Cobrança por fatura ✅ APROVADA: A
- **Decisão:** reusar a cobrança ativa conferida na Efí; criar nova só após expirar ou ser removida (R-4, R-5).
- **Condições:** nenhuma chamada Efí sob lock; validar valor, chave, fonte e `configId` no reuso.
- **Impacto:** R3 resolvido para cobranças novas. Cobranças legadas abertas continuam pagáveis até expirar (1 h).
- **Histórico:** B — sempre nova, cancelando a anterior (rejeitada: corrida). C — manter N cobranças (rejeitada).

### D-P5 — Expiração ✅ APROVADA: A
- **Decisão:** manter 3600 s. Cobranças legadas sem `expiresAt` contam como expiradas 1 h após a criação.
- **Histórico:** B — até o fim do dia do vencimento. C — configurável.

### D-P6 — Pix pago em fatura cancelada ✅ APROVADA: A (ajustada)
- **Decisão:**
  - Registrar o **recebimento** de forma idempotente: por txid (índice único) e por fatura (um 2º txid vira conciliação de duplicidade).
  - **Preservar `status = cancelled`**; não reabrir a fatura.
  - **Não renovar** automaticamente.
  - Abrir conciliação “pagamento em fatura cancelada”.
  - Preservar a rastreabilidade: evento no ledger com txid, e2eId, valor e fonte.
- **Condições:**
  - **Evitar receita definitiva duplicada.** Contabilização conforme **SF-1 (aprovada)**: o recebimento não entra na receita consolidada até a conciliação (§6).
  - Com fatura substituta: conforme **SF-2 (aprovada)**, conciliação manual obrigatória, sem aplicação automática à substituta (§6).
  - Não colidir com `invoices_company_cycle_unique`: a fatura não muda de status, então não há colisão.
  - O ramo novo só executa quando `confirmGatewayPayment` é chamado pelo pipeline `async` (parâmetro explícito). O legado não muda (D-P15).
- **Justificativa:** o dinheiro recebido nunca é perdido, e a assinatura não é estendida sem decisão humana.
- **Impacto:** altera o comportamento descrito na 8.4 D11 (“o webhook registrará o pagamento” → reabria a fatura e renovava). Por isso só vale com o pipeline novo ativo (§8.2).
- **Histórico:** B — reabrir e renovar (rejeitada: 500 em loop com substituta, renovação dupla). C — só conciliação, sem registrar o recebimento (rejeitada).

### D-P7 — Devolução Pix ✅ APROVADA: A
- **Decisão:** detectar e abrir conciliação “devolução Pix”, sem estorno automático de receita ou assinatura. Idempotente por `devolucao:<e2eId>:<id>:<status>`.
- **Histórico:** B — estorno automático (rejeitada: alto risco).

### D-P8 — Pix sem txid ✅ APROVADA: A (ajustada)
- **Decisão:** responder 200 **somente após a persistência durável** (R-22).
- **Classificação no worker:**
  - **Comprovadamente fora do SaaS** (ex.: Pix enviado pela conta, `tipo` de envio, ou não recebido na chave do slot) → `ignored_not_saas`, sem pendência financeira.
  - **Origem indeterminada** (Pix recebido na chave sem txid, que pode ser um cliente pagando pela chave) → `unlinked`, com evidência preservada, visível no filtro “sem vínculo”. O Super Admin pode converter em item de conciliação ou marcar “não é SaaS” com nota (auditado).
- **Justificativa:** sem conciliação desnecessária e sem perda de evidência.
- **Histórico:** B — sempre abrir conciliação (rejeitada: ruído).

### D-P9 — Persistência de webhooks ✅ APROVADA: A
- **Decisão:** tabela `SaaSGatewayWebhookEvents` (migration aditiva) com payload mínimo (R-31). Incorporada como fonte durável do pipeline D-P18.
- **Histórico:** B — só logs (rejeitada).

### D-P10 — Varredura Efí × local ✅ APROVADA: A
- **Decisão:** disparo manual pelo Super Admin, sem agendamento. Habilitado por `EFI_PIX_RECONCILIATION_SWEEP_ENABLED` (default `false` → 403). Só leitura na Efí; saída em conciliação.
- **Histórico:** B — só consulta por txid.

### D-P11 — Comunicação antes da ativação ✅ APROVADA: A
- **Decisão:** antes de ativar o pipeline novo em produção, fazer um levantamento só leitura das faturas com `externalTxid` e baixa manual, e avisar o financeiro.
- **Impacto:** os Pix pagos passam a renovar sozinhos; reenvios da Efí caem em replay ou em conciliação.
- **Histórico:** B — ativar sem levantamento (rejeitada).

### D-P12 — Cliente Pix ✅ APROVADA: A (ajustada)
- **Decisão:** cliente próprio no caminho `database`.
- **Condições obrigatórias:**
  - mTLS com P12 **em memória**;
  - timeout explícito;
  - tratamento de erros tipado;
  - sanitização de credenciais;
  - testes de falha de rede;
  - **verificação dos contratos atuais da API** antes de fixar URLs e formatos (PT-3, PT-4);
  - **nenhuma gravação temporária de certificado**.
- O SDK antigo fica só para compatibilidade com `legacy_env` durante a transição.
- **Histórico:** B — atualizar o SDK oficial (rejeitada: mantém o path em disco; nome/versão não verificados).

### D-P13 — Rotação da chave de cifra ✅ APROVADA: A (ajustada)
- **Decisão:** fora do escopo da B3. Procedimento seguro documentado para uma fase futura (abaixo).
- **Condição:** fica **proibido** substituir `EFI_CREDENTIAL_ENCRYPTION_KEY` sem estratégia de recuperação e recifragem. Uma troca simples torna todas as credenciais e o P12 indecifráveis (`ERR_EFI_CREDENTIAL_DECRYPT_FAILED`) e para o Pix na fonte `database`.
- **Procedimento futuro (não executar na B3):**
  1. Introduzir o formato `efic2:<kid>:` com identificador de chave. A leitura aceita `efic1` (chave atual) e `efic2` (chaves por `kid`).
  2. Backup do banco e cópia segura da chave atual, sob custódia definida.
  3. Configurar a chave nova **junto** com a antiga (as duas legíveis).
  4. Recifrar todas as colunas `*Encrypted` e o P12 numa transação por slot; conferir que cada valor decifra e que o fingerprint do P12 é igual ao anterior.
  5. Teste de conexão Pix/Cobranças com o resultado.
  6. Só então retirar a chave antiga, depois de um período de observação.
  7. Auditoria com ator, sem valores.
- **Histórico:** B — implementar `efic2` na B3.1 (adiada).

### D-P14 — Conta/chave Pix na troca ✅ APROVADA: A
- **Decisão:** na primeira ativação da fonte `database`, mesma conta Efí e mesma chave Pix do env.
- **Impacto:** as cobranças abertas e o webhook continuam válidos com as duas fontes.
- **Histórico:** B — trocar de conta junto (rejeitada).

### D-P15 — Correções no fluxo legado ✅ APROVADA: A (ajustada)
- **Decisão:** as correções de segurança financeira contemplam `legacy_env` **e** `database`.
- **Condições:**
  - **Não alterar silenciosamente** o comportamento financeiro de produção: cada grupo de correção tem **controle de ativação independente** (§8.2), com default desligado.
  - Exige testes de regressão 8.4, plano de rollback, compatibilidade com as cobranças existentes e **ativação explícita após homologação**.
  - No `legacy_env`, o cadastro admin do webhook usa o SDK (`pixConfigWebhook`) com as credenciais env.
- **Justificativa:** corrigir R1/R3/R4/R5/R6 em produção sem depender do corte de credenciais, sob controle.
- **Histórico:** B — corrigir só na fonte `database` (rejeitada: os defeitos ficariam ativos no legado).

### D-P16 — URL do webhook no rollback ✅ APROVADA: A
- **Decisão:** a rota aceita o token novo e `token` (com tolerância ao `/pix`) nas duas fontes de credenciais. Com o pipeline `async`, a URL nova continua válida após um rollback **de fonte de credenciais**. O rollback **do pipeline** segue C4: pausa preferencial (R-33) ou volta ao legado com recadastro da URL.
- **Histórico:** B — recadastrar no rollback.

### D-P17 — Homologação ✅ APROVADA: A (ajustada)
- **Decisão:** evidência verificável do ciclo **cobrança → pagamento → webhook → baixa → renovação**, associada à configuração (`configFingerprint`), ao ambiente e à versão (commit) homologados.
- **Procedimento:**
  1. **TESTE (slot `homologation`):** ciclo completo no sandbox. O registro `homologate` grava os ids do evento de webhook (`SaaSGatewayWebhookEvents`), do `SaaSPayment` (`source=gateway`), da renovação, do `configFingerprint`, do ambiente `sandbox` e do commit. Isso vale como evidência funcional da versão.
  2. **PRODUÇÃO (slot `production`):** **sem pagamento real** como pré-requisito. A habilitação exige:
     - (a) referência ao relatório de homologação aprovado em TESTE para o **mesmo commit**;
     - (b) configuração válida (D-P2) no slot de produção;
     - (c) webhook cadastrado e conferido por `GET /v2/webhook/:chave`;
     - (d) evento de teste recebido e persistido pelo endpoint de produção, se a Efí enviar um evento de teste no cadastro (**PT-7**). Se não enviar, o item (d) é substituído por uma chamada autenticada controlada ao endpoint, que deve ficar persistida como `teste`.
     - O registro `homologate` grava (a)–(d), com o `configFingerprint` e o commit.
  3. Qualquer troca de segredo ou P12 invalida o registro.
  4. Um deploy com outro commit **não** desabilita a integração automaticamente (isso seria uma mudança silenciosa em produção). O status passa a exibir “versão atual difere da homologada” (PT-9).
- **Histórico:** B — só confirmação manual (rejeitada). O texto anterior da A exigia um `SaaSPayment` do próprio slot, o que forçaria pagamento real em produção — **substituído** por este procedimento.

### D-P18 — Processamento do webhook ✅ APROVADA: B (assíncrono, persistência durável)
- **Decisão:** fluxo
  `Efí → endpoint → validação de autenticidade → persistência PostgreSQL → commit confirmado → HTTP 200 → fila/worker → validação financeira → confirmação do pagamento → renovação → registro do resultado`.
- **Requisitos obrigatórios aprovados** (mapeados para R-22…R-31):

| # | Requisito | Onde |
|---|-----------|------|
| 1 | PostgreSQL é a fonte durável | R-22, D-P9 |
| 2 | Nunca 200 antes do commit | R-22 |
| 3 | Persistência falhou → erro (503) para a Efí retentar | R-22 |
| 4 | Fila só para processamento, não armazenamento | R-24 |
| 5 | Idempotência na recepção e no processamento | R-23, R-25, R-26 |
| 6 | Retentativas controladas | R-28 |
| 7 | Recuperação após falha/reinício | R-27 |
| 8 | Reconciliação eventos × jobs | R-27(c) |
| 9 | Transitório × permanentemente inválido | R-28, R-29 |
| 10 | Consulta e reprocessamento manual auditado | R-30, RF3.16, RF3.19 |
| 11 | Sem renovação duplicada | `renew-invoice:<id>` (F9) + R-26 |
| 12 | Sem descarte de pagamento confirmado | R-8, R-28 |
| 13 | Payload sem dados sensíveis desnecessários | R-31 |
| 14 | Duplicados, fora de ordem, baixa manual prévia, cobranças pré-migração | R-23, R-26, R-6 |
| 15 | 200 = recebimento durável, não pagamento processado | R-22 |
| 16 | Falha ao publicar após gravar → pendente e recuperado | R-24, R-27 |
| 17 | Sem execução concorrente do mesmo evento | R-25 |
| 18 | Aceitar notificação válida sem depender do Redis | R-22, R-24 |

- **Condição:** “BullMQ” na decisão aprovada × Bull 4 instalado (F15) → **PT-1 / C1, resolvida em 2026-10-20: Bull 4**, sem instalar BullMQ.
  O PostgreSQL é a fonte durável dos eventos; a fila Bull 4 só transporta jobs. Fluxo: webhook → PostgreSQL → HTTP 200 → Bull 4 → worker → confirmação financeira.
- **Impacto:**
  - substitui o orçamento síncrono de 30 s (RF3.2a original) e o “500 por item transitório” da tabela RF3.4 original;
  - a responsabilidade de retentar passa da Efí para o sistema (R-28);
  - a recuperação (R-27) é obrigatória para não perder eventos.
- **Histórico:** A — síncrono com orçamento de tempo (rejeitada pelo responsável). O texto anterior da B dizia “BullMQ já existe” — **incorreto** (F15).

### Herdadas da 8.4 (não decididas aqui)
- 401 × 403 em `isSuper` (F13).
- Ativação de `BILLING_AUTOMATION_NORMALIZED_DATES` (F14) — **deve continuar ausente**.

---

## 4. Matriz decisão × etapa (fonte única)

Todas as decisões D-P1…D-P18 estão aprovadas. A coluna da direita lista o que ainda precisa estar resolvido antes de iniciar cada etapa.

| Etapa | Decisões que se aplicam | Bloqueios antes de iniciar |
|-------|-------------------------|----------------------------|
| B3.1 | D-P1, D-P2, D-P12, D-P13, D-P14, D-P17 (fingerprint/commit) | PT-4 (contratos/bases Pix), PT-9 (origem do commit em runtime, usado em RF1.6/RF2.4/T-HOM) |
| B3.2 | D-P3 (formato da URL), D-P4, D-P5, D-P15, D-P16 | PT-2, PT-3, PT-5 (validação em sandbox, que pode ser a tarefa 0 da etapa), C3 |
| B3.3 | D-P6, D-P7, D-P8, D-P9, D-P10, D-P18, SF-1, SF-2, SF-3 | PT-6 (mTLS), PT-8 (dedupe de `jobId` no Bull 4), PT-10 (retenção). PT-1, SF-1, SF-2 e SF-3 resolvidos em 2026-10-20 |
| B3.4 | D-P11 (antes da promoção), D-P17 (procedimento) | PT-7, PT-12 (troca de secret na mudança de fonte), C7 (plano candidato de ativação em produção: validar no H-36 e aprovar depois) |

AUDITORIA, ROADMAP e HOMOLOGACAO remetem a esta tabela.

---

## 5. Pendências técnicas (validação, não decisão)

| ID | Pendência | Como resolver | Bloqueia |
|----|-----------|---------------|----------|
| PT-1 | ✅ **RESOLVIDA (2026-10-20): Bull 4**, já instalado. Não instalar BullMQ. Histórico: a decisão citava BullMQ; o projeto tem Bull 4 (F15); BullMQ seria dependência nova (RNF3). | Arquitetura R-22…R-31 inalterada sobre Bull 4. A indisponibilidade do Redis não perde eventos persistidos: recuperação de pendentes (R-27), retentativas (R-28) e claim atômico contra concorrência (R-25). Detalhe residual do Bull 4: PT-8. | — |
| PT-2 | 🟡 **PARCIAL na B3.2 (2026-10-20) — documentação oficial conferida; sandbox pendente.** Fonte: dev.efipay.com.br/docs/api-pix/webhooks. Confirmado: (a) “o caminho `/pix` será acrescentado ao final da URL cadastrada”; (b) `?ignorar=` ao final da URL evita o sufixo (exemplo oficial `?hmac=xyz&ignorar=`); (c) a Efí **envia notificação de teste ao cadastrar** (responde também o PT-7 em nível de documentação); (d) callbacks exigem 2XX, timeout de 60 s, até 9 novas tentativas (5, 5, 5, 10, 20, 40, 80, 160 min) e reenvio manual por `POST /v2/gn/webhook/reenviar` por 30 dias; (e) o receptor é protegido por mTLS (cadastro sem mTLS → 400), e o SDK atual envia `x-skip-mtls-checking`. **Inferência não comprovada:** com a URL atual `…/webhook?token=SECRET`, o `/pix` vira parte do valor do `token` (R1). **Falta (sandbox):** capturar path e query reais recebidos com e sem `ignorar=`. | Sem impacto na B3.2: o cadastro admin usa o formato atual (RF2.7). O formato novo é da B3.3. Validação: tarefa 0 em TESTE (P-B32-01). | B3.3 (URL nova) |
| PT-3 | 🟡 **PARCIAL na B3.2 (2026-10-20) — documentação oficial conferida; sandbox pendente.** Fonte: dev.efipay.com.br/docs/api-pix/cobrancas-imediatas. Documentado: `PUT /v2/cob/:txid` com txid já usado → **409 `txid_duplicado`** (“Campo txid informado já foi utilizado em outra cobrança”); erros no formato `{ nome, mensagem }`; 400 `valor_invalido`/`chave_invalida`/`documento_bloqueado`; 429; 500 `erro_aplicacao`. **Não documentado:** se o PUT repetido com o mesmo corpo devolve a cobrança (200) ou 409. | Implementação cobre os dois casos sem assumir nenhum: 409 → GET + comparação de valor, chave e `#Fatura:`; repetição que devolve 200 também é conferida. Falta confirmar em sandbox (P-B32-01) e o `nome` do 404 do GET pelo SDK (P-B32-03). | — |
| PT-4 | ✅ **RESOLVIDA na B3.1 (2026-10-20)** — fonte: dev.efipay.com.br/docs/api-pix/credenciais. Bases Pix: produção `https://pix.api.efipay.com.br`, homologação `https://pix-h.api.efipay.com.br` (os domínios `gerencianet` do SDK ficam só no `legacy_env`). OAuth: `POST /oauth/token`, Basic `client_id:client_secret`, corpo `{"grant_type":"client_credentials"}`, mTLS com o P12 obrigatório no OAuth e em todas as chamadas, `expires_in` (3600 s no exemplo). Escopos (`cob.write`, `cob.read`, `pix.read`, `webhook.write`, `webhook.read`…) são habilitados na aplicação Efí, não pedidos no OAuth. P12 convertido sem senha. | Implementado em `efiPixClient.ts` (`EFI_PIX_BASE_URLS`, `EFI_PIX_OAUTH_PATH`). Os escopos necessários à B3.2/B3.3 serão conferidos no sandbox (B3.4). | — |
| PT-5 | 🟡 **PARCIAL na B3.2 (2026-10-20).** A documentação oficial deixa o nome livre (“crie uma identificação própria… e acrescente-a como parâmetro na URL”; exemplo `hmac`). D-P3 proíbe chamar de `hmac` (não é HMAC). Nome adotado: **`whToken`**, usado só no formato novo (pipeline `async`, B3.3). | Falta confirmar em sandbox que a Efí preserva o parâmetro na notificação (com `ignorar=`), junto com o PT-2. | B3.3 |
| PT-6 | Exigência de mTLS no webhook: a Efí aceita `x-skip-mtls-checking` de forma permanente? | Documentação oficial + suporte Efí. Se for obrigatório, reabrir D-P3 B. | B3.3 |
| PT-7 | A Efí envia evento de teste ao cadastrar o webhook? | Sandbox (PT-2). | B3.4 / produção |
| PT-8 | Retentativa de publicação: o Bull 4 deduplica `jobId` de job concluído e removido (`removeOnComplete`)? | Teste local. R-27 já protege pelo status no banco. | B3.3 |
| PT-9 | ✅ **RESOLVIDA na B3.1 (2026-10-20; revisada no fechamento técnico)**. Fonte principal: `dist/build-info.json`, gravado por `backend/scripts/write-build-info.js` no fim de `npm run build` a partir do checkout git compilado (`git rev-parse HEAD` + booleano `dirty`). Fallback: env (`GIT_COMMIT`, `COMMIT_SHA`, `GIT_SHA`, `BACKEND_BUILD_STAMP`). Só SHA hexadecimal de 7 a 40 caracteres; senão `null`. Lido uma vez no boot; sem git em runtime. Comparação por prefixo (`isSameAppCommit`); `null` nunca é igual. | `config/appBuildInfo.ts`; status `version.{currentCommit, source, dirty, builtAt}` e `homologation.versionDiffers`. Ver P-B31-01. | — |
| PT-10 | Retenção de `SaaSGatewayWebhookEvents` (proposta: indefinida para eventos com efeito financeiro **e para eventos referenciados por um registro `homologate`**; 180 dias para os demais `teste`/`ignored_not_saas`). | Confirmar com o responsável (afeta LGPD e volume). | B3.3 |
| PT-11 | Limites de backoff/tentativas (R-28) e do lock antigo (R-27) são propostas. | Ajustar na B3.3 com teste de carga simples. | — |
| PT-12 | Na troca `legacy_env` → `database`, o secret do webhook muda (env → slot). A URL cadastrada com o secret antigo passa a ser recusada. | Opções técnicas: (a) recadastrar o webhook logo após o restart (a Efí retenta por cerca de 5 h); (b) aceitar os dois secrets durante uma janela de transição configurada. Validar na B3.4 (H-36). | B3.4 |

## 6. Subdecisões financeiras (aprovadas em 2026-10-20)

Tabela 1: alternativas e recomendações originais (histórico). Tabela 2: decisão aprovada.

| ID | Questão | Alternativas | Recomendação |
|----|---------|--------------|--------------|
| SF-1 | Recebimento em fatura cancelada (D-P6): conta como receita? | (a) `countsAsRevenue=false` até a conciliação; o operador decide aplicar, devolver ou reconhecer. (b) `countsAsRevenue=true` imediato, com risco de duplicar se for aplicado à substituta. | (a). Evita receita definitiva duplicada. O dashboard mostra o valor como “recebido em conciliação”. → aprovada como SF-1 abaixo. |
| SF-2 | Como “aplicar à fatura substituta” na conciliação: hoje não existe operação para mover um pagamento entre faturas. | (a) Fora da B3: resolução manual com baixa na substituta (sem receita dupla, conforme SF-1 a). (b) Criar uma operação de realocação. | Histórico. Aprovado abaixo: conciliação manual na B3, sem aplicação automática; operação de aplicação à substituta em fase futura. |
| SF-3 | Pix `CONCLUIDA` cujo e2eId já tem devolução registrada (devolução processada antes ou junto). | (a) Não aplicar: evento `reconciliation`, sem pagamento nem renovação, até decisão do operador. (b) Aplicar normalmente (pagamento + renovação) e manter a conciliação da devolução. | (a). Evita renovar uma assinatura cujo dinheiro já foi devolvido. → aprovada como SF-3 abaixo. |

| ID | Decisão aprovada (2026-10-20) |
|----|-------------------------------|
| SF-1 | Pagamento em fatura cancelada: registrar o recebimento de forma idempotente; preservar a rastreabilidade financeira; **não incluir na receita consolidada até a conciliação**; não renovar a assinatura automaticamente; preservar a fatura cancelada. |
| SF-2 | Pagamento em fatura cancelada **com fatura substituta**: exigir conciliação manual; não aplicar automaticamente à substituta; não renovar automaticamente; preservar a auditoria da decisão. A operação específica de aplicação à substituta fica para fase futura. |
| SF-3 | Pix associado a pagamento já devolvido: registrar evidência; abrir conciliação; não renovar automaticamente; não executar estorno ou compensação automática. |

## 7. Contradições registradas

| ID | Contradição | Tratamento |
|----|-------------|------------|
| C1 | A decisão D-P18 cita BullMQ; o repositório usa Bull 4 e a fase proíbe instalar dependências. | ✅ Resolvida (PT-1, 2026-10-20): Bull 4. A documentação passa a citar só Bull 4. |
| C2 | O plano anterior (HOMOLOGACAO §9.6, D-P17 A original) exigia um ciclo real em produção para `pixHomologated`. O ajuste aprovado proíbe exigir pagamento real em produção. | Substituído pelo procedimento D-P17 (2). HOMOLOGACAO e TESTES atualizados. |
| C3 | Enquanto o checkout legado chama `pixConfigWebhook` a cada pagamento, ele **sobrescreve** a URL cadastrada pelo Super Admin. | O cadastro admin do webhook só fica disponível com `EFI_PIX_CHARGE_V2_ENABLED=true` (que remove o recadastro do checkout), ou a remoção do recadastro vira correção própria. Dependência registrada no ROADMAP B3.2. |
| C4 | A tolerância ao `/pix` no pipeline **legado** passaria a aceitar notificações hoje rejeitadas (R1) e a processá-las com os defeitos R4/R5/R6, o que mudaria o comportamento financeiro sem a flag. Mas D-P16 pede que a URL nova continue válida no rollback. | A autenticação nova (token novo + tolerância ao `/pix`) **só vale com `EFI_WEBHOOK_PIPELINE=async`**; com `legacy`, fica como hoje. Para cumprir D-P16 sem processar no legado, o rollback **preferencial** do pipeline é **pausar o processamento** (`EFI_WEBHOOK_WORKER_PAUSED=true`, R-33): a recepção durável continua respondendo 200, os eventos se acumulam no PostgreSQL e são processados ao retomar. O rollback total (`legacy`) só vem acompanhado do recadastro da URL antiga. Os dois estão no checklist de rollback. |
| C5 | O PRD dizia “compatível com uma única réplica”, e o worker roda no processo do backend (F15). | O claim atômico (R-25) garante a segurança com N processos; a operação continua com uma réplica. |
| C7 | A ordem sugerida para produção (`database` primeiro) conflita com as dependências: o `homologate` de produção exige evento `teste` persistido (pipeline `async`) e webhook conferido (cadastro só com v2, C3); o slot `production` com a fonte `database` exige `homologate` (D-P2); a URL nova só funciona com `async` (C4). | **PLANO CANDIDATO** (registrado em 2026-10-20), **não autorizado para execução**: depende da validação em TESTE (H-36) e de aprovação posterior na promoção (B3.4): (1) deploy no default; (2) `EFI_PIX_CHARGE_V2_ENABLED=true` com `legacy_env` (cadastro na URL atual); (3) `EFI_WEBHOOK_PIPELINE=async` + cadastro da URL nova; (4) slot `production` + `homologate` (evento `teste` recebido pelo pipeline `async`); (5) `EFI_CREDENTIALS_SOURCE=database` com tratamento do PT-12. H-36 ensaia essa ordem em TESTE. |
| C6 | A RF3.2 anterior deduplicava só por resultado terminal (para não perder eventos no modelo síncrono). | Com persistência durável antes do 200, o dedupe passa a ser na **recepção** (R-23); a garantia de processamento vem de R-27/R-28. |

## 8. Regras transversais aprovadas

### 8.1 Princípios
- **Implementar não significa ativar.** Concluir a B3.1, a B3.2 ou a B3.3 não autoriza alterar o fluxo financeiro ativo.
- A ativação é explícita, controlada e posterior à homologação necessária.
- Preservar a compatibilidade com as cobranças abertas e identificar a fonte de credenciais de cada cobrança (R-13).
- Nada de duplicidade financeira, renovação indevida ou descarte de notificação de pagamento.
- `BILLING_AUTOMATION_NORMALIZED_DATES` continua ausente. Nenhuma mudança em bloqueio automático.

### 8.2 Controles de ativação (default = comportamento atual)

| Controle | Default | Ativa | Etapa |
|----------|---------|-------|-------|
| `EFI_CREDENTIALS_SOURCE` | `legacy_env` | `database` | B3.1 |
| `EFI_PIX_CHARGE_V2_ENABLED` | `false` | txid local, reuso, checkout sem `pixConfigWebhook`, cadastro admin do webhook (C3; formato novo da URL só com `async`) | B3.2 |
| `EFI_WEBHOOK_PIPELINE` | `legacy` | `async`: autenticação nova + tolerância ao `/pix` (C4), persistência, fila/worker, tabela de resultados, D-P6, D-P7, D-P8 | B3.3 |
| `EFI_WEBHOOK_WORKER_PAUSED` | `false` | suspende o processamento, mantendo a recepção (R-33) | B3.3 |
| `EFI_PIX_RECONCILIATION_SWEEP_ENABLED` | `false` | varredura manual | B3.3 |
| `TRUST_PROXY_HOPS` | ausente | `trust proxy` (global) | B3.3 |

Entregáveis **sem efeito no fluxo financeiro**, que podem ser entregues sem controle, desde que com testes:
- sanitização de logs e Sentry (R-17);
- status/diagnóstico;
- consulta de txid só leitura;
- resolução de conciliação auditada (R-11);
- paginação da fila;
- validação de P12 e OAuth Pix no teste de conexão.

Alterar o contrato de `POST /saas/finance/reconciliation/:id/resolve` (nota obrigatória) muda a API admin, não o fluxo financeiro.

---

## 9. Registro de fechamento do planejamento (2026-10-20)

Decisões registradas nesta revisão, aprovadas pelo responsável:
- **PT-1:** Bull 4 (já instalado). BullMQ não é instalado. Fluxo: webhook → PostgreSQL → HTTP 200 → Bull 4 → worker →
  confirmação financeira. O PostgreSQL é a fonte durável; Redis indisponível não perde eventos persistidos (R-24, R-27).
  Recuperação de pendentes (R-27), retentativas (R-28) e proteção contra concorrência (R-25) seguem obrigatórias.
- **SF-1, SF-2, SF-3:** §6.
- **Ativação em produção (C7):** registrada como **PLANO CANDIDATO**, não autorizado para execução:
  1. cobrança v2 com as credenciais atuais (`legacy_env`);
  2. pipeline assíncrono e URL corrigida;
  3. homologação administrativa de produção, sem pagamento real;
  4. troca para as credenciais do banco (`database`), com tratamento do PT-12.
  Depende da validação em TESTE (H-36) e de aprovação posterior.

Estado na data do fechamento: B3.1, B3.2, B3.3 e B3.4 **NÃO INICIADAS**. A B3.1 foi executada depois (§10).

---

## 10. Registro da B3.1 — decisões técnicas de implementação (2026-10-20)

Decisões de implementação tomadas dentro das decisões aprovadas (nenhuma decisão financeira foi reinterpretada).

| ID | Decisão | Motivo |
|----|---------|--------|
| B31-T1 | `configFingerprint` = sha256 de slot, ambiente, máscaras, fingerprint do certificado e do **sha256 de cada coluna cifrada** (não do texto claro). | Hash do texto claro permitiria força bruta da chave Pix. Efeito: qualquer recifragem (D-P13) muda o fingerprint e exige nova homologação. |
| B31-T2 | `adminEnabled=true` passa a significar “P12 abriu e OAuth Pix com mTLS passou na ativação”. A ativação refaz os testes, trava a linha (`SELECT … FOR UPDATE`) e confere o fingerprint; mudança no meio → 409 `ERR_EFI_CONFIG_CHANGED_DURING_ACTIVATION`. Qualquer gravação de segredo/P12 zera `adminEnabled` (F6, já existente). | Regra D-P2 “configuração válida”. **Complementada por B31-T16:** `adminEnabled` sozinho não basta (ativações da B2). |
| B31-T3 | Configuração válida = `adminEnabled` + P12 + Client ID/Secret + chave Pix + webhook secret, sem revogação (`evaluateEfiConfigReadiness`). Slot `production` exige ainda registro `homologate` com mesmo fingerprint e ambiente (`findEfiHomologationForConfig`). | D-P2/D-P17. O registro `homologate` só é criado na B3.3; a fonte `database` fica inutilizável em produção por construção. |
| B31-T4 | Status unificado `derivePlatformEfiConfigStatus`, usado pelo admin e pelo resolvedor. A exigência cega de `operational` foi removida do resolvedor. | Tarefa 3 (R18). Status persistidos inalterados. |
| B31-T5 | Validação do P12 por abertura real (`tls.createSecureContext`, senha vazia) no upload, no teste de conexão, na ativação e no uso. | **Defeito B2 corrigido:** a heurística por OID exigia `06 08 2a86…`, mas os OIDs PKCS reais têm 9 bytes (`06 09`); P12 reais eram recusados no upload. |
| B31-T6 | Removida `materializeEfiCertificateToRuntimePath` (gravava o P12 em disco). Mantida `revokeEfiCertificateRuntimeFile` para limpar sobras. | Regra 11; D-P12 (P12 só em memória). |
| B31-T7 | Cliente Pix próprio (`efiPixClient.ts`): `https.Agent({ pfx })`, OAuth com cache por `db:<configId>:<updatedAt>:<ambiente>`, invalidação em toda ação admin, teto total por `AbortSignal.timeout` (15 s OAuth, 20 s chamada), erros tipados `ERR_EFI_PIX_TIMEOUT` (504), `ERR_EFI_PIX_AUTH_FAILED`, `ERR_EFI_PIX_HTTP_ERROR`, `ERR_EFI_PIX_NETWORK` (502), mensagens redigidas. | D-P12. O `timeout` do axios cobre só ociosidade do socket. |
| B31-T8 | `efiCobrancasClient`: cache de token por credencial; na fonte `database`, credencial e base vêm do slot. Também no `legacy_env`, OAuth e chamadas ganharam teto total (20 s / 30 s). | Antes uma conexão pendurada travava o settle sem limite. É a única mudança de comportamento no caminho default; só afeta o settle Cobranças (`EFI_COBRANCAS_SETTLE_ENABLED`), não checkout, webhook, confirmação ou renovação. |
| B31-T9 | `getEfiIntegrationStatus` passou a ser assíncrono e expõe `controls`, `version.currentCommit` e `credentialsSource` (fonte ativa, prontidão, fingerprint, homologação, `usable`, `blockedReason`). Falha de banco no status → `ERR_EFI_STATUS_DB_UNAVAILABLE`, sem 500. | Tarefa 9, RF1.6. |
| B31-T10 | Chave de auditoria do teste de conexão `pixPfxOpened` (não `pixCertificateValid`). | O sanitizador de auditoria redige chaves com “certificate”/“p12”. |
| B31-T11 | Tipo `"homologate"` acrescentado a `PlatformEfiConfigAudit.action` (só tipo TS; sem migration, a coluna é texto). A ação que cria o registro fica para a B3.3. | Leitura do registro na B3.1 (D-P2). |
| B31-T12 | Webhook secret mínimo de 32 caracteres na gravação (`ERR_EFI_WEBHOOK_SECRET_TOO_SHORT`, 400). Geração no servidor não implementada. | Tarefa 7 aceita “ou”. |
| B31-T13 | A ativação consome o mesmo rate limit do teste de autenticação (`assertEfiAuthTestRateLimit`). | Ativação chama a Efí. |
| B31-T14 | Controles lidos em `getEfiActivationControls()`; valor inválido → default + lista `invalid` + aviso no log de boot. Na B3.1 só `EFI_CREDENTIALS_SOURCE` é consumido (pelo provedor); os demais são lidos e expostos. | RF0. |

| B31-T15 | Versão em runtime (P-B31-01): `npm run build` grava `dist/build-info.json` (`commit`, `commitSource`, `dirty`, `builtAt`) com `git -c safe.directory=<repo> rev-parse HEAD` no checkout; sem git, usa `GIT_COMMIT`/`COMMIT_SHA`/`GIT_SHA` do ambiente de build; senão `null`. O runtime lê o arquivo **uma vez no boot** (rebuild com o processo antigo no ar não troca a versão informada) e prefere o arquivo ao env (env antigo no `.env` não engana). Falha do script nunca quebra o build. | Deploy real é checkout git + `npm run build` (8.4 HOMOLOGACAO §1); nada novo a fazer por deploy. `safe.directory` porque `install.sh` roda como root. |
| B31-T16 | Validação Pix exigida (P-B31-03): configuração válida exige que a última auditoria `activate` do slot tenha `pixOAuthValidated=true` com o `configFingerprint` e o `efiEnvironment` atuais (`findEfiPixValidationForConfig`). A ativação grava essa auditoria **dentro da transação** que habilita a linha. Desempate por `createdAt, id`. | Ativações da B2 não gravavam o fingerprint; qualquer escrita posterior muda o fingerprint. Sem migration e sem apagar credenciais. |
| B31-T17 | Isolamento financeiro (P-B31-08): constante de código `EFI_DATABASE_SOURCE_FINANCIAL_RELEASED=false` em `efiFinancialSource.ts`; `getEfiFinancialCredentialsSource()` devolve `legacy_env` enquanto ela for falsa. `getEfiRuntimeCredentials(purpose)`: `financial` segue essa fonte; `diagnostic` respeita `EFI_CREDENTIALS_SOURCE`. Log de boot avisa quando `database` está configurado sem liberação; status expõe `credentialsSource.financial` e `databaseFinancialReleased`. | Fixar no `legacy_env` (e não recusar) preserva o comportamento atual e evita fonte mista; recusar o settle mudaria o financeiro. Constante, não env, para que liberar exija release revisado. |
| B31-T18 | `runPixAuthTest`: falha ao decifrar credenciais/P12 vira resultado Pix `ok:false` (sem 500). Rollback que falha após commit com erro não esconde o erro original. | Revisão cruzada do fechamento. |

Checkout (`SubscriptionController` + `config/Gn.ts`), webhook, `confirmGatewayPayment`, renovação e bloqueio **não foram
alterados nem ligados ao provedor novo** na B3.1.

### 10.1 Pendências encontradas na B3.1

| ID | Pendência | Tratamento proposto | Bloqueia |
|----|-----------|--------------------|----------|
| P-B31-01 | ✅ **RESOLVIDA (fechamento técnico)** — B31-T15. Funciona no deploy real (VPS: `install.sh`, `MINIMAL_UPDATE=1 ./install.sh` e a sequência manual da 8.4 rodam `npm run build` no checkout git), sem passo manual novo. **Para aprovação (opcional, infraestrutura):** builds Docker (`backend/Dockerfile`, sem `.git`) gravam `commit: null` até o Dockerfile receber `ARG GIT_COMMIT` passado pelo build; nenhum deploy documentado usa Docker hoje. | — | — |
| P-B31-02 | P12 com algoritmo legado (RC2/3DES, `openssl -legacy`) não abre no Node 17+ (“Unsupported PKCS12 PFX data”). Produção roda `node:20-alpine`; o SDK atual funciona lá, o que sugere P12 moderno — **não verificado**. | Conferir no upload em TESTE (B3.4); se falhar, reconverter o P12 sem `-legacy`. | B3.4 |
| P-B31-03 | ✅ **RESOLVIDA (fechamento técnico)** — B31-T16. Configurações ativadas na B2 não são válidas para a nova integração (`ERR_EFI_PIX_VALIDATION_REQUIRED`, 403; status `missing: ["pixValidation"]`). Para habilitar: desativar e ativar de novo no painel (a ativação da B3.1 valida o Pix). Nenhuma credencial é apagada; `legacy_env` não é afetado. | — | — |
| P-B31-04 | Webhook secrets curtos (< 32) gravados antes da B3.1 continuam aceitos; o mínimo vale só na gravação. | Regravar o secret antes da ativação; ou checar o tamanho na prontidão (decisão do responsável). | — |
| P-B31-05 | A ação `homologate` (B3.3) deve chamar `invalidateEfiRuntimeCredentialsCache()`. | Requisito da B3.3. | B3.3 |
| P-B31-06 | Frontend (`EfiIntegrationPanel.js`) ainda mostra o toast fixo “(Pix não validado)” e não exibe os campos novos do status (`controls`, `credentialsSource`, versão). O formato de `pix` no test-auth mudou (campos adicionais, compatível). | Ajustar o painel (T-UI-03, B3.4) ou em etapa própria. | — |
| P-B31-07 | Texto de erro da Efí é ecoado (redigido, até 240 caracteres) na mensagem ao Super Admin. | Risco baixo; revisar se a Efí ecoar dados sensíveis. | — |
| P-B31-08 | ✅ **RESOLVIDA (fechamento técnico)** — B31-T17. A fonte `database` não opera nenhuma operação financeira real na B3.1: checkout, webhook, settle e boleto Cobranças seguem em `legacy_env` mesmo com `EFI_CREDENTIALS_SOURCE=database`. | Liberação junto com a migração de checkout + webhook (B3.2/B3.3), trocando `EFI_DATABASE_SOURCE_FINANCIAL_RELEASED`. | B3.2/B3.3 |
| P-B31-09 | Falhas **pré-existentes** na suíte completa, fora do escopo (ver TESTES §Registro B3.1). | Tratar fora da B3. | — |
| P-B31-10 | Commit da B3.1: `backend/package.json` passa a chamar `scripts/write-build-info.js`. O commit precisa levar `backend/scripts/` e todos os arquivos novos juntos; senão `npm run build` falha no VPS depois do `tsc`. | Commitar o conjunto inteiro (revisão de regressão). | commit/deploy |
| P-B31-11 | Builds com árvore suja (`dirty: true`) informam o HEAD, mas o código difere dele. | A ação `homologate` (B3.3) deve recusar ou sinalizar build `dirty`. | B3.3 |

---

## 11. Registro da B3.2 — cobrança Pix v2 (2026-10-20)

Implementação local, **sem ativação**. Nenhuma decisão financeira aprovada foi reinterpretada.

| ID | Decisão de implementação | Motivo |
|----|--------------------------|--------|
| B32-T1 | **Gate de código** `EFI_PIX_CHARGE_V2_RELEASED=false` (`efiFinancialSource.ts`). `isEfiPixChargeV2Active()` = `EFI_PIX_CHARGE_V2_ENABLED` **e** liberação. Com a variável ligada e o gate falso, o checkout é o legado (inclusive `pixConfigWebhook`), o cadastro admin do webhook é recusado (C3) e o boot avisa. | Missão B3.2: configuração prematura não pode ativar a v2 sem o processamento seguro de pagamentos (B3.3). O passo 2 do plano candidato C7 (v2 com pipeline `legacy`) exige trocar o gate num release revisado — decisão para a aprovação da B3.3/B3.4. |
| B32-T2 | Fonte das operações v2 = fonte financeira efetiva (`getEfiFinancialCredentialsSource`, hoje `legacy_env`). `legacy_env` usa o SDK (`pixCreateCharge` = `PUT /v2/cob/:txid`, `pixDetailCharge`, `pixGenerateQRCode`, `pixConfigWebhook`, `pixDetailWebhook`); `database` usa o cliente próprio (inalcançável enquanto P-B31-08 vale). | P-B31-08: nenhuma fonte mista. |
| B32-T3 | Teto de 20 s em toda chamada do SDK (`Promise.race`). | O SDK não resolve a promise em falha de rede sem resposta (`gn-endpoints.js`): sem o teto, o checkout v2 ficaria pendurado (RNF2). |
| B32-T4 | txid local `shc` + fatura (10) + tentativa (10) + 8 hex = 31 caracteres (`[a-zA-Z0-9]{26,35}`); a parte aleatória evita colisão entre bancos (TESTE × restauração). | R-4. |
| B32-T5 | Três passos sem chamada Efí sob lock (RF2.2): reserva `creating` com commit; GET/PUT fora do lock; gravação e revalidação da fatura sob lock. | RF2.2/RF2.3. |
| B32-T6 | **Regra central:** tentativa cujo txid pode existir na Efí (`creating`, `pending`, `blocked`, `failed` com resultado incerto) só é abandonada após GET conclusivo — inexistente, REMOVIDA ou vencida pelo relógio da Efí (`criacao + expiracao`) com margem de 120 s. Enquanto pagável e não reutilizável (valor, chave, `#Fatura:`, fonte ou `configId` diferentes), **nenhuma nova é criada**: 409 com `retryAfterSec`. CONCLUIDA sem baixa local → 409 sempre (nunca 2ª cobrança). | D-P4 (uma cobrança pagável por fatura) e revisão cruzada: evita pagamento em dobro no limite da expiração ou com webhook atrasado. |
| B32-T7 | Erro do PUT só conta como “não criada” para uma lista fechada de recusas de validação (`valor_invalido`, `chave_invalida`, `documento_bloqueado`, …). Timeout, rede, 5xx, 429 e erro desconhecido → `failed` com `outcomeUnknown=true`: o retry recupera **o mesmo txid** (GET; ausente → PUT com o mesmo txid). | T-NET-03/T-IDEM-02; resultado incerto é o padrão seguro. |
| B32-T8 | Transições guardadas (`transition`): um pedido concorrente nunca rebaixa o que outro gravou (`failed` sobre `pending`, `pending` sobre `completed`). | Revisão cruzada (concorrência). |
| B32-T9 | Tentativa grava em `payloadSummary`: `chargeVersion`, fonte, `configId`, slot, ambiente, commit, `expiracao`, `expiresAt` (conservador na reserva; o da Efí no passo 3), `locId`. Sem coluna nova. Tentativa legada sem fonte = `legacy_env`. | R-13, RF2.4, A3. |
| B32-T10 | Fatura paga/cancelada durante a chamada → 400 (QR não exibido); a tentativa fica `pending` com `invoiceClosedDuringCheckout` (a cobrança existe). Valor da fatura alterado no intervalo → 409 e a fatura não aponta para a cobrança. | RF2.2 passo 3, T-CHG-15. |
| B32-T11 | Valor enviado com `toFixed(2)`. | O legado usa `toLocaleString("pt-BR")`, que gera `1.234.50` acima de R$ 999,99 (P-B32-02). |
| B32-T12 | Resposta v2 enxuta: `txid`, `status`, `valor`, `calendario.expiracao`, `qrcode`, `expiresAt`, `expiresInSeconds`, `reused`. O frontend usa `qrcode.qrcode` e `valor`; a contagem usa `expiresInSeconds` quando presente (legado: 3600 s, como hoje). | RF2.1, T-CHG-09. |
| B32-T13 | Admin: `GET /saas/finance/efi/charges/:txid` (txid alfanumérico ≤ 35; espelha só `gatewayStatus`, nunca em fatura paga), `GET /saas/finance/efi/webhook`, `POST /saas/finance/efi/webhook/register` (`confirm`, só com v2 ativa e pipeline `legacy`, formato atual `?token=`, conferência por GET, auditoria `webhook_register` com ator, URL e chave mascaradas). | RF2.6, RF2.7, C3, T-SEC-08, A1. |
| B32-T14 | `buildSubscriptionWebhookUrl` movida, sem mudança, para `subscriptionWebhookUrl.ts` (checkout legado e cadastro admin usam a mesma). | Uma única fonte do formato atual. |
| B32-T15 | Migration `20261020120000-saas-payment-attempts-txid-unique`: índice único parcial; **para com erro explícito** se já houver txid repetido (não altera dados); `down` só remove o índice. | RF2.3a, RNF4. |
| B32-T17 | Passo 3: se outro pedido já concluiu ou abandonou a tentativa, o QR não é exibido e o fluxo relê o estado. Cobrança vencida localmente sem `calendario` na resposta da Efí → 409 não verificável (nem reusa, nem abandona). | Re-revisão cruzada. |
| B32-T16 | Cliente Pix próprio: `headers` opcionais e `efiNome` (`[a-z_]`) nos dados do erro; cadastro de webhook pelo `database` envia o mesmo `x-skip-mtls-checking: true` do SDK. | Classificar 409/404; paridade com o legado (PT-6 fica na B3.3). |

### 11.1 Pendências e riscos da B3.2

| ID | Pendência | Tratamento | Bloqueia |
|----|-----------|------------|----------|
| P-B32-01 | **Tarefa 0 não executada:** validação em sandbox de PT-2, PT-3 e PT-5 exige TESTE com conta sandbox (fora do escopo: sem VPS, sem operação real). | Executar em TESTE, com ativação pontual registrada, antes de trocar o gate B32-T1. | liberação da v2 |
| P-B32-02 | **Defeito no checkout legado:** `formatPixAmount` gera `1.234.50` para valores ≥ R$ 1.000 (formato inválido na Efí). Não corrigido (regra: legado intacto). | Decisão do responsável: correção própria com controle, ou aguardar a v2. | — |
| P-B32-03 | `nome` do erro do SDK no GET de cobrança inexistente não verificado (tratado por padrão `nao_encontrad`). Se diferente, o modo de recuperação ainda faz o PUT com o mesmo txid (seguro), mas uma tentativa `pending` vencida não seria abandonada. | Confirmar em sandbox. | liberação da v2 |
| P-B32-04 | A migration para o deploy se houver txid repetido em `SaaSPaymentAttempts`. | Antes do deploy, rodar só leitura: `SELECT "externalTxid", COUNT(*) FROM "SaaSPaymentAttempts" WHERE "externalTxid" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1`. | deploy |
| P-B32-05 | `CREATE UNIQUE INDEX` sem `CONCURRENTLY` trava escrita na tabela durante a criação (tabela pequena). | Aceitável; registrar no deploy. | — |
| P-B32-06 | Cobrança CONCLUIDA sem baixa local bloqueia novo checkout da fatura até a confirmação (sem prazo). Intencional: evita pagamento em dobro. | B3.3 (pipeline + conciliação) resolve. Runbook até lá: conferir o txid pela consulta admin e dar baixa manual (`registerManualPayment`, que abre `manual_pix_no_settle`). | B3.3 |
| P-B32-07 | Fatura com muitas tentativas legadas vivas: cada checkout confere até 6 por vez; acima disso devolve 502 transitório e o próximo continua. | Raro (legado expira em 1 h). | — |
| P-B32-08 | `x-skip-mtls-checking` no cadastro (paridade com o SDK) depende do PT-6. | B3.3. | B3.3 |
| P-B32-10 | Recuperação tardia + troca de credencial ao mesmo tempo: o GET conclusivo na conta nova pode não ver uma cobrança ainda pagável na conta antiga. Hoje risco zero (fonte única `legacy_env`, D-P14 mesma conta). | Revisar ao liberar a fonte `database` (PT-12). | liberação `database` |
| P-B32-09 | T-IDEM-03 (clique duplo no frontend) é teste H (B3.4). | B3.4. | — |

### 11.2 Dependências para a B3.3

- Trocar `EFI_PIX_CHARGE_V2_RELEASED` só junto com o processamento seguro (pipeline `async` e conciliação), com aprovação.
- Pipeline `async` localiza a fatura pelo txid em `SaaSPaymentAttempts` (índice único) e usa a fonte gravada na tentativa (R-13); `#Fatura:` como conferência/fallback (R-6, mantido).
- Tratar tentativas `blocked` e as CONCLUIDA sem baixa (P-B32-06) na conciliação.
- Cadastro do formato novo da URL (`whToken` + `ignorar=`) só com `async` (RF2.7, T-ACT-08), após P-B32-01.
- Ação `homologate` com as pendências P-B31-05 e P-B31-11.


---

## 12. Registro da B3.3 — webhook assíncrono, confirmação e conciliação (2026-10-21)

Implementação local, **sem ativação**. Nenhuma decisão financeira aprovada foi reinterpretada. Sem commit, push, deploy,
acesso a VPS ou banco remoto, cobrança real ou cadastro de webhook real.

| ID | Decisão de implementação | Motivo |
|----|--------------------------|--------|
| B33-T1 | **Gates de código** `EFI_WEBHOOK_PIPELINE_RELEASED=false` e `EFI_PIX_RECONCILIATION_SWEEP_RELEASED=false` (`efiFinancialSource.ts`). `isEfiWebhookPipelineAsyncActive()` = `EFI_WEBHOOK_PIPELINE=async` **e** liberação; idem para a varredura. Com a env ligada e o gate falso: webhook legado, worker e recuperação não registrados, cadastro admin no formato atual, varredura 403; o boot avisa. | Missão B3.3: nenhuma variável de ambiente, isoladamente, libera funcionalidade financeira não homologada (mesmo padrão de B31-T17 e B32-T1). Liberar exige release revisado (B3.4). |
| B33-T2 | Tabela `SaaSGatewayWebhookEvents` (migration `20261021120000`, aditiva, idempotente; `down` recusa apagar se houver linhas). Colunas: `eventKey` único, `eventType`, `status`, `txid`, `endToEndId`, `devolucaoId`, `amount`, vínculos (`companyId`, `invoiceId`, `paymentId`, `reconciliationItemId`), `credentialsSource`, `payload` mínimo, `result`, `attempts`, `nextAttemptAt`, `lockedBy/lockedAt`, `lastError` sanitizado, `attemptLog` (últimas 20 tentativas: horário, worker, resultado, erro — A5), `adminActions` (ator, ação, nota), `receivedAt`, `processedAt`. Índices: status+`nextAttemptAt`, txid, e2eId, empresa, fatura. | D-P9, RF3.3, R-31, A2/A5. |
| B33-T3 | Payload persistido: e2eId, txid, valor, horário, chave **mascarada + sha256** (o worker compara com a chave do slot sem guardar a chave), `tipo`, devoluções (id, rtrId, valor, status, natureza). Nunca `infoPagador`, `gnExtras` (nome/CPF/conta), cabeçalhos ou query. | R-31, S9. Contrato conferido em dev.efipay.com.br/docs/api-pix/webhooks (2026-10-21). |
| B33-T4 | `eventKey`: `pix:<e2eId>`, `devolucao:<e2eId>:<id>:<status>`, `teste:<sha256(evento,data_criacao)>`, e `invalido:<sha256(evidência)>` para item inválido do lote (persistido já `invalid_permanent`, sem job). `teste` é persistido já `ignored_not_saas` (tipo teste), evidência de homologação. | R-23, RF3.2, RF3.10. |
| B33-T5 | Autenticação (só `async`): candidatos `whToken`, `token` e `Authorization: Bearer`; cada um também sem o sufixo `/pix`. Comparação `timingSafeEqual` sobre sha256 (tamanho não vaza), sem curto-circuito. Secret da **fonte financeira efetiva** (hoje env `WEBHOOK_SUBSCRIPTION_SECRET`; `database` → secret do slot). Secret ausente → 401 (o pipeline async não tem o modo "sem secret" do dev legado). Falha ao obter o secret → 503. | RF3.1, S3, D-P3. |
| B33-T6 | Formato novo da URL: `<BACKEND_URL>/subscription/webhook?whToken=<secret>&ignorar=` (`buildSubscriptionWebhookUrlV2`). O cadastro admin usa o formato novo **só** com o pipeline async efetivo; senão, o atual (`?token=`). | RF2.7, T-ACT-08, PT-2/PT-5 (sandbox pendente). |
| B33-T7 | Recepção: allowlist de IP opcional (`EFI_WEBHOOK_IP_ALLOWLIST`, nova env opcional, só vale com `TRUST_PROXY_HOPS`) → 403; rate limit em memória por IP (600/min, por processo) → 429; autenticação → 401; corpo sem estrutura (sem `pix` nem `evento`, `pix` não-array/vazio, > 1000 itens) → 400; persistência numa transação (`INSERT … ON CONFLICT ("eventKey") DO NOTHING`) → falha 503; 200 `{ ok: true, received: true }` só após o commit. JSON inválido → 400 no async (o legado mantém o 500). Publicação **depois** da resposta, com teto de 1,5 s por job: Redis fora/lento não muda a resposta. | R-22…R-24, RF3.2–RF3.5, S5, RNF1/RNF8. |
| B33-T8 | `TRUST_PROXY_HOPS` aplicado em `app.ts` (`app.set("trust proxy", n)`) só quando configurado; ausente = comportamento atual. | R-16, S2a. Mudança global: validar em TESTE antes de ligar. |
| B33-T9 | Sanitização sem controle (permitida por §8.2): `Sentry.beforeSend` remove query, `query_string`, `Authorization`, cookies e corpo da rota do webhook; o handler global loga a rota do webhook sem query, sem corpo bruto e sem stack (`helpers/webhookLogSanitizer.ts`). Resposta do legado inalterada (500). | R-17, S2, T-SEC-05/10. |
| B33-T10 | Fila: Bull 4 já instalado, fila `SaaSGatewayWebhookEvents` criada sob demanda (nenhuma conexão Redis nova com o pipeline inativo), `removeOnComplete/removeOnFail=true`, `attempts=1` (as retentativas são do banco). `jobId = gwe-<id>-<tentativas>`: a retentativa agendada pelo job ativo não colide com ele; republicar a mesma tentativa é deduplicado. | PT-1, PT-8, R-24. |
| B33-T11 | Worker: claim atômico (`UPDATE … WHERE status IN ('received','retry_scheduled') AND "nextAttemptAt" <= now() RETURNING`), contando a tentativa no claim (evento que derruba o worker repetidamente vira `failed_exhausted`). Resultado gravado só se o worker ainda detém o lock (`lockedBy`). Concorrência 2 por processo; segurança com N processos pelo claim (C5). Worker e cron registrados no boot (`startGatewayWebhookPipeline`) só com o pipeline async efetivo. | R-25, R-26, RF3.7, RNF5. |
| B33-T12 | Validação financeira antes de confirmar: Pix sem txid (chave do slot → `unlinked`; outra chave ou `tipo` de envio → `ignored_not_saas`); chave diferente → `invalid_permanent`; GET da cobrança (nunca só o payload) — inexistente → `invalid_permanent` + conciliação "não verificável"; `ATIVA` → `retry_scheduled`; outro status ≠ `CONCLUIDA` → conciliação; e2eId que não pertence à cobrança → `invalid_permanent`; vínculo por tentativa (txid), `#Fatura:` como conferência e fallback, `Invoices.externalTxid` como último recurso; conflito tentativa × `#Fatura:` ou empresa → conciliação; fatura inexistente → conciliação; devolução registrada (SF-3) → conciliação; valor divergente → conciliação. Só então `confirmGatewayPayment` (núcleo 8.4). | RF3.9, RF3.10, regra financeira 3, T-SEC-07. |
| B33-T13 | Mapeamento do resultado: pagamento novo → `applied`; mesmo txid já registrado (gateway ou baixa manual com o txid) → `replay` (a conciliação de duplicidade da 8.4 continua aberta quando aplicável); fatura quitada por outra fonte/txid → `reconciliation` (item 8.4 `gateway_payment_on_settled_invoice`); fatura cancelada → `reconciliation` (D-P6). | RF3.10. |
| B33-T14 | **D-P6/SF-1/SF-2** em `confirmGatewayPayment`, só com `cancelledInvoicePolicy: "receive_for_reconciliation"` (passado apenas pelo worker async): 1º txid → `SaaSPayment` gateway com `countsAsRevenue=false` e `metadata.cancelledInvoiceReceipt`, fatura segue `cancelled`, sem renovação, sem socket "paid", conciliação `gateway_payment_on_cancelled_invoice` e evento no ledger; com substituta do mesmo ciclo → `replacementInvoiceId` + `requiresManualDecision`, substituta intacta; 2º txid → só conciliação de duplicidade (um recebimento por fatura). Sem o parâmetro, a 8.4 fica idêntica. Resumo por empresa ganhou `totals.receivedInReconciliation` (o recebimento não aparece como cortesia nem como receita). | D-P6, SF-1, SF-2, RF3.14a, T-ACT-06. |
| B33-T15 | **D-P7/SF-3**: evento `devolucao` → conciliação `gateway_pix_refund` (um item por devolução; status seguintes no histórico do item); nunca estorno. A devolução não é consultada na Efí: só abre conciliação, nada financeiro muda. Pix cuja devolução já está registrada (no payload, na consulta da cobrança ou em evento anterior) e ainda sem pagamento → conciliação `gateway_pix_paid_after_refund`, sem pagamento nem renovação. | D-P7, SF-3. |
| B33-T16 | Sem empresa conhecida (fatura inexistente, txid sem vínculo, devolução sem vínculo), o próprio evento `reconciliation` é o registro classificado (visível no filtro); `SaaSReconciliationItems.companyId` continua `NOT NULL` (sem migration de relaxamento). | R-8 sem alterar tabela financeira existente. |
| B33-T17 | Conciliação idempotente por `eventKey` (reprocessar não duplica item). | R-26. |
| B33-T18 | Retentativas: backoff 1, 5, 15, 60, 360 min (acima disso, 360), máximo 8 tentativas; esgotou → `failed_exhausted` + conciliação `gateway_webhook_failed_exhausted` (se a empresa for conhecida). Erros transitórios: falha da Efí (timeout, rede, 5xx, 429, recusa de credencial), banco e erro inesperado. Falha até para gravar a retentativa → evento fica `processing` e volta pelo lock antigo. | R-28, PT-11 (valores mantidos; sem teste de carga). |
| B33-T19 | Recuperação (`node-cron` a cada minuto, sem sobreposição): lock > 10 min → `retry_scheduled`; pendentes vencidos → republicar (lotes de 200); jobs `waiting/delayed` sem evento ou com evento terminal → removidos. Pausa (`EFI_WEBHOOK_WORKER_PAUSED`) suspende worker (job não reivindica) e recuperação; a recepção continua. | R-27, R-33, RF3.12, RF3.13. |
| B33-T20 | Administração (`isAuth + isSuper`): lista paginada com filtros (status, grupo `pending`, txid, e2eId, empresa), detalhe sanitizado (sem `chaveHash`), indicadores (contagem por status, pendentes atrasados > 15 min, idade do mais antigo, locks antigos, fila e eventos sem job), reprocessar (R-30: nota ≥ 5, só `failed_exhausted/invalid_permanent/unlinked/reconciliation`, zera as tentativas, auditoria `webhook_event_reprocess`, 409 com o pipeline inativo), classificar `unlinked` (converter em conciliação com empresa/fatura, ou "não é SaaS"; auditoria `webhook_event_classify`). | RF3.16, RF3.19, A1, D-P8. |
| B33-T21 | Conciliação: `GET /saas/finance/reconciliation` paginada (`page`, `limit` ≤ 100, `status=open|resolved|all`, `kind`, `companyId`; default = contrato anterior: abertos, 100, mais novos primeiro). `POST …/:id/resolve`: nota obrigatória (400), `FOR UPDATE`, item resolvido → 409, decisão em `metadata.resolution` (nota, ator, horário, status anterior), mensagem original preservada, evento `reconciliation_resolved` no ledger. | R-11, R13, RF3.17. Muda a API admin (nota obrigatória), sem uso no frontend atual. |
| B33-T22 | Varredura (`POST /saas/finance/efi/pix-sweep`, `confirm`, `days` ≤ 30): parte das tentativas Pix locais com txid (inclui legadas), até 200 por execução, GET na Efí; `CONCLUIDA` sem `SaaSPayment` → item `pix_sweep_concluded_without_payment` (idempotente por txid), pulando txid com evento pendente no pipeline. Nunca dá baixa. Auditoria `pix_sweep`. Não usa `GET /v2/cob` em lista (paginação não validada). | D-P10, RF3.18, P-B32-06. |
| B33-T23 | **Homologação** `POST /saas/finance/efi/config/:slot/homologate` (`confirm`, `evidence`), auditoria `homologate` na transação que revalida o fingerprint sob lock, com fingerprint, ambiente, commit e evidências. Recusa build sem commit ou `dirty` (P-B31-11). Invalida o cache de credenciais (P-B31-05). TESTE: evento `applied` processado pela fonte `database` com o fingerprint e ambiente atuais + `SaaSPayment` gateway do mesmo txid + renovação desse pagamento. PRODUÇÃO: referência e commit do relatório TESTE (mesmo commit), evento `teste` recebido após a ativação do slot e webhook conferido por GET exatamente no formato novo; **nenhum `SaaSPayment` exigido**. | D-P17, RF1.7, P-B31-05, P-B31-11. Como a fonte `database` não está liberada (P-B31-08), a homologação TESTE só é alcançável após a liberação revisada. |
| B33-T24 | Status `GET /saas/finance/efi/status`: `webhookPipeline { configured, released, active, workerPaused, sweep, stats }`; boot loga `webhookPipelineAsyncActive` e avisa env sem liberação. | RF0.2, RNF9. |
| B33-T25 | `PlatformEfiConfigAudit.action` ganhou `webhook_event_reprocess`, `webhook_event_classify`, `reconciliation_resolve` (reservado), `pix_sweep` (coluna texto, sem migration). | A1. |

### 12.1 Pendências técnicas tratadas na B3.3

| ID | Situação | Evidência |
|----|----------|-----------|
| PT-6 | 🟡 **PARCIAL — depende de sandbox/suporte Efí.** A documentação oficial (dev.efipay.com.br/docs/api-pix/webhooks, conferida em 2026-10-21) trata o mTLS do receptor como exigência do Bacen: o cadastro sem mTLS responde 400 `webhook_invalido` ("A autenticação de TLS mútuo não está configurada na URL informada"); a Efí faz um handshake sem certificado (que deve ser recusado) e outro com a cadeia pública (`certificate-chain-prod.crt` / `-homolog.crt`). **`x-skip-mtls-checking` não aparece na documentação oficial** (só no código do SDK). Alternativas documentadas: token na URL (`?hmac=xyz&ignorar=`) + IP `34.193.116.226`, "usadas em conjunto". | O pipeline não depende do mTLS: a autenticação por token, a allowlist opcional e a verificação por GET na Efí valem com ou sem mTLS no nginx. **Não confirmado:** se o cadastro com `x-skip-mtls-checking` segue aceito permanentemente. Se não for, reabrir D-P3 B (mTLS no nginx com `ssl_verify_client optional` e a cadeia Efí, só na rota do webhook) — mudança de infraestrutura, fora desta etapa. Validar no cadastro em TESTE (B3.4, P-B32-01/P-B32-08). |
| PT-8 | ✅ **RESOLVIDA (teste local, Bull 4 + Redis 7.4.2).** Job vivo (`waiting`/`delayed`/`active`) com o mesmo `jobId` → o `add` é ignorado (devolve o existente). Job concluído e removido (`removeOnComplete`) → o mesmo `jobId` volta a ser aceito. Job concluído e **mantido** → novo `add` é ignorado (não roda de novo). | `gatewayWebhookRedis.it.spec.ts` (PT-8). Por isso: `removeOnComplete/removeOnFail=true` e `jobId` por tentativa (B33-T10); a idempotência real é o claim no banco (R-25). |
| PT-10 | 🟡 **PROPOSTA — decisão do responsável (LGPD/volume).** Nenhuma exclusão automática foi criada. Proposta: (a) indefinida para eventos com efeito financeiro (`applied`, `replay`, `reconciliation`, `failed_exhausted`, `unlinked`, `invalid_permanent` com valor) e para eventos referenciados por um registro `homologate`; (b) 180 dias para `teste` e `ignored_not_saas` sem referência; (c) a limpeza, se aprovada, vira job próprio com flag e auditoria. O payload já é mínimo (sem dados do pagador), o que reduz o risco LGPD. | Pendente de decisão; nada a executar na B3.3. |
| PT-11 | Mantida como proposta (1, 5, 15, 60, 360 min; 8 tentativas; lock de 10 min). Sem teste de carga. | Ajustável por constante; revisar com volume real (B3.4). |
| P-B31-05 | ✅ **RESOLVIDA** — `homologate` chama `invalidateEfiRuntimeCredentialsCache()` (T-HOM-03). | B33-T23. |
| P-B31-11 | ✅ **RESOLVIDA** — `homologate` recusa build `dirty` ou sem commit. | B33-T23. |
| P-B32-06 | ✅ **RESOLVIDA no código** — cobrança CONCLUIDA sem baixa local passa a ser aplicada pelo pipeline (webhook) ou aparece na varredura como conciliação. Continua valendo o runbook manual enquanto o pipeline não for ativado. | B33-T12/T22; T-REC-05. |
| P-B32-10 | 🟡 **Mitigada, não eliminada.** O worker consulta com a fonte financeira **atual** e registra `chargeSource`, `currentSource` e `configId` no resultado. Se a conta mudar (proibido na 1ª ativação por D-P14), o GET na conta nova devolve "inexistente" → `invalid_permanent` + conciliação "não verificável", nunca pagamento sem prova. Consultar com a credencial da fonte de origem exige guardar as duas credenciais ao mesmo tempo (PT-12). | Revisar ao liberar `database` (B3.4/PT-12). |
| P-B32-08 | Depende de PT-6 (acima). | — |

### 12.2 Riscos remanescentes da B3.3

- Validação em sandbox não executada (P-B32-01): path/query reais com `/pix` e `ignorar=`, nome do parâmetro preservado, evento de teste no cadastro (PT-7), aceitação sem mTLS (PT-6).
- Rate limit em memória por processo; sem `TRUST_PROXY_HOPS`, todas as notificações compartilham o IP do proxy (limite generoso: 600/min).
- Worker no processo do backend (F15): sob carga alta do backend, o processamento atrasa (a recepção não).
- Devolução não é conferida na Efí (só abre conciliação; nenhum efeito financeiro).
- Recebimentos em conciliação (SF-1/SF-2) exigem rotina operacional; não há alerta ativo além da tela e do status.
- Nota obrigatória em `resolve` muda a API admin (sem consumidor no frontend anterior).
- Ativação do pipeline torna os Pix pagos auto-renováveis (D-P11 antes da promoção).

---

## 13. Preparação local da B3.4 (2026-10-21) — B3.4 **não iniciada**

Pacote de implantação: `IMPLANTACAO-TESTE.md`. Nada foi executado em VPS.

| ID | Decisão de implementação | Motivo |
|----|--------------------------|--------|
| B34-T1 | As liberações de código passaram de booleanos globais (`EFI_DATABASE_SOURCE_FINANCIAL_RELEASED`, `EFI_PIX_CHARGE_V2_RELEASED`, `EFI_WEBHOOK_PIPELINE_RELEASED`, `EFI_PIX_RECONCILIATION_SWEEP_RELEASED`, citados em §10–§12) para **listas por runtime** `EFI_RELEASED_RUNTIMES` (congeladas, **todas vazias**). `isEfiFeatureReleased(f)` exige `STREAMHUB_RUNTIME_ENV` válido e presente na lista; runtime ausente nunca libera. Comportamento com as listas vazias = idêntico ao anterior (T-REG-01/02 verdes). Status expõe `released` (runtime atual) e `releasedRuntimes`. | Um booleano global liberaria TESTE e PRODUÇÃO no mesmo commit, e a promoção exige o mesmo commit homologado (HOMOLOGACAO §9.4). Com listas, o commit da homologação libera só `"test"`; PRODUÇÃO fica travada no código. |
| B34-T2 | `backend/scripts/check-efi-p12.js`: confere o P12 antes do upload (mesmo teste do backend, fingerprint igual ao do painel, titular/emissor/validade via `openssl -nokeys`), sem imprimir chave e sem rede. | H-03, P-B31-02. |
| B34-T3 | `preflight-teste.sql`: verificação só leitura (migrations, txid repetido, slots sem segredo, linha de base financeira). Ensaiado em banco descartável com dados, inclusive a parada por txid repetido. | P-B32-04, H-01. |
| B34-T4 | A recepção grava `payload.authVia` (nome da forma que autenticou: `whToken`, `whToken_pix_suffix`, `token`, `token_pix_suffix`, `bearer`), nunca o valor; também no log. As funções antigas de candidatos foram substituídas por `matchWebhookToken` (mesma comparação em tempo constante, sem curto-circuito). | Evidência objetiva de PT-2/PT-5 na 1ª notificação real em sandbox. |
| B34-T5 | Frontend: card "Status da integração e controles" (`EfiActivationStatusCard.js`) com valor configurado × liberado no código × efetivo de cada controle, aviso quando a env está ligada sem liberação, versão/`dirty`, fonte `database` (validade, fingerprint, homologação, `versionDiffers`); toast do teste de conexão mostra o resultado real do Pix. | P-B31-06 resolvida; H-02, H-06, T-UI-03. |
| B34-T6 | Recomendação PT-12: cadastrar no slot `homologation` o mesmo valor de `WEBHOOK_SUBSCRIPTION_SECRET` de TESTE; a troca de fonte não invalida a URL. Sem código novo. | Evita janela de rejeição; decisão R-6. |

Pendências que seguem para a B3.4 (dependem de sandbox ou decisão): PT-2, PT-3, PT-5, PT-6, PT-7, PT-10, PT-12, P-B31-02,
P-B31-04, P-B32-01, P-B32-02, P-B32-03, P-B32-08, P-B32-10. Ver `IMPLANTACAO-TESTE.md` §1.
- **B34-T7 — guarda de fonte `database` (2026-10-21).** Diagnóstico da VPS de TESTE: `GERENCIANET_SANDBOX=false`,
  ou seja, o legado de TESTE usa a conta Efí de produção. Liberar `pixChargeV2`, `webhookPipeline` ou
  `pixReconciliationSweep` sem `databaseFinancial` faria o caminho B3 operar nessa conta. `evaluateEfiActivation`
  (regra pura em `efiFinancialSource.ts`) passa a exigir a fonte `database` efetiva no mesmo runtime para as três;
  `efiActivationGuard.spec` cobre o estado misto e reprova um release inconsistente. Defaults e legado inalterados.
- **B34-T8 — testes sem rede Efí (2026-10-21).** `backend/jest.blockEfiNetwork.js` (setupFiles das configs de
  unidade e integração) faz `tls.connect` lançar erro para `*.efipay.com.br` e `*.gerencianet.com.br`. Rede de
  segurança caso falte um mock.
- **B34-T9 — roteiro sem cobrança legada (2026-10-21).** IMPLANTACAO-TESTE §1.3/§5/§7.2: smoke sem Pix pelo
  checkout legado; D-P14 não vale nesta VPS (H-20 e H-36 não aplicáveis); R-6 passa a secret novo só do slot.

---

## 14. API Efí de produção na VPS de TESTE — Opção B (2026-10-22)

**Contexto.** A conta Efí de homologação (sandbox) não estava disponível: a Efí informou prazo de até 72 h. O
responsável cadastrou no slot `homologation` da VPS de TESTE as credenciais e o P12 de **produção**. O OAuth Cobranças
passou, mas o OAuth Pix retornou HTTP 403. Causa confirmada em diagnóstico só leitura: o runtime `test` obrigava o
ambiente `sandbox`, e o P12 de produção (emissor `CN = apis.efipay.com.br`) era enviado ao `pix-h.api.efipay.com.br`.

**Decisão do responsável.** Não aguardar o sandbox e homologar com a conta Efí **real** na VPS de TESTE, sem mudar a
identidade do runtime (`STREAMHUB_RUNTIME_ENV=test`).

| ID | Decisão de implementação | Motivo |
|----|--------------------------|--------|
| B34-T10 | Nova autorização `EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API` (default desligada; só o valor exato `true` liga). Só no runtime `test`, ela acrescenta `production` aos ambientes aceitos pelo slot `homologation` (`getPermittedEfiApiEnvironments`, `assertEfiSlotAllowedForRuntime`). O runtime `production` e a regra de slots não mudam. O slot novo continua nascendo em `sandbox`: nada é selecionado implicitamente. A variável é lida a cada chamada, e o assert roda antes do cache de credenciais; sem ela, um slot gravado em `production` fica bloqueado na hora (`ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME`), sem fallback. | Runtime e ambiente da API passam a ser conceitos independentes, com uma única flag e falha fechada. |
| B34-T10a | Ação admin auditada `POST /saas/finance/efi/config/:slot/environment` (`{ efiEnvironment, confirm: true }`, Super Admin). Valida o destino contra runtime e autorização. Na mesma transação, apaga Client ID/Secret, chave Pix, webhook secret, credenciais Cobranças dedicadas, P12, testes OAuth, `adminEnabled` e `pixHomologated`, e grava a auditoria `change_environment` (de/para, fingerprint do P12 anterior, sem segredos). O ambiente atual não é validado, para que voltar a `sandbox` funcione mesmo sem a autorização. O histórico de auditoria é preservado. | Nenhum segredo ou certificado é reaproveitado entre ambientes; a validação Pix e a homologação já ficam inválidas porque o fingerprint da configuração inclui o ambiente. |
| B34-T10b | `upsert` de credenciais deixou de sobrescrever `efiEnvironment` com o default do runtime. O ambiente só muda pela ação B34-T10a. | Sem isso, salvar credenciais voltaria o slot para `sandbox` em silêncio. |
| B34-T10c | Painel Efí: botões "Usar API Efí de PRODUÇÃO" / "Voltar para API Efí de HOMOLOGAÇÃO" (só os ambientes aceitos, com confirmação), alerta vermelho "ATENÇÃO: conta Efí de PRODUÇÃO utilizada na VPS de TESTE. Operações financeiras podem movimentar dinheiro real." e alerta de ambiente bloqueado. O DTO ganhou `efiApi` (`productionAllowedInTestRuntime`, `permittedEnvironments`, `environmentPermitted`, `realMoneyWarning`). O log de boot inclui `runtime` e `testRuntimeProductionApiAllowed` e emite um `warn` quando a autorização está ligada. | Visibilidade da combinação runtime `test` × API `production`. |
| B34-T10d | Consulta só leitura `GET /saas/finance/efi/config/webhook-check`: lê na Efí o webhook já cadastrado na chave Pix **do slot do banco** (`getEfiDatabasePixGateway`, finalidade `database`, nunca `legacy_env`), mesmo com a fonte financeira em `legacy_env`. Retorna a URL mascarada e `pointsToThisBackend`. Exige a configuração pronta (D-P2: ativada e com validação Pix). | A Efí mantém **um webhook por chave**: cadastrar outro substitui o atual. A consulta prova o estado antes de qualquer cadastro, sem acessar a PRODUÇÃO do StreamHub. |

**O que não mudou.** `EFI_RELEASED_RUNTIMES` continua com as quatro listas vazias. A guarda B34-T7 está intacta. A
fonte financeira efetiva continua `legacy_env`, e v2, pipeline e varredura continuam desligados até o deploy 2
(IMPLANTACAO-TESTE §6). Checkout legado, `GERENCIANET_*`, `BILLING_AUTOMATION_NORMALIZED_DATES` e automação de
faturamento inalterados. Nenhuma migration (a coluna `action` da auditoria é `STRING(64)`).

**Riscos aceitos pelo responsável.**
- Com a liberação TESTE (deploy 2), toda cobrança Pix v2 gerada na VPS de TESTE é **dinheiro real**. Cancelar uma
  cobrança não devolve um Pix pago. Devoluções não são automáticas e, se necessárias, são feitas manualmente no painel Efí.
- Webhook: se a chave Pix do slot for a mesma usada em outra integração (inclusive a PRODUÇÃO do StreamHub), cadastrar o
  webhook a partir de TESTE redireciona as notificações dessa integração. Usar uma **chave Pix exclusiva** para TESTE e
  rodar B34-T10d antes de qualquer cadastro.
- mTLS do webhook (PT-6/R-7): em produção, a cadeia da Efí é a de produção, não a `certificate-chain-homolog.crt`
  (conferir a URL exata na documentação oficial antes da opção B de R-7).

**Reversão.** Painel → "Voltar para API Efí de HOMOLOGAÇÃO" (apaga as credenciais reais do slot) e remover
`EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API` + restart. Só remover a variável já bloqueia o slot, sem fallback.
Procedimento completo: IMPLANTACAO-TESTE §10.
