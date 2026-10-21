# Fase 8.3-B3 — Matriz de testes

Execução: testes da B3.1 e da B3.2 (2026-10-20, local) e da B3.3 (2026-10-21, local). Os demais seguem `não executado`. “Parcial” = cobertura incompleta, **não** aprovado. Detalhes em “Registro B3.1”, no fim.

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
| T-ACT-01 | Todos os controles no default | respostas de checkout e webhook idênticas às atuais (snapshot de contrato) | I | B3.1 | aprovado (B3.1, fechamento) — executado como U em vez de I: contrato completo de checkout + webhook (SDK e modelos simulados) em `efiLegacyContract.spec`; banco real coberto por T-REG-02 |
| T-ACT-02 | Log de boot e `GET /saas/finance/efi/status` | valor efetivo de cada controle, sem segredos | U | B3.1 | aprovado (B3.1, U) |
| T-ACT-03 | Migrations e seeds da B3 aplicados | nenhum controle ligado; comportamento = default | I | B3.2/B3.3 | aprovado (B3.2, I — Postgres real, Efí simulada) — controles no default e v2 inativa após as migrations |
| T-ACT-04 | `EFI_PIX_CHARGE_V2_ENABLED=false` | checkout legado, incluindo `pixConfigWebhook` | I | B3.2 | aprovado (B3.2, U + I) — com `EFI_PIX_CHARGE_V2_ENABLED=true` e o gate de código desligado, contrato legado idêntico, inclusive `pixConfigWebhook` |
| T-ACT-05 | Cadastro admin de webhook com v2 desligado | recusado (C3), sem chamada à Efí | I | B3.2 | aprovado (B3.2, U + I) — 409 `ERR_EFI_WEBHOOK_REGISTER_REQUIRES_V2`, sem chamada à Efí |
| T-ACT-06 | `EFI_WEBHOOK_PIPELINE=legacy` | autenticação e processamento atuais; `token=<secret>/pix` continua rejeitado como hoje (C4); o ramo D-P6 de `confirmGatewayPayment` não executa | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) + U (contrato legado: recepção nova nunca chamada no default) |
| T-ACT-08 | Cadastro admin do webhook com v2 + `legacy` / v2 + `async` | formato atual da URL (`token`) / formato novo; nunca o formato novo com `legacy` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ACT-07 | Combinações de fonte × pipeline × charge v2 (8 combinações) | cada uma funciona; nenhuma muda o financeiro fora do esperado | I | B3.3 | parcial (B3.3) — não aprovado: fonte financeira fixa em `legacy_env` (P-B31-08); pipeline × v2 testados separadamente; as 8 combinações exigem as liberações de código (B3.4) |

## Credenciais

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-CRED-01 | `EFI_CREDENTIALS_SOURCE` ausente | fonte `legacy_env`, log de boot | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-02 | Valor inválido (`foo`) | `legacy_env` + warn | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-03 | `database` sem registro do slot | `ERR_EFI_CONFIG_NOT_FOUND`, sem fallback env | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-04 | `database` com `adminEnabled=false` | erro tipado, checkout 4xx claro | U | B3.1 | aprovado na parte aplicável (provedor → 403 `ERR_EFI_CONFIG_NOT_ENABLED`). Parte “checkout 4xx” **não se aplica à B3.1**: o checkout nunca consulta a fonte `database` (P-B31-08, comprovado em `efiLegacyContract`); reavaliar na B3.2 |
| T-CRED-05 | **(rev. 2026-10-20)** `database` no slot `production` sem homologação válida | bloqueado — ver T-HOM-02 | U | B3.1 | aprovado (B3.1, U) — via T-HOM-02 |
| T-CRED-06 | `database` revogado | `ERR_EFI_CONFIG_REVOKED` | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-07 | Cache: upsert de segredo invalida o token | próxima chamada refaz o OAuth | U | B3.1 | aprovado (B3.1, fechamento) — U ponta a ponta `efiCacheInvalidation.spec` (admin + provedor + cliente Pix reais) |
| T-CRED-08 | Cache: activate/deactivate/revoke/upload/delete invalidam | idem | U | B3.1 | aprovado (B3.1, fechamento) — idem T-CRED-07, 6 ações |
| T-CRED-09 | Cobranças usa a credencial dedicada se existir, senão a Pix | conforme resolvedor | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-10 | `EFI_CREDENTIAL_ENCRYPTION_KEY` errada | `ERR_EFI_CREDENTIAL_DECRYPT_FAILED`, sem vazar ciphertext | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-11 | **(rev. 2026-10-20)** Marcar homologado | substituído por T-HOM-03/04 | — | — | não executado |
| T-CRED-12 | Teste/ativação com P12 que não abre (`createSecureContext` falha) | falha clara, não ativa | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-13 | Fonte `database`: base Cobranças pelo slot, ignorando `GERENCIANET_SANDBOX` | conforme | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-14 | Webhook secret curto (< 32) | 400 | U | B3.1 | aprovado (B3.1, U) |
| T-CRED-15 | **(rev. 2026-10-20)** Contrato `legacy_env` | consolidado em T-ACT-01 | — | — | não executado — consolidado em T-ACT-01 |
| T-CRED-16 | Status unificado: tabela com todas as combinações de campos | admin e resolvedor devolvem o mesmo status | U | B3.1 | aprovado (B3.1, U) |

