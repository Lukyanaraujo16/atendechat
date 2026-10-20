# Fase 8.3-B3 — Matriz de testes

**Nenhum teste desta matriz foi executado.** Coluna “Estado” = `não executado` em todas as linhas.

Tipos de teste:
- **U** — unitário (jest, mocks);
- **I** — integração (`jest.integration.config.js`, banco descartável; Redis real ou simulado conforme o caso);
- **H** — homologação manual em TESTE.

A coluna “Etapa” indica onde o teste nasce. Todos rodam de novo na B3.4.

Os testes marcados **(rev. 2026-10-20)** foram revisados para as decisões aprovadas (D-P18 assíncrono, D-P2/D-P17, D-P3,
D-P8). O ID foi mantido para preservar a rastreabilidade.

## Controles de ativação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ACT-01 | Todos os controles no default | respostas de checkout e webhook idênticas às atuais (snapshot de contrato) | I | B3.1 | não executado |
| T-ACT-02 | Log de boot e `GET /saas/finance/efi/status` | valor efetivo de cada controle, sem segredos | U | B3.1 | não executado |
| T-ACT-03 | Migrations e seeds da B3 aplicados | nenhum controle ligado; comportamento = default | I | B3.2/B3.3 | não executado |
| T-ACT-04 | `EFI_PIX_CHARGE_V2_ENABLED=false` | checkout legado, incluindo `pixConfigWebhook` | I | B3.2 | não executado |
| T-ACT-05 | Cadastro admin de webhook com v2 desligado | recusado (C3), sem chamada à Efí | I | B3.2 | não executado |
| T-ACT-06 | `EFI_WEBHOOK_PIPELINE=legacy` | autenticação e processamento atuais; `token=<secret>/pix` continua rejeitado como hoje (C4); o ramo D-P6 de `confirmGatewayPayment` não executa | I | B3.3 | não executado |
| T-ACT-08 | Cadastro admin do webhook com v2 + `legacy` / v2 + `async` | formato atual da URL (`token`) / formato novo; nunca o formato novo com `legacy` | I | B3.3 | não executado |
| T-ACT-07 | Combinações de fonte × pipeline × charge v2 (8 combinações) | cada uma funciona; nenhuma muda o financeiro fora do esperado | I | B3.3 | não executado |

## Credenciais

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-CRED-01 | `EFI_CREDENTIALS_SOURCE` ausente | fonte `legacy_env`, log de boot | U | B3.1 | não executado |
| T-CRED-02 | Valor inválido (`foo`) | `legacy_env` + warn | U | B3.1 | não executado |
| T-CRED-03 | `database` sem registro do slot | `ERR_EFI_CONFIG_NOT_FOUND`, sem fallback env | U | B3.1 | não executado |
| T-CRED-04 | `database` com `adminEnabled=false` | erro tipado, checkout 4xx claro | U | B3.1 | não executado |
| T-CRED-05 | **(rev. 2026-10-20)** `database` no slot `production` sem homologação válida | bloqueado — ver T-HOM-02 | U | B3.1 | não executado |
| T-CRED-06 | `database` revogado | `ERR_EFI_CONFIG_REVOKED` | U | B3.1 | não executado |
| T-CRED-07 | Cache: upsert de segredo invalida o token | próxima chamada refaz o OAuth | U | B3.1 | não executado |
| T-CRED-08 | Cache: activate/deactivate/revoke/upload/delete invalidam | idem | U | B3.1 | não executado |
| T-CRED-09 | Cobranças usa a credencial dedicada se existir, senão a Pix | conforme resolvedor | U | B3.1 | não executado |
| T-CRED-10 | `EFI_CREDENTIAL_ENCRYPTION_KEY` errada | `ERR_EFI_CREDENTIAL_DECRYPT_FAILED`, sem vazar ciphertext | U | B3.1 | não executado |
| T-CRED-11 | **(rev. 2026-10-20)** Marcar homologado | substituído por T-HOM-03/04 | — | — | não executado |
| T-CRED-12 | Teste/ativação com P12 que não abre (`createSecureContext` falha) | falha clara, não ativa | U | B3.1 | não executado |
| T-CRED-13 | Fonte `database`: base Cobranças pelo slot, ignorando `GERENCIANET_SANDBOX` | conforme | U | B3.1 | não executado |
| T-CRED-14 | Webhook secret curto (< 32) | 400 | U | B3.1 | não executado |
| T-CRED-15 | **(rev. 2026-10-20)** Contrato `legacy_env` | consolidado em T-ACT-01 | — | — | não executado |
| T-CRED-16 | Status unificado: tabela com todas as combinações de campos | admin e resolvedor devolvem o mesmo status | U | B3.1 | não executado |