## Homologação (D-P2, D-P17)

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-HOM-01 | Troca de segredo ou P12 | `configFingerprint` muda; homologação anterior inválida | U | B3.1 | aprovado (B3.1, U) |
| T-HOM-02 | Slot `homologation` com configuração válida e sem homologação / slot `production` sem homologação válida | TESTE opera; PRODUÇÃO bloqueada | U | B3.1 | aprovado (B3.1, U) |
| T-HOM-03 | `homologate` em TESTE sem e com evidência (evento, pagamento gateway, renovação no mesmo fingerprint) | 400 / aceito, com auditoria de fingerprint, ambiente e commit | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-HOM-04 | `homologate` em PRODUÇÃO: referência do relatório TESTE (mesmo commit), configuração válida, webhook conferido, evento `teste` persistido | aceito **sem nenhum `SaaSPayment`**; recusa se faltar um item | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) — sem nenhum `SaaSPayment` |
| T-HOM-05 | Deploy com commit diferente do homologado | status com aviso; integração **não** desabilitada automaticamente | U | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) (status `versionDiffers`, `usable` mantido) |

## Certificados

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-CERT-01 | P12 válido no banco → Agent mTLS em memória | nenhum arquivo gravado (nem temporário) no caminho `database` | U | B3.1 | aprovado (B3.1, U) |
| T-CERT-02 | P12 ausente com `database` | `ERR_EFI_CERTIFICATE_MISSING` | U | B3.1 | aprovado (B3.1, U) |
| T-CERT-03 | P12 corrompido/não PKCS#12 | erro tipado no upload e no uso | U | B3.1 | aprovado (B3.1, U) |
| T-CERT-04 | Troca de P12 | invalida token, ativação e homologação; fingerprint novo | U | B3.1 | aprovado (B3.1, U) — por composição (fingerprint/`adminEnabled` + invalidação) |
| T-CERT-05 | P12 da conta/ambiente errado | OAuth Pix falha com mensagem sanitizada | H | B3.4 | não executado |
| T-CERT-06 | Legado: arquivo `certs/<nome>.p12` ausente | comportamento atual (400) preservado | U | B3.1 | aprovado (B3.1, U) — SDK simulado com ENOENT |

## Ambiente homologação/produção

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ENV-01 | `STREAMHUB_RUNTIME_ENV=test` + `database` | slot `homologation`, base sandbox (PT-4) | U | B3.1 | aprovado (B3.1, fechamento) — credenciais do slot → base Pix sandbox |
| T-ENV-02 | `STREAMHUB_RUNTIME_ENV=production` + `database` | slot `production`, base produção (PT-4) | U | B3.1 | aprovado (B3.1, fechamento) — credenciais do slot → base Pix produção |
| T-ENV-03 | Runtime ausente/inválido + `database` | bloqueio total Efí, erro claro | U | B3.1 | aprovado (B3.1, U) |
| T-ENV-04 | Registro com `efiEnvironment` incompatível | `ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME` | U | B3.1 | aprovado (B3.1, U) |
| T-ENV-05 | `GERENCIANET_SANDBOX` ignorado na fonte `database` | ambiente vem do slot | U | B3.1 | aprovado (B3.1, U) |
| T-ENV-06 | Status mostra fonte, slot, ambiente, fingerprint e homologação | DTO sem segredos | U | B3.1 | aprovado (B3.1, U) |

## Geração de cobrança

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-CHG-01 | Fatura aberta sem cobrança (v2) | cria com txid local; tentativa `creating`→`pending` | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-02 | Fatura com cobrança ativa conferida | devolve a mesma, sem criação | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-03 | Cobrança expirada | cria nova; a antiga fica registrada | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — inclui GET conclusivo antes de abandonar |
| T-CHG-04 | Fatura paga / cancelada | 400 (mantido) | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-05 | Fatura de outra empresa | 403 (mantido) | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-06 | `EFI_PIX_ENABLED=false` | 403 `ERR_PIX_DISABLED` (mantido) | U | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) (via controller) |
| T-CHG-07 | Formato do txid | `[a-zA-Z0-9]{26,35}`, único | U | B3.2 | aprovado (B3.2, U) |
| T-CHG-08 | Checkout v2 não chama registro de webhook | nenhum `PUT /v2/webhook` | U | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-09 | Resposta v2 sem campos internos | só QR/copia-e-cola e dados usados | U | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-10 | Consulta admin de txid | dados da Efí; só `gatewayStatus` atualizado | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — fatura paga não recebe o espelho de status |
| T-CHG-11 | Tentativa grava fonte, `configId`, slot, ambiente e commit | conforme | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-12 | Cadastro e consulta de webhook (admin, v2) | auditados; secret mascarado | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — com a v2 ligada só no teste (spy do gate) |
| T-CHG-13 | Criação lenta na Efí (mock 10 s) | webhook, baixa manual e cancelamento da fatura não ficam bloqueados | I | B3.2 | aprovado (B3.2, I) — lock da fatura livre (`FOR UPDATE NOWAIT`) durante o PUT lento; mock bloqueado até liberar, não 10 s fixos |
| T-CHG-14 | Tentativa `creating` órfã | GET do txid antes de criar outra | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-15 | Fatura paga/cancelada durante a chamada Efí | QR não exibido; tentativa registrada | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) (cancelada e paga) |
| T-CHG-16 | Txid repetido em `SaaSPaymentAttempts` | violação do índice único | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-CHG-17 | PUT repetido devolve conflito (mock) | GET + comparação de valor e chave | U | B3.2 | aprovado (B3.2, U + I) — inclusive conflito com cobrança divergente, que fica `blocked` |

## Idempotência (cobrança)

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-IDEM-01 | 2 checkouts concorrentes da mesma fatura | 1 cobrança, mesma resposta | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — também com falha concorrente sem rebaixar a tentativa |
| T-IDEM-02 | Repetir `PUT /v2/cob/:txid` após timeout | mesma cobrança (via GET); sem duplicata local | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-IDEM-03 | Clique duplo no frontend | 1 cobrança | H | B3.4 | não executado |
| T-IDEM-04 | Duas abas com intervalo maior que a expiração | 2ª cria nova; 1ª expirada | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |

## Webhook — recepção e autenticação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-WH-01 | **(rev. 2026-10-20)** URL com token novo e `/pix` acrescentado conforme o contrato real (PT-2) | aceito (`async`) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) — contra o contrato documentado; path/query reais com `/pix` **não validados em sandbox** (PT-2, B3.4) |
| T-WH-02 | `token` legado (`async`) | aceito (transição) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-03 | Secret errado / ausente | 401; **nada persistido** | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-04 | Comparação em tempo constante | `timingSafeEqual` usado | U | B3.3 | aprovado (B3.3, U) |
| T-WH-05 | IP fora da allowlist (com `TRUST_PROXY_HOPS`) | 403; nada persistido | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-06 | `teste_webhook` | 200; persistido como `teste` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-07 | `CONCLUIDA` + fatura aberta + valor igual | evento `applied`: pagamento + renovação | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-08 | **(rev. 2026-10-20)** Cobrança `ATIVA` no processamento | `retry_scheduled`; aplica quando `CONCLUIDA` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-09 | Fatura inexistente | `reconciliation` + item | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-10 | Valor divergente | `reconciliation` + item | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-11 | **(rev. 2026-10-20)** Pix sem txid: origem indeterminada / comprovadamente fora do SaaS | `unlinked` com evidência / `ignored_not_saas`, sem pendência | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-12 | `devolucoes` presente | `reconciliation` (devolução); sem estorno | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-13 | **(rev. 2026-10-20)** Lote com 1 item transitório + 1 ok | 200 após persistir os dois; ok → `applied`; transitório → `retry_scheduled` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-14 | **(rev. 2026-10-20)** Reentrega do mesmo evento | 1 linha por `eventKey`; 200 | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-15 | Txid anterior à migração (sem tentativa local) | fallback `#Fatura:`, credenciais env | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-16 | `token=<secret>/pix` (URL legada com sufixo, `async`) | aceito | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-WH-17 | **(rev. 2026-10-20)** Devolução com o mesmo e2eId do Pix | `eventKey` distinto; tratada como devolução, não replay | I | B3.3 | aprovado (B3.3, U) |
| T-WH-18 | **(rev. 2026-10-20)** Orçamento síncrono de 30 s | obsoleto (D-P18 B). Substituído: recepção < 5 s sem chamada Efí (T-NET-07) | — | — | não executado |
| T-WH-19 | **(rev. 2026-10-20)** Corpo sem estrutura reconhecível (JSON inválido, sem `pix`/`evento`) | 400; sem 500 nem evento Sentry com URL | I | B3.3 | aprovado (B3.3, U) + I (400 no async; legado mantém 500) |
| T-WH-20 | Lote com 1 item inválido + 1 Pix válido | 200; válido persistido e processado; inválido persistido como `invalid_permanent` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Webhook — processamento assíncrono (D-P18)

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ASY-01 | Persistência antes do 200 (commit lento, instrumentado) | a resposta só sai após o commit | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-02 | PostgreSQL falha no INSERT | 503; nada publicado; nenhuma linha | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-03 | PostgreSQL falha no commit de um lote com N itens | 503; nenhuma linha parcial | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-04 | Redis indisponível na recepção | 200; eventos `received`; nenhuma exceção não tratada | I | B3.3 | aprovado (B3.3, I — Postgres real + Bull 4/Redis real, Efí simulada) + B3.3, I — Postgres real, Efí e fila simuladas |
| T-ASY-05 | Falha na publicação do job após o commit | 200; evento `received`; log sanitizado | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-06 | Redis volta | a recuperação republica; cada evento processado uma vez | I | B3.3 | aprovado (B3.3, I — Postgres real + Bull 4/Redis real, Efí simulada) + B3.3, I — Postgres real, Efí e fila simuladas |
| T-ASY-07 | Worker reiniciado após o claim e antes da confirmação | lock antigo → `retry_scheduled` → processado uma vez | I | B3.3 | aprovado (B3.3, I — Postgres real + Bull 4/Redis real, Efí simulada) + B3.3, I — Postgres real, Efí e fila simuladas |
| T-ASY-08 | Crash após `confirmGatewayPayment` e antes de gravar o resultado | reprocessamento → `replay`; 1 pagamento, 1 renovação | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-09 | Mesmo evento recebido 3× | 1 linha, 1 job | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-10 | Dois jobs para o mesmo evento | só um passa no claim; o outro encerra sem efeito | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-11 | Dois workers (dois processos) concorrentes | uma execução por evento | I | B3.3 | aprovado (B3.3, I — Postgres real + Bull 4/Redis real, Efí simulada) — dois workers Bull com conexões distintas no mesmo processo; processos separados: B3.4 |
| T-ASY-12 | Falha transitória | `retry_scheduled`; backoff respeitado (`nextAttemptAt`) | U | B3.3 | aprovado (B3.3, U) + I |
| T-ASY-13 | Retentativas esgotadas | `failed_exhausted` + item de conciliação + destaque na tela | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) — destaque na tela implementado, verificação visual em T-UI-01 (B3.4) |
| T-ASY-14 | Falha permanente (txid inexistente na conta) | `invalid_permanent`; sem retentativa; evidência preservada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-15 | Recuperação: `processing` com lock antigo | volta a `retry_scheduled` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-16 | Conciliação fila × banco | job órfão removido; evento sem job republicado; nada duplicado | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-17 | `EFI_WEBHOOK_WORKER_PAUSED=true` | recepção 200 e persistência; nada processado; ao retomar, todos processados | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-18 | Reprocessamento manual | permitido só nos status de R-30, com nota e auditoria; negado para `applied`/`replay` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-19 | Payload persistido | sem `infoPagador`, nome/CPF, cabeçalhos ou query | U | B3.3 | aprovado (B3.3, U) + I |
| T-ASY-20 | Corpo da resposta 200 | indica só “recebido”; não afirma pagamento processado | U | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-21 | Lote com eventos novos e repetidos | só os novos geram linha e job | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-22 | Cobrança `ATIVA` → `CONCLUIDA` entre retentativas | aplica uma vez | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-23 | Evento de cobrança emitida antes da migração | processado via `#Fatura:` e conta env | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-24 | Evento de cobrança criada pela fonte `database` após voltar a `legacy_env` | processado (mesma conta, D-P14); fonte de origem registrada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-25 | Multiempresa no worker | aplica só na empresa da fatura; filtros por empresa corretos | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-26 | **(rev. 2026-10-20)** Devolução processada antes do Pix do mesmo e2eId | conciliação de devolução; Pix: evidência + conciliação, sem pagamento aplicado nem renovação (SF-3); nunca estorno ou compensação automática | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-27 | Pix de cobrança antiga chega depois de outra cobrança da mesma fatura já paga | conciliação “possível duplicidade”; sem renovação | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-28 | Baixa manual anterior ao evento (mesmo txid) | `replay`/conciliação; 1 renovação | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-29 | Fatura cancelada paga | recebimento idempotente; status `cancelled`; sem renovação; conciliação; 2º txid → duplicidade; rastreabilidade preservada; fora da receita consolidada até a conciliação (SF-1) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-30 | Sem renovação duplicada (baixa manual + gateway + reprocesso + republicação) | exatamente 1 renovação por fatura | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ASY-31 | Evento `teste` persistido | disponível como evidência para T-HOM-04 | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Pagamento duplicado

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-DUP-01 | Mesmo txid 2× | 1 pagamento, 1 renovação | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-02 | Mesmo txid simultâneo | idem (claim + lock) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-03 | 2 txids pagos para a mesma fatura (legado, N cobranças) | 1 pagamento + conciliação de duplicidade | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-04 | Baixa manual, depois webhook do mesmo txid | `replay` + conciliação (8.4) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-05 | Pagamento histórico, depois webhook | conciliação, sem receita | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-06 | **(rev. 2026-10-20)** Fatura cancelada com substituta do mesmo ciclo paga | sem violação do índice de ciclo; D-P6; SF-2: substituta inalterada, sem aplicação automática, sem renovação, conciliação manual exigida, resolução auditada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-07 | 2 txids pagos para fatura cancelada | 1 recebimento + conciliação de duplicidade | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-DUP-08 | Cancelada paga + substituta paga | 1 renovação do ciclo | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Pagamento fora de ordem

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-ORD-01 | Webhook antes da conclusão do checkout | fatura achada pelo txid (tentativa reservada antes da chamada) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ORD-02 | Webhook de fatura cancelada | D-P6 | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ORD-03 | Devolução antes da confirmação | conciliação; sem pagamento | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-ORD-04 | Webhook atrasado de cobrança antiga após nova paga | conciliação de duplicidade | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Falha de rede

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-NET-01 | Timeout OAuth Pix | erro tipado em ≤ 15 s | U | B3.1 | aprovado (B3.1, U, servidor HTTP local) |
| T-NET-02 | `ECONNRESET` | promise rejeitada (nunca pendurada) | U | B3.1 | aprovado (B3.1, U, servidor HTTP local) |
| T-NET-03 | Efí 5xx na criação | tentativa `failed`; o retry da mesma tentativa reusa o txid | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-NET-04 | Efí 4xx (txid inválido / chave inexistente) | erro sanitizado, sem retry | U | B3.2 | aprovado (B3.2, U + I) — recusa de validação conhecida é definitiva; nome desconhecido é tratado como incerto |
| T-NET-05 | **(rev. 2026-10-20)** Timeout em `GET /v2/cob/:txid` no worker | `retry_scheduled` (não 500 para a Efí) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-NET-06 | **(rev. 2026-10-20)** Banco indisponível na recepção | 503 (= T-ASY-02) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-NET-07 | **(rev. 2026-10-20)** Tempo de recepção | < 5 s, sem chamada à Efí | U | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) (< 5 s, nenhuma chamada à Efí) |
| T-NET-08 | Falha ao atualizar `SaaSPaymentAttempt` no worker | não perde o pagamento; o evento termina corretamente | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-NET-09 | Operação Efí > 20 s | erro tipado de timeout | U | B3.1 | aprovado (B3.1, U, servidor HTTP local) |