## Homologação (D-P2, D-P17)

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-HOM-01 | Troca de segredo ou P12 | `configFingerprint` muda; homologação anterior inválida | U | B3.1 | não executado |
| T-HOM-02 | Slot `homologation` com configuração válida e sem homologação / slot `production` sem homologação válida | TESTE opera; PRODUÇÃO bloqueada | U | B3.1 | não executado |
| T-HOM-03 | `homologate` em TESTE sem e com evidência (evento, pagamento gateway, renovação no mesmo fingerprint) | 400 / aceito, com auditoria de fingerprint, ambiente e commit | I | B3.3 | não executado |
| T-HOM-04 | `homologate` em PRODUÇÃO: referência do relatório TESTE (mesmo commit), configuração válida, webhook conferido, evento `teste` persistido | aceito **sem nenhum `SaaSPayment`**; recusa se faltar um item | I | B3.3 | não executado |
| T-HOM-05 | Deploy com commit diferente do homologado | status com aviso; integração **não** desabilitada automaticamente | U | B3.3 | não executado |

## Certificados

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-CERT-01 | P12 válido no banco → Agent mTLS em memória | nenhum arquivo gravado (nem temporário) no caminho `database` | U | B3.1 | não executado |
| T-CERT-02 | P12 ausente com `database` | `ERR_EFI_CERTIFICATE_MISSING` | U | B3.1 | não executado |
| T-CERT-03 | P12 corrompido/não PKCS#12 | erro tipado no upload e no uso | U | B3.1 | não executado |
| T-CERT-04 | Troca de P12 | invalida token, ativação e homologação; fingerprint novo | U | B3.1 | não executado |
| T-CERT-05 | P12 da conta/ambiente errado | OAuth Pix falha com mensagem sanitizada | H | B3.4 | não executado |
| T-CERT-06 | Legado: arquivo `certs/<nome>.p12` ausente | comportamento atual (400) preservado | U | B3.1 | não executado |

## Ambiente homologação/produção

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ENV-01 | `STREAMHUB_RUNTIME_ENV=test` + `database` | slot `homologation`, base sandbox (PT-4) | U | B3.1 | não executado |
| T-ENV-02 | `STREAMHUB_RUNTIME_ENV=production` + `database` | slot `production`, base produção (PT-4) | U | B3.1 | não executado |
| T-ENV-03 | Runtime ausente/inválido + `database` | bloqueio total Efí, erro claro | U | B3.1 | não executado |
| T-ENV-04 | Registro com `efiEnvironment` incompatível | `ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME` | U | B3.1 | não executado |
| T-ENV-05 | `GERENCIANET_SANDBOX` ignorado na fonte `database` | ambiente vem do slot | U | B3.1 | não executado |
| T-ENV-06 | Status mostra fonte, slot, ambiente, fingerprint e homologação | DTO sem segredos | U | B3.1 | não executado |

## Geração de cobrança

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-CHG-01 | Fatura aberta sem cobrança (v2) | cria com txid local; tentativa `creating`→`pending` | I | B3.2 | não executado |
| T-CHG-02 | Fatura com cobrança ativa conferida | devolve a mesma, sem criação | I | B3.2 | não executado |
| T-CHG-03 | Cobrança expirada | cria nova; a antiga fica registrada | I | B3.2 | não executado |
| T-CHG-04 | Fatura paga / cancelada | 400 (mantido) | I | B3.2 | não executado |
| T-CHG-05 | Fatura de outra empresa | 403 (mantido) | I | B3.2 | não executado |
| T-CHG-06 | `EFI_PIX_ENABLED=false` | 403 `ERR_PIX_DISABLED` (mantido) | U | B3.2 | não executado |
| T-CHG-07 | Formato do txid | `[a-zA-Z0-9]{26,35}`, único | U | B3.2 | não executado |
| T-CHG-08 | Checkout v2 não chama registro de webhook | nenhum `PUT /v2/webhook` | U | B3.2 | não executado |
| T-CHG-09 | Resposta v2 sem campos internos | só QR/copia-e-cola e dados usados | U | B3.2 | não executado |
| T-CHG-10 | Consulta admin de txid | dados da Efí; só `gatewayStatus` atualizado | I | B3.2 | não executado |
| T-CHG-11 | Tentativa grava fonte, `configId`, slot, ambiente e commit | conforme | I | B3.2 | não executado |
| T-CHG-12 | Cadastro e consulta de webhook (admin, v2) | auditados; secret mascarado | I | B3.2 | não executado |
| T-CHG-13 | Criação lenta na Efí (mock 10 s) | webhook, baixa manual e cancelamento da fatura não ficam bloqueados | I | B3.2 | não executado |
| T-CHG-14 | Tentativa `creating` órfã | GET do txid antes de criar outra | I | B3.2 | não executado |
| T-CHG-15 | Fatura paga/cancelada durante a chamada Efí | QR não exibido; tentativa registrada | I | B3.2 | não executado |
| T-CHG-16 | Txid repetido em `SaaSPaymentAttempts` | violação do índice único | I | B3.2 | não executado |
| T-CHG-17 | PUT repetido devolve conflito (mock) | GET + comparação de valor e chave | U | B3.2 | não executado |

## Idempotência (cobrança)

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-IDEM-01 | 2 checkouts concorrentes da mesma fatura | 1 cobrança, mesma resposta | I | B3.2 | não executado |
| T-IDEM-02 | Repetir `PUT /v2/cob/:txid` após timeout | mesma cobrança (via GET); sem duplicata local | I | B3.2 | não executado |
| T-IDEM-03 | Clique duplo no frontend | 1 cobrança | H | B3.4 | não executado |
| T-IDEM-04 | Duas abas com intervalo maior que a expiração | 2ª cria nova; 1ª expirada | I | B3.2 | não executado |

## Webhook — recepção e autenticação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-WH-01 | **(rev. 2026-10-20)** URL com token novo e `/pix` acrescentado conforme o contrato real (PT-2) | aceito (`async`) | I | B3.3 | não executado |
| T-WH-02 | `token` legado (`async`) | aceito (transição) | I | B3.3 | não executado |
| T-WH-03 | Secret errado / ausente | 401; **nada persistido** | I | B3.3 | não executado |
| T-WH-04 | Comparação em tempo constante | `timingSafeEqual` usado | U | B3.3 | não executado |
| T-WH-05 | IP fora da allowlist (com `TRUST_PROXY_HOPS`) | 403; nada persistido | I | B3.3 | não executado |
| T-WH-06 | `teste_webhook` | 200; persistido como `teste` | I | B3.3 | não executado |
| T-WH-07 | `CONCLUIDA` + fatura aberta + valor igual | evento `applied`: pagamento + renovação | I | B3.3 | não executado |
| T-WH-08 | **(rev. 2026-10-20)** Cobrança `ATIVA` no processamento | `retry_scheduled`; aplica quando `CONCLUIDA` | I | B3.3 | não executado |
| T-WH-09 | Fatura inexistente | `reconciliation` + item | I | B3.3 | não executado |
| T-WH-10 | Valor divergente | `reconciliation` + item | I | B3.3 | não executado |
| T-WH-11 | **(rev. 2026-10-20)** Pix sem txid: origem indeterminada / comprovadamente fora do SaaS | `unlinked` com evidência / `ignored_not_saas`, sem pendência | I | B3.3 | não executado |
| T-WH-12 | `devolucoes` presente | `reconciliation` (devolução); sem estorno | I | B3.3 | não executado |
| T-WH-13 | **(rev. 2026-10-20)** Lote com 1 item transitório + 1 ok | 200 após persistir os dois; ok → `applied`; transitório → `retry_scheduled` | I | B3.3 | não executado |
| T-WH-14 | **(rev. 2026-10-20)** Reentrega do mesmo evento | 1 linha por `eventKey`; 200 | I | B3.3 | não executado |
| T-WH-15 | Txid anterior à migração (sem tentativa local) | fallback `#Fatura:`, credenciais env | I | B3.3 | não executado |
| T-WH-16 | `token=<secret>/pix` (URL legada com sufixo, `async`) | aceito | I | B3.3 | não executado |
| T-WH-17 | **(rev. 2026-10-20)** Devolução com o mesmo e2eId do Pix | `eventKey` distinto; tratada como devolução, não replay | I | B3.3 | não executado |
| T-WH-18 | **(rev. 2026-10-20)** Orçamento síncrono de 30 s | obsoleto (D-P18 B). Substituído: recepção < 5 s sem chamada Efí (T-NET-07) | — | — | não executado |
| T-WH-19 | **(rev. 2026-10-20)** Corpo sem estrutura reconhecível (JSON inválido, sem `pix`/`evento`) | 400; sem 500 nem evento Sentry com URL | I | B3.3 | não executado |
| T-WH-20 | Lote com 1 item inválido + 1 Pix válido | 200; válido persistido e processado; inválido persistido como `invalid_permanent` | I | B3.3 | não executado |