## Renovação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-REN-01 | Pagamento gateway renova 1 ciclo (meses-calendário) | `renew-invoice:<id>` | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REN-02 | `SAAS_BILLING_AUTO_RENEW_ON_PAYMENT=false` | paga sem renovar | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REN-03 | Recorrência inválida | pagamento + conciliação (8.4) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REN-04 | Baixa manual + webhook | 1 renovação | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REN-05 | Fatura cancelada paga | sem renovação (D-P6) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REN-06 | Nenhuma alteração de bloqueio/flag normalizada | `BILLING_AUTOMATION_NORMALIZED_DATES` intocada | U | B3.3 | aprovado (B3.3, U) — guarda estrutural: nenhum módulo B3.3 lê a flag ou o job de bloqueio |

## Conciliação

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-REC-01 | Resolver sem nota | 400 | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-02 | Resolver com nota | ator + evento no ledger + mensagem original preservada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-03 | Reprocessar evento persistido | idempotente, auditado (= T-ASY-18) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-04 | Disparo da varredura com flag `false` | 403, nada consultado | U | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) — gate de código desligado → 403, nada consultado |
| T-REC-05 | Varredura: `CONCLUIDA` sem pagamento local | item de conciliação (sem baixa automática) | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-06 | Varredura repetida | sem itens duplicados | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-07 | Fila global lista só os não resolvidos | conforme | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-08 | Resolver item já resolvido / concorrente | 409; um único evento | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-09 | Fila global com > 100 itens | paginada, nada omitido | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-REC-10 | Converter `unlinked` em conciliação / marcar “não é SaaS” | exige nota; auditado; evidência preservada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Isolamento multiempresa

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-MT-01 | Checkout de fatura de outra empresa | 403 | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-MT-02 | Usuário não-super nas rotas novas | 401 (contrato atual) | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — 401 nas 3 rotas novas |
| T-MT-03 | Tentativa grava o `companyId` da fatura | sim | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) |
| T-MT-04 | Webhook paga só a fatura do txid | nenhuma outra empresa afetada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-MT-05 | Conciliação por empresa não mostra itens de outra | conforme | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-MT-06 | Socket `payment` emitido só para a empresa da fatura | conforme | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-MT-07 | Eventos e reprocessamento só por Super Admin; o tenant não vê eventos | 401 para não-super; nenhum endpoint de tenant | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Segurança

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-SEC-01 | DTOs e auditoria sem segredo/ciphertext | só máscaras/fingerprint | U | B3.1 | aprovado (B3.1, U) |
| T-SEC-02 | Logs de erro OAuth sanitizados | sem `Bearer`, `client_secret`, PEM | U | B3.1 | aprovado (B3.1, fechamento) — logs (info/warn/error/debug), retorno e auditoria do test-auth sem segredo, Bearer ou PEM |
| T-SEC-03 | Fonte `database` não lê `GERENCIANET_*` | teste com env poluída | U | B3.1 | aprovado (B3.1, U) |
| T-SEC-04 | Slot de produção inacessível em runtime test | 403 | U | B3.1 | aprovado (B3.1, U) |
| T-SEC-05 | URL do webhook fora dos logs da aplicação | query removida | U | B3.3 | aprovado (B3.3, U) |
| T-SEC-06 | Rate limit no webhook | 429 acima do limite; retries normais da Efí passam | I | B3.3 | aprovado (B3.3, U) + I — conta só falhas de autenticação e só com `TRUST_PROXY_HOPS` (revisão cruzada) |
| T-SEC-07 | Payload forjado com txid válido de outra conta | consulta Efí falha/diverge → `invalid_permanent`; nada aplicado | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-SEC-08 | Cadastro de webhook não devolve o secret | resposta mascarada | U | B3.2 | aprovado (B3.2, U) + I — URL e chave mascaradas na resposta e na auditoria |
| T-SEC-09 | Evento persistido sem dados sensíveis | só os campos de R-31 (= T-ASY-19) | U | B3.3 | aprovado (B3.3, U) + I |
| T-SEC-10 | Sentry `beforeSend` na rota de webhook | sem query e sem `Authorization` | U | B3.3 | aprovado (B3.3, U) |
| T-SEC-11 | `TRUST_PROXY_HOPS`: allowlist/rate limit usam o IP do cliente | conforme; sem o controle, comportamento atual | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-SEC-12 | Logs com `invoiceId`, `companyId`, id do evento, sufixos de txid/e2eId | conforme, sem segredo nem dados do pagador | U | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-SEC-13 | Auditoria A1 de cada ação admin nova | 1 registro com ator por ação | I | B3.1–B3.3 | aprovado: B3.1 (U, 7 ações), B3.2 (I, `webhook_register`) e B3.3 (I: `homologate`, `webhook_event_reprocess`, `webhook_event_classify`, `pix_sweep`; resolução de conciliação no ledger `reconciliation_resolved`) |