## Webhook — processamento assíncrono (D-P18)

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ASY-01 | Persistência antes do 200 (commit lento, instrumentado) | a resposta só sai após o commit | I | B3.3 | não executado |
| T-ASY-02 | PostgreSQL falha no INSERT | 503; nada publicado; nenhuma linha | I | B3.3 | não executado |
| T-ASY-03 | PostgreSQL falha no commit de um lote com N itens | 503; nenhuma linha parcial | I | B3.3 | não executado |
| T-ASY-04 | Redis indisponível na recepção | 200; eventos `received`; nenhuma exceção não tratada | I | B3.3 | não executado |
| T-ASY-05 | Falha na publicação do job após o commit | 200; evento `received`; log sanitizado | I | B3.3 | não executado |
| T-ASY-06 | Redis volta | a recuperação republica; cada evento processado uma vez | I | B3.3 | não executado |
| T-ASY-07 | Worker reiniciado após o claim e antes da confirmação | lock antigo → `retry_scheduled` → processado uma vez | I | B3.3 | não executado |
| T-ASY-08 | Crash após `confirmGatewayPayment` e antes de gravar o resultado | reprocessamento → `replay`; 1 pagamento, 1 renovação | I | B3.3 | não executado |
| T-ASY-09 | Mesmo evento recebido 3× | 1 linha, 1 job | I | B3.3 | não executado |
| T-ASY-10 | Dois jobs para o mesmo evento | só um passa no claim; o outro encerra sem efeito | I | B3.3 | não executado |
| T-ASY-11 | Dois workers (dois processos) concorrentes | uma execução por evento | I | B3.3 | não executado |
| T-ASY-12 | Falha transitória | `retry_scheduled`; backoff respeitado (`nextAttemptAt`) | U | B3.3 | não executado |
| T-ASY-13 | Retentativas esgotadas | `failed_exhausted` + item de conciliação + destaque na tela | I | B3.3 | não executado |
| T-ASY-14 | Falha permanente (txid inexistente na conta) | `invalid_permanent`; sem retentativa; evidência preservada | I | B3.3 | não executado |
| T-ASY-15 | Recuperação: `processing` com lock antigo | volta a `retry_scheduled` | I | B3.3 | não executado |
| T-ASY-16 | Conciliação fila × banco | job órfão removido; evento sem job republicado; nada duplicado | I | B3.3 | não executado |
| T-ASY-17 | `EFI_WEBHOOK_WORKER_PAUSED=true` | recepção 200 e persistência; nada processado; ao retomar, todos processados | I | B3.3 | não executado |
| T-ASY-18 | Reprocessamento manual | permitido só nos status de R-30, com nota e auditoria; negado para `applied`/`replay` | I | B3.3 | não executado |
| T-ASY-19 | Payload persistido | sem `infoPagador`, nome/CPF, cabeçalhos ou query | U | B3.3 | não executado |
| T-ASY-20 | Corpo da resposta 200 | indica só “recebido”; não afirma pagamento processado | U | B3.3 | não executado |
| T-ASY-21 | Lote com eventos novos e repetidos | só os novos geram linha e job | I | B3.3 | não executado |
| T-ASY-22 | Cobrança `ATIVA` → `CONCLUIDA` entre retentativas | aplica uma vez | I | B3.3 | não executado |
| T-ASY-23 | Evento de cobrança emitida antes da migração | processado via `#Fatura:` e conta env | I | B3.3 | não executado |
| T-ASY-24 | Evento de cobrança criada pela fonte `database` após voltar a `legacy_env` | processado (mesma conta, D-P14); fonte de origem registrada | I | B3.3 | não executado |
| T-ASY-25 | Multiempresa no worker | aplica só na empresa da fatura; filtros por empresa corretos | I | B3.3 | não executado |
| T-ASY-26 | **(rev. 2026-10-20)** Devolução processada antes do Pix do mesmo e2eId | conciliação de devolução; Pix: evidência + conciliação, sem pagamento aplicado nem renovação (SF-3); nunca estorno ou compensação automática | I | B3.3 | não executado |
| T-ASY-27 | Pix de cobrança antiga chega depois de outra cobrança da mesma fatura já paga | conciliação “possível duplicidade”; sem renovação | I | B3.3 | não executado |
| T-ASY-28 | Baixa manual anterior ao evento (mesmo txid) | `replay`/conciliação; 1 renovação | I | B3.3 | não executado |
| T-ASY-29 | Fatura cancelada paga | recebimento idempotente; status `cancelled`; sem renovação; conciliação; 2º txid → duplicidade; rastreabilidade preservada; fora da receita consolidada até a conciliação (SF-1) | I | B3.3 | não executado |
| T-ASY-30 | Sem renovação duplicada (baixa manual + gateway + reprocesso + republicação) | exatamente 1 renovação por fatura | I | B3.3 | não executado |
| T-ASY-31 | Evento `teste` persistido | disponível como evidência para T-HOM-04 | I | B3.3 | não executado |