## Rollback

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-RB-01 | `database` → `legacy_env` com cobranças abertas criadas pela fonte `database` | pagamentos processados (mesma conta); fonte de origem preservada | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-RB-02 | Charge v2 → desligado com cobranças v2 abertas | `#Fatura:` preservado; o pipeline legado consegue processá-las | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — webhook legado processa a cobrança v2 pelo `#Fatura:` |
| T-RB-03 | Pipeline `async` → pausa (R-33) com eventos chegando | recepção continua; ao retomar, todos processados uma vez | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-RB-04 | Pipeline `async` → `legacy` | comportamento atual restaurado; URL nova rejeitada (C4) — exige recadastro, conforme o checklist | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |
| T-RB-05 | Qualquer rollback | nenhuma linha de evento, pagamento ou tentativa perdida; migrations não revertidas | I | B3.3 | aprovado (B3.3, I — Postgres real, Efí e fila simuladas) |

## Migrations e interface

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-MIG-01 | Migrations B3 rodadas 2× | idempotentes, sem erro | I | B3.2/B3.3 | aprovado (B3.2 e B3.3, I) — B3.3: `up` 2× sem erro |
| T-MIG-02 | `down` das migrations B3 | não apaga dados financeiros existentes | I | B3.2/B3.3 | aprovado (B3.2 e B3.3, I) — B3.3: `down` recusado com eventos gravados (nada apagado) |
| T-UI-01 | Tela de eventos: filtros por status, txid, empresa; detalhe; reprocessar | conforme RF3.19 | H | B3.4 | não executado (H, B3.4) — telas implementadas na B3.3; build do frontend ok |
| T-UI-02 | Fila global de conciliação e consulta de txid | conforme RF3.17/RF2.6 | H | B3.4 | não executado (H, B3.4) — telas implementadas na B3.3; build do frontend ok |
| T-UI-03 | Indicadores: pendentes antigos, jobs × eventos, homologação/versão | conforme RF3.19, RNF9 | H | B3.4 | não executado (H, B3.4) — telas implementadas na B3.3; build do frontend ok |

## Regressão Fase 8.4

| ID | Cenário | Esperado | Tipo | Etapa | Estado |
|----|---------|----------|------|-------|--------|
| T-REG-01 | Suíte unitária `services/SaasBilling/__tests__` | verde | U | todas | aprovado na B3.2 — 33 suítes / 373 testes. **B3.3: parcial** — rodada antes das correções finais (6 falhas de guarda estrutural, corrigidas e reexecutadas); reexecução completa pendente (interrompida por memória) |
| T-REG-02 | Suíte de integração `src/__integration__/*.it.spec.ts` (gatewayPayment, manualPayment, renewal, subscriptionCenter, historicalReview, fechamentoFinal, httpPermissions, billingSimulation, notifications) | verde | I | todas | aprovado na B3.3 — 15 suítes / 210 testes (inclui as 3 suítes novas da B3.3, Redis real) |
| T-REG-03 | Baixa manual Pix → `manual_pix_no_settle` | mantido | I | B3.2 | aprovado (B3.2, I — Postgres real, Efí simulada) — baixa manual de fatura com cobrança v2 → `manual_pix_no_settle` |
| T-REG-04 | Cancelamento com Pix ativo registra `externalChargeActive` | mantido | I | B3.3 | aprovado (U existente: `manageSaasInvoiceCancel.spec`, na suíte T-REG-01) |
| T-REG-05 | Edição bloqueada com cobrança externa | mantido | I | B3.3 | aprovado (U existente: `manageSaasInvoice.spec`, na suíte T-REG-01) |
| T-REG-06 | Simulação de bloqueio inalterada | mantido | I | B3.3 | aprovado (I existente: `billingSimulation.it.spec`, na suíte T-REG-02) |

## Registro B3.1 (2026-10-20, execução local)

Ambiente: macOS, Node local, Jest 27; carga alta na máquina (load 10–14). Nenhum acesso a VPS; nenhuma chamada à Efí
real (HTTP simulado por mock do axios ou servidor HTTP local em 127.0.0.1). P12 de teste autoassinado
(`__tests__/fixtures/efiTestP12.ts`, CN=b31-test-fixture), sem valor real.

Specs da B3.1 (`backend/src/services/SaasBilling/__tests__/`): `efiActivationControls`, `efiPixClient`,
`efiRuntimeCredentials`, `efiLegacyContract` (novos); `efiCredentialResolver`, `PlatformEfiConfigAdminService`,
`efiIntegrationStatus`, `efiCertificateStore` (atualizados).

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| T-REG-01 | `NODE_ENV=test npx jest --coverage=false --bail=0 src/services/SaasBilling src/__tests__ src/controllers` | aprovado na B3.2 — 33 suítes / 373 testes |
| T-REG-02 | `scripts/test-integration-f84.sh` (container `atendechat-f84-testdb`, banco criado e removido) | aprovado na B3.2 — 12 suítes / 142 testes (inclui `pixChargeV2.it.spec`, 40 testes) |
| Suíte unitária completa | `NODE_ENV=test npx jest --coverage=false --bail=0` | 271/283 suítes, 2566/2604 testes. Falhas: `efiPixClient` (T-NET-09 instável, corrigido depois e reexecutado: 10/10), `billingSimulation` (timeout de 5 s por carga; isolado: verde) e 10 suítes **pré-existentes** |
| Falhas pré-existentes | as mesmas 10 suítes num worktree limpo do HEAD `88d1c30` | 10 suítes / 35 testes falham também no HEAD: `mcpRuntime`, `evolutionQuotedEcho`, `evolutionOutboundEcho`, `aiAgentNaturalResponsePacing`, `inventoryBarcode`, `listInventoryProducts`, `inventoryProductUnit`, `processors`, `knowledgeProcessing`, `aiAgentProductWizardContract` — fora do escopo B3 |
| Typecheck | `node_modules/.bin/tsc --noEmit -p .` | exit 0 |
| Build | `npm run build` (backend) | exit 0 |

Não executados na B3.1: snapshot I de T-ACT-01, T-CRED-15, T-SEC-13 e os testes de outras etapas.

### Fechamento técnico B3.1 (2026-10-20)

Specs novas: `efiBuildInfo` (P-B31-01), `efiCacheInvalidation` (T-CRED-07/08). Ampliadas: `efiLegacyContract` (T-ACT-01 e
P-B31-08: checkout + webhook idênticos com `EFI_CREDENTIALS_SOURCE=database`, zero leituras do banco; guarda estrutural de
chamadores financeiros), `efiRuntimeCredentials` (P-B31-08 no provedor e no settle; P-B31-03; T-ENV-01/02),
`efiCredentialResolver`, `efiIntegrationStatus`, `PlatformEfiConfigAdminService` (auditoria da ativação na transação,
T-SEC-02, T-SEC-13, decifragem falha sem 500, commit com falha), `efiActivationControls` (aviso de boot).

| Verificação | Resultado |
|-------------|-----------|
| P-B31-08 — isolamento financeiro | aprovado (U): checkout, webhook, settle e boleto em `legacy_env` com `database` configurado |
| P-B31-01 — versão | aprovado (U + script real em repositório git temporário): HEAD, `dirty`, fallback env, `null` sem fonte, build nunca quebra. `npm run build` real gravou `dist/build-info.json` com o HEAD local e `dirty: true` |
| P-B31-03 — validação Pix | aprovado (U): ativação B2, fingerprint/ambiente diferentes, `pixOAuthValidated=false` e segredo trocado depois → `ERR_EFI_PIX_VALIDATION_REQUIRED` |
| Typecheck | `node_modules/.bin/tsc --noEmit -p .` exit 0 |
| Build | `npm run build` exit 0 |
| T-REG-01 | aprovado na B3.2 — 33 suítes / 373 testes |
| T-REG-02 | aprovado na B3.2 — 12 suítes / 142 testes (inclui `pixChargeV2.it.spec`, 40 testes) |
| Suíte completa | 276/286 suítes, 2603/2638 testes. Falham **só** as 10 suítes / 35 testes pré-existentes (mesmas do HEAD `88d1c30`) |