## Pagamento duplicado

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-DUP-01 | Mesmo txid 2× | 1 pagamento, 1 renovação | I | B3.3 | não executado |
| T-DUP-02 | Mesmo txid simultâneo | idem (claim + lock) | I | B3.3 | não executado |
| T-DUP-03 | 2 txids pagos para a mesma fatura (legado, N cobranças) | 1 pagamento + conciliação de duplicidade | I | B3.3 | não executado |
| T-DUP-04 | Baixa manual, depois webhook do mesmo txid | `replay` + conciliação (8.4) | I | B3.3 | não executado |
| T-DUP-05 | Pagamento histórico, depois webhook | conciliação, sem receita | I | B3.3 | não executado |
| T-DUP-06 | **(rev. 2026-10-20)** Fatura cancelada com substituta do mesmo ciclo paga | sem violação do índice de ciclo; D-P6; SF-2: substituta inalterada, sem aplicação automática, sem renovação, conciliação manual exigida, resolução auditada | I | B3.3 | não executado |
| T-DUP-07 | 2 txids pagos para fatura cancelada | 1 recebimento + conciliação de duplicidade | I | B3.3 | não executado |
| T-DUP-08 | Cancelada paga + substituta paga | 1 renovação do ciclo | I | B3.3 | não executado |

## Pagamento fora de ordem

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ORD-01 | Webhook antes da conclusão do checkout | fatura achada pelo txid (tentativa reservada antes da chamada) | I | B3.3 | não executado |
| T-ORD-02 | Webhook de fatura cancelada | D-P6 | I | B3.3 | não executado |
| T-ORD-03 | Devolução antes da confirmação | conciliação; sem pagamento | I | B3.3 | não executado |
| T-ORD-04 | Webhook atrasado de cobrança antiga após nova paga | conciliação de duplicidade | I | B3.3 | não executado |