**Contagem da suíte (investigada):** a execução anterior listou 283 suítes contra 284 arquivos porque
`efiLegacyContract.spec.ts` foi criado depois de a execução começar. Agora `find` e `jest --listTests` dão 286 = 286 suítes
executadas. O total passou de 2604 para 2638 testes só pelos testes novos do fechamento; as falhas seguem as mesmas 35.

Seguem não executados: T-CRED-15 (consolidado em T-ACT-01) e os testes das outras etapas.

## Registro B3.2 (2026-10-20, execução local)

Ambiente local; nenhuma VPS, nenhuma chamada à Efí real (gateway em memória e SDK mockado), nenhuma cobrança real.
A cobrança v2 só é ligada dentro dos testes (spy de `isEfiPixChargeV2Active`); no código o gate segue desligado.

Specs: `src/__integration__/pixChargeV2.it.spec.ts` (40 testes, Postgres real) e
`services/SaasBilling/__tests__/efiPixChargeV2.spec.ts` (unidade: txid, valor, conferência, gate, máscaras, gateway SDK e
cliente próprio). Ampliadas: `efiLegacyContract` (T-ACT-04, guarda estrutural de chamadores financeiros),
`efiActivationControls` e `efiIntegrationStatus` (aviso de boot e status do v2).

Cenários pedidos na missão, todos executados e aprovados: reuso de cobrança ativa; expirada; tentativas simultâneas;
falha de rede/5xx; timeout (inclusive SDK pendurado); recuperação após interrupção (órfã e recuperação tardia);
idempotência por txid; valor divergente; chave Pix divergente; credenciais alteradas; fatura cancelada (e paga) durante a
operação; rollback (T-RB-02); compatibilidade com o legado (T-ACT-04, contrato). Também: CONCLUIDA sem baixa (inclusive
após o vencimento), pagamento no último instante, `blocked` liberado só após vencer na Efí, cobrança sem `calendario`.

| Verificação | Resultado |
|-------------|-----------|
| Typecheck | `node_modules/.bin/tsc --noEmit -p .` exit 0 |
| Build backend | `npm run build` exit 0 (migration nova em `dist/`) |
| Build frontend | `npm run build` exit 0 |
| T-REG-01 | 33 suítes / 373 testes verdes |
| T-REG-02 | 12 suítes / 142 testes verdes |
| Suíte completa | 277/287 suítes, 2622/2657 testes. Falham **só** as 10 suítes / 35 testes pré-existentes (P-B31-09) |

**Não executados:** tarefa 0 / validação em sandbox de PT-2, PT-3, PT-5 (P-B32-01); T-IDEM-03 (H, B3.4); testes das outras
etapas. T-ACT-01 da B3.2 coberto pelo contrato legado (U) e por T-REG-02.

## Registro B3.3 (2026-10-21, execução local)

Ambiente local; nenhuma VPS, nenhum banco remoto, nenhuma chamada à Efí real (gateway em memória), nenhuma cobrança real,
nenhum webhook cadastrado. Postgres descartável (`atendechat-f84-testdb`) e Redis descartável local (`redis:7.4.2`,
`127.0.0.1:56379`, removido ao fim). Pipeline e varredura ligados só nos testes (spies dos gates); no código seguem
desligados (`EFI_RELEASED_RUNTIMES.webhookPipeline` vazio, `EFI_RELEASED_RUNTIMES.pixReconciliationSweep` vazio).

Specs novas:
- `services/SaasBilling/__tests__/efiWebhookReception.spec.ts` (U, 22 testes): autenticação, `/pix`, `timingSafeEqual`, allowlist, rate limit, forma do corpo, payload mínimo, sanitização de log/Sentry, gates, backoff, URL nova, T-REN-06.
- `__integration__/gatewayWebhookPipeline.it.spec.ts` (I, 50 testes): recepção, persistência, falhas de banco/Redis, processamento RF3.10, D-P6/SF-1/SF-2, D-P7/SF-3, D-P8, retentativas, recuperação, pausa, rollback.
- `__integration__/gatewayWebhookAdmin.it.spec.ts` (I, 13 testes): permissões, eventos, reprocessamento, classificação, conciliação, varredura, cadastro do webhook, homologação.
- `__integration__/gatewayWebhookRedis.it.spec.ts` (I, 5 testes, exige `REDIS_IT_URI`; sem ela aparece como pulada): PT-8, ponta a ponta, Redis fora/volta, reinício do worker, dois workers Bull.

Atualizada: `efiLegacyContract.spec` (guardas estruturais do controller e do novo chamador de credencial; a recepção nova nunca é chamada no default).

| Verificação | Resultado |
|-------------|-----------|
| Typecheck | `node_modules/.bin/tsc --noEmit -p .` exit 0 (após as correções da revisão cruzada) |
| Build backend | `npm run build` exit 0 (`dist/build-info.json` gravado; árvore suja) |
| Unitárias B3.3 + contrato legado | `efiWebhookReception` + `efiLegacyContract`: 27/27 verdes (após as correções) |
| T-REG-01 (`src/services/SaasBilling src/__tests__ src/controllers`) | executada **antes** das correções finais: 32/33 suítes, 367/373; as 6 falhas eram as guardas de `efiLegacyContract` (corrigidas e reexecutadas: verdes). **A suíte T-REG-01 inteira não foi reexecutada depois das correções** |
| T-REG-02 + integração B3.3 (`scripts/test-integration-f84.sh`, `REDIS_IT_URI`) | **15 suítes / 210 testes verdes**, após as correções |
| Suíte unitária completa | **não concluída**: interrompida pelo sistema por memória baixa (28 suítes já verdes; 2 falhas vistas são das pré-existentes P-B31-09: `aiAgentNaturalResponsePacing`, `mcpRuntime`) |
| Build frontend | exit 0 na execução do implementador das telas ("Compiled with warnings", nenhum aviso nos arquivos novos); a reexecução final foi interrompida por memória baixa |
| Testes frontend `src/pages/Platform/__tests__` | 2 suítes / 4 testes verdes (execução do implementador das telas) |