## Falha de rede

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-NET-01 | Timeout OAuth Pix | erro tipado em ≤ 15 s | U | B3.1 | não executado |
| T-NET-02 | `ECONNRESET` | promise rejeitada (nunca pendurada) | U | B3.1 | não executado |
| T-NET-03 | Efí 5xx na criação | tentativa `failed`; o retry da mesma tentativa reusa o txid | I | B3.2 | não executado |
| T-NET-04 | Efí 4xx (txid inválido / chave inexistente) | erro sanitizado, sem retry | U | B3.2 | não executado |
| T-NET-05 | **(rev. 2026-10-20)** Timeout em `GET /v2/cob/:txid` no worker | `retry_scheduled` (não 500 para a Efí) | I | B3.3 | não executado |
| T-NET-06 | **(rev. 2026-10-20)** Banco indisponível na recepção | 503 (= T-ASY-02) | I | B3.3 | não executado |
| T-NET-07 | **(rev. 2026-10-20)** Tempo de recepção | < 5 s, sem chamada à Efí | U | B3.3 | não executado |
| T-NET-08 | Falha ao atualizar `SaaSPaymentAttempt` no worker | não perde o pagamento; o evento termina corretamente | I | B3.3 | não executado |
| T-NET-09 | Operação Efí > 20 s | erro tipado de timeout | U | B3.1 | não executado |

## Renovação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-REN-01 | Pagamento gateway renova 1 ciclo (meses-calendário) | `renew-invoice:<id>` | I | B3.3 | não executado |
| T-REN-02 | `SAAS_BILLING_AUTO_RENEW_ON_PAYMENT=false` | paga sem renovar | I | B3.3 | não executado |
| T-REN-03 | Recorrência inválida | pagamento + conciliação (8.4) | I | B3.3 | não executado |
| T-REN-04 | Baixa manual + webhook | 1 renovação | I | B3.3 | não executado |
| T-REN-05 | Fatura cancelada paga | sem renovação (D-P6) | I | B3.3 | não executado |
| T-REN-06 | Nenhuma alteração de bloqueio/flag normalizada | `BILLING_AUTOMATION_NORMALIZED_DATES` intocada | U | B3.3 | não executado |

## Conciliação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-REC-01 | Resolver sem nota | 400 | I | B3.3 | não executado |
| T-REC-02 | Resolver com nota | ator + evento no ledger + mensagem original preservada | I | B3.3 | não executado |
| T-REC-03 | Reprocessar evento persistido | idempotente, auditado (= T-ASY-18) | I | B3.3 | não executado |
| T-REC-04 | Disparo da varredura com flag `false` | 403, nada consultado | U | B3.3 | não executado |
| T-REC-05 | Varredura: `CONCLUIDA` sem pagamento local | item de conciliação (sem baixa automática) | I | B3.3 | não executado |
| T-REC-06 | Varredura repetida | sem itens duplicados | I | B3.3 | não executado |
| T-REC-07 | Fila global lista só os não resolvidos | conforme | I | B3.3 | não executado |
| T-REC-08 | Resolver item já resolvido / concorrente | 409; um único evento | I | B3.3 | não executado |
| T-REC-09 | Fila global com > 100 itens | paginada, nada omitido | I | B3.3 | não executado |
| T-REC-10 | Converter `unlinked` em conciliação / marcar “não é SaaS” | exige nota; auditado; evidência preservada | I | B3.3 | não executado |

## Isolamento multiempresa

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-MT-01 | Checkout de fatura de outra empresa | 403 | I | B3.2 | não executado |
| T-MT-02 | Usuário não-super nas rotas novas | 401 (contrato atual) | I | B3.2 | não executado |
| T-MT-03 | Tentativa grava o `companyId` da fatura | sim | I | B3.2 | não executado |
| T-MT-04 | Webhook paga só a fatura do txid | nenhuma outra empresa afetada | I | B3.3 | não executado |
| T-MT-05 | Conciliação por empresa não mostra itens de outra | conforme | I | B3.3 | não executado |
| T-MT-06 | Socket `payment` emitido só para a empresa da fatura | conforme | I | B3.3 | não executado |
| T-MT-07 | Eventos e reprocessamento só por Super Admin; o tenant não vê eventos | 401 para não-super; nenhum endpoint de tenant | I | B3.3 | não executado |