Revisão cruzada (dois revisores independentes, só leitura: segurança e regressão financeira). Achados corrigidos:
1. Rate limit antes da autenticação compartilhava a cota (lixo sem token barraria a Efí) → conta só falhas de autenticação, só com `TRUST_PROXY_HOPS`, e poda entradas vencidas em vez de limpar tudo.
2. Reprocesso de recebimento em fatura cancelada terminava `replay` sem item → agora `reconciliation` com o item D-P6.
3. Converter `unlinked` duas vezes duplicava o item → idempotente por `eventKey`.
4. Commit do relatório TESTE aceitava prefixo de 1 caractere → exige SHA de 7–40 hex.
5. Empresa inexistente na conversão → 400 (antes 500 por FK).
6. Teto de 2000 eventos por notificação (itens + devoluções; até 20 devoluções por item).
Sem achados críticos. Validado também: nenhum caminho de pagamento sem GET na Efí, sem SQL injection, sem segredo ou dado do pagador persistido/logado, rotas novas `isAuth + isSuper`, gates impedem ativação por env.

**Não executados / pendentes:** validação em sandbox (PT-2, PT-5, PT-6, PT-7, P-B32-01/03); T-ACT-07 (parcial); T-UI-01…03 (H, B3.4); dois workers em processos separados (T-ASY-11 coberto com duas conexões Bull no mesmo processo); reexecução completa de T-REG-01 e da suíte unitária após as correções; reexecução do build frontend.

## Registro B3.4-prep (2026-10-21, execução local)

Preparação local da B3.4 (DECISOES §13, B34-T1…T6). Nada executado em VPS, banco remoto ou Efí real.

| Verificação | Resultado |
|-------------|-----------|
| Build backend (`npm run build`, inclui `tsc`) | exit 0; `dist/build-info.json` → `52a41f8` (árvore suja: alterações ainda não commitadas) |
| Build frontend (`npm run build`) | exit 0, "Compiled with warnings" (avisos pré-existentes, nenhum nos arquivos novos) |
| T-REG-01 (`src/services/SaasBilling src/__tests__ src/controllers`) | **34/34 suítes, 397/397 testes verdes** (reexecutada após todas as correções) |
| T-REG-02 + integração B3 (`scripts/test-integration-f84.sh`, `REDIS_IT_URI`) | **15/15 suítes, 210/210 testes verdes**, nenhuma pulada (inclui `gatewayWebhookRedis`) |
| Suíte unitária completa (`-w 2`) | 277/288 suítes, 2645/2681 testes. Falhas: as 10 suítes pré-existentes P-B31-09 (35 testes) + 1 teste de `liveHardening.spec` (concorrência), que passa isolado (12/12) e cujo módulo não foi alterado (`AutomationOrchestrator`, `git diff` vazio). Nenhuma falha em código da B3 |
| Testes frontend `src/pages/Platform/__tests__` | 3 suítes verdes (inclui `EfiActivationStatusCard`) |
| Ensaio de migrations (Postgres descartável com dados) | txid duplicado faz a `20261020120000` parar sem alterar dados; corrigido o dado, as duas aplicam; segunda execução não faz nada; dados preservados; banco removido |
| `preflight-teste.sql` | executado no banco descartável: só leitura (`READ ONLY` + `ROLLBACK`), sem colunas cifradas |
| `scripts/check-efi-p12.js` | fixture abre (CN=b31-test-fixture), fingerprint igual ao do painel; saída 2 sem argumento/arquivo |

Observação: o `liveHardening.spec` isolado passa, mas o processo jest não encerra sozinho (handle aberto no módulo, não da B3); rodar com `--forceExit`.

**Não executados / pendentes (dependem da VPS de TESTE e sandbox Efí, B3.4):** PT-2, PT-5, PT-6 (mTLS), PT-7, P-B32-01/03, T-UI-01…03, H-* (IMPLANTACAO-TESTE §8).

### Guarda B34-T7/T8 (2026-10-21, execução local)
| Verificação | Resultado |
|-------------|-----------|
| `efiActivationGuard.spec` (novo) | 8/8: estado misto, `legacy_env`, runtime errado/ausente, defaults, invariante do release, bloqueio de rede |
| Typecheck (`tsc --noEmit`) | exit 0 |
| T-REG-01 | 35/35 suítes, 405/405 testes |
| Integração (`test-integration-f84.sh`, `REDIS_IT_URI`) | 209/210; a falha foi timeout de 60 s em `historicalReview.it.spec` (8.4, não B3). Reexecutada isolada: 18/18 |
| Unitária completa (`--bail=0 --forceExit`) | 278/289 suítes, 2651/2689 testes. As mesmas 11 suítes de antes (P-B31-09 + `liveHardening`, que só falha sob carga: 3 testes agora, 1 antes). Bloqueio Efí não disparou em nenhuma suíte |
| Build backend | exit 0, `build-info` → `c1e1b42` (árvore suja até o commit destas correções) |
| Build frontend | não reexecutado: nenhum arquivo do frontend mudou desde o último build verde |

Observação: `jest.config.js` tem `bail: 1`; a suíte completa precisa de `--bail=0` para rodar inteira.