## Segurança

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-SEC-01 | DTOs e auditoria sem segredo/ciphertext | só máscaras/fingerprint | U | B3.1 | não executado |
| T-SEC-02 | Logs de erro OAuth sanitizados | sem `Bearer`, `client_secret`, PEM | U | B3.1 | não executado |
| T-SEC-03 | Fonte `database` não lê `GERENCIANET_*` | teste com env poluída | U | B3.1 | não executado |
| T-SEC-04 | Slot de produção inacessível em runtime test | 403 | U | B3.1 | não executado |
| T-SEC-05 | URL do webhook fora dos logs da aplicação | query removida | U | B3.3 | não executado |
| T-SEC-06 | Rate limit no webhook | 429 acima do limite; retries normais da Efí passam | I | B3.3 | não executado |
| T-SEC-07 | Payload forjado com txid válido de outra conta | consulta Efí falha/diverge → `invalid_permanent`; nada aplicado | I | B3.3 | não executado |
| T-SEC-08 | Cadastro de webhook não devolve o secret | resposta mascarada | U | B3.2 | não executado |
| T-SEC-09 | Evento persistido sem dados sensíveis | só os campos de R-31 (= T-ASY-19) | U | B3.3 | não executado |
| T-SEC-10 | Sentry `beforeSend` na rota de webhook | sem query e sem `Authorization` | U | B3.3 | não executado |
| T-SEC-11 | `TRUST_PROXY_HOPS`: allowlist/rate limit usam o IP do cliente | conforme; sem o controle, comportamento atual | I | B3.3 | não executado |
| T-SEC-12 | Logs com `invoiceId`, `companyId`, id do evento, sufixos de txid/e2eId | conforme, sem segredo nem dados do pagador | U | B3.3 | não executado |
| T-SEC-13 | Auditoria A1 de cada ação admin nova | 1 registro com ator por ação | I | B3.1–B3.3 | não executado |

## Rollback

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-RB-01 | `database` → `legacy_env` com cobranças abertas criadas pela fonte `database` | pagamentos processados (mesma conta); fonte de origem preservada | I | B3.3 | não executado |
| T-RB-02 | Charge v2 → desligado com cobranças v2 abertas | `#Fatura:` preservado; o pipeline legado consegue processá-las | I | B3.2 | não executado |
| T-RB-03 | Pipeline `async` → pausa (R-33) com eventos chegando | recepção continua; ao retomar, todos processados uma vez | I | B3.3 | não executado |
| T-RB-04 | Pipeline `async` → `legacy` | comportamento atual restaurado; URL nova rejeitada (C4) — exige recadastro, conforme o checklist | I | B3.3 | não executado |
| T-RB-05 | Qualquer rollback | nenhuma linha de evento, pagamento ou tentativa perdida; migrations não revertidas | I | B3.3 | não executado |

## Migrations e interface

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-MIG-01 | Migrations B3 rodadas 2× | idempotentes, sem erro | I | B3.2/B3.3 | não executado |
| T-MIG-02 | `down` das migrations B3 | não apaga dados financeiros existentes | I | B3.2/B3.3 | não executado |
| T-UI-01 | Tela de eventos: filtros por status, txid, empresa; detalhe; reprocessar | conforme RF3.19 | H | B3.4 | não executado |
| T-UI-02 | Fila global de conciliação e consulta de txid | conforme RF3.17/RF2.6 | H | B3.4 | não executado |
| T-UI-03 | Indicadores: pendentes antigos, jobs × eventos, homologação/versão | conforme RF3.19, RNF9 | H | B3.4 | não executado |

## Regressão Fase 8.4

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-REG-01 | Suíte unitária `services/SaasBilling/__tests__` | verde | U | todas | não executado |
| T-REG-02 | Suíte de integração `src/__integration__/*.it.spec.ts` (gatewayPayment, manualPayment, renewal, subscriptionCenter, historicalReview, fechamentoFinal, httpPermissions, billingSimulation, notifications) | verde | I | todas | não executado |
| T-REG-03 | Baixa manual Pix → `manual_pix_no_settle` | mantido | I | B3.2 | não executado |
| T-REG-04 | Cancelamento com Pix ativo registra `externalChargeActive` | mantido | I | B3.3 | não executado |
| T-REG-05 | Edição bloqueada com cobrança externa | mantido | I | B3.3 | não executado |
| T-REG-06 | Simulação de bloqueio inalterada | mantido | I | B3.3 | não executado |
