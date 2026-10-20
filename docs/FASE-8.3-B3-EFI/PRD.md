# PRD — Fase 8.3-B3: integração de cobrança e pagamento Efí à configuração do Super Admin

**Status:** aprovado em direção (2026-10-20) · **Base:** `main` @ `2445edb` · **Auditoria:** `AUDITORIA.md` · **Decisões:** `DECISOES.md`

As decisões D-P1…D-P17 foram aprovadas na alternativa A, com ajustes, e a D-P18 na alternativa B. Os pontos que ainda
dependem de validação técnica estão marcados **[PT-n]**. As subdecisões financeiras SF-1, SF-2 e SF-3 e a biblioteca de
fila (PT-1: Bull 4) foram aprovadas em 2026-10-20. Os valores numéricos são propostas técnicas (R-*), ajustáveis na etapa.

## 1. Contexto e problema

A B1/B2 criou o armazenamento cifrado e a gestão administrativa das credenciais Efí (`PlatformEfiConfigs`). Nenhum fluxo
de dinheiro usa essa configuração: checkout Pix, webhook e Cobranças leem variáveis de ambiente pelo SDK
`gn-api-sdk-typescript@1.0.7` (AUDITORIA §1, §4). A auditoria também encontrou falhas no fluxo legado:
- webhook provavelmente rejeitado pelo sufixo `/pix` (R1);
- várias cobranças pagáveis por fatura (R3);
- pagamentos confirmados descartados em silêncio (R4);
- loop de 500 para Pix sem txid (R5);
- fatura cancelada reativada e renovada, ou 500 em loop (R6);
- nenhuma visibilidade de webhook para o Super Admin (R12).

O núcleo financeiro da 8.4 (`confirmGatewayPayment`, `applySubscriptionRenewal`, conciliação) é correto e deve ser
preservado.

## 2. Objetivos

1. Cobrança, consulta, webhook e registro de webhook usam a configuração do Super Admin, quando ativada.
2. **Implementar não significa ativar:** o comportamento atual continua intacto até a ativação explícita de cada
   controle (DECISOES §8.2), após a homologação.
3. Uma fatura tem no máximo uma cobrança Pix ativa.
4. Toda notificação válida da Efí é **gravada de forma durável antes do HTTP 200**. Todo Pix confirmado termina como
   pagamento local, replay idempotente, item de conciliação ou registro classificado. Nunca é descartado.
5. Renovação continua sendo uma por fatura.
6. O Super Admin consulta, filtra e reprocessa notificações e consulta um txid sem SSH.
7. Rollback por flag, sem migration reversa e sem perda de eventos.

## 3. Escopo

- Provedor único de credenciais com seleção de fonte (D-P1).
- Cliente Pix próprio com mTLS e P12 em memória (D-P12).
- Criação/reuso de cobrança Pix com txid local; consulta administrativa por txid.
- Registro/consulta de webhook como ação administrativa.
- **Pipeline assíncrono do webhook** (D-P18): recepção durável no PostgreSQL, fila Redis e worker, recuperação, retentativas, reprocessamento auditado.
- Tratamento explícito de casos de borda: fatura cancelada (D-P6), devolução (D-P7), Pix sem txid (D-P8).
- Conciliação: resolução auditada, fila paginada, varredura manual (D-P10).
- Registro de homologação associado a configuração, ambiente e versão (D-P2, D-P17).
- Controles de ativação independentes (DECISOES §8.2).
- Diagnóstico (`/saas/finance/efi/status`) refletindo fonte, pipeline e homologação.
- Testes unitários/integração e plano de homologação em TESTE.

## 4. Fora de escopo

- Boleto, cartão, assinatura nativa e Pix Automático (flags continuam OFF).
- Credenciais por empresa.
- Estorno automático (D-P7 A aprovada: só conciliação).
- Rotação da chave de cifra (D-P13 A aprovada: só o procedimento documentado; substituição simples proibida).
- Realocação/aplicação automática de pagamento à fatura substituta (SF-2: fase futura; na B3, só conciliação manual).
- Qualquer alteração em `BILLING_AUTOMATION_NORMALIZED_DATES`, no job de bloqueio ou nas regras de inadimplência.
- Remoção do SDK e das variáveis `GERENCIANET_*` (fase posterior, após produção estável).
- Mudança de contrato 401→403.
- Pagamento parcial.

## 5. Requisitos funcionais

### RF0 — Controles de ativação (todas as etapas)
- RF0.1 Cada grupo de mudança financeira tem um controle próprio, com default igual ao comportamento atual:
  `EFI_CREDENTIALS_SOURCE`, `EFI_PIX_CHARGE_V2_ENABLED`, `EFI_WEBHOOK_PIPELINE`, `EFI_WEBHOOK_WORKER_PAUSED`,
  `EFI_PIX_RECONCILIATION_SWEEP_ENABLED`, `TRUST_PROXY_HOPS` (DECISOES §8.2).
- RF0.2 O valor efetivo de cada controle aparece no log de boot e em `GET /saas/finance/efi/status`.
- RF0.3 Nenhum controle é ligado por migration, seed ou código. A ativação é uma alteração de ambiente explícita,
  registrada no relatório da etapa.

### RF1 — Credenciais (B3.1)
- RF1.1 `EFI_CREDENTIALS_SOURCE` ∈ {`legacy_env`, `database`}; ausente ou inválido → `legacy_env`, com log no boot (D-P1).
- RF1.2 Com `database`: o slot vem de `STREAMHUB_RUNTIME_ENV`, e o ambiente da API vem do slot (não de `GERENCIANET_SANDBOX`).
- RF1.3 **Configuração válida** (D-P2): `adminEnabled=true`, P12 que abre, OAuth Pix com mTLS ok, chave Pix e webhook secret.
  - TESTE: a configuração válida basta para operar de forma controlada.
  - PRODUÇÃO: exige também **integração homologada** (RF1.7) para o `configFingerprint` atual.
- RF1.4 Configuração inválida → erro tipado (`ERR_EFI_*`), sem fallback para env.
- RF1.5 Token OAuth em cache por `(configId, updatedAt, ambiente)`, invalidado em upsert, upload, delete, ativação, desativação e revogação.
- RF1.6 `GET /saas/finance/efi/status` informa a fonte ativa, a prontidão, o `configFingerprint`, o estado da homologação
  e se a versão atual difere da homologada [PT-9]. Sem segredos.
- RF1.7 **Registro de homologação** (D-P17), uma ação do Super Admin com confirmação explícita e auditoria `homologate`:
  - TESTE: exige os ids de evento de webhook, pagamento gateway e renovação no slot, com `configFingerprint`, ambiente e commit.
  - PRODUÇÃO: exige a referência ao relatório TESTE aprovado do mesmo commit, configuração válida, webhook conferido por
    GET e evento de teste persistido (ou chamada autenticada controlada) [PT-7]. **Não exige pagamento real.**
  - Toda troca de segredo ou P12 invalida o registro.
- RF1.8 O teste de conexão e a ativação validam o P12 (`tls.createSecureContext({ pfx })`) e o OAuth Pix com mTLS.
- RF1.9 Com a fonte `database`, a base Cobranças vem do ambiente do slot.
- RF1.10 Webhook secret gerado no servidor ou com no mínimo 32 caracteres.
- RF1.11 O caminho `database` não usa o SDK e nunca grava o P12 em disco, nem temporariamente.
- RF1.12 Bases de URL, endpoint OAuth e escopos confirmados na documentação oficial antes de fixar [PT-4].

### RF2 — Cobrança Pix (B3.2) — ativação: `EFI_PIX_CHARGE_V2_ENABLED`
- RF2.1 `POST /subscription` mantém o contrato de entrada e saída (QR code + dados da cobrança). Com v2, tira da resposta
  os campos que o frontend não usa.
- RF2.2 Reuso ou criação em três passos, **sem chamada Efí dentro de lock**:
  1. Em transação curta com `FOR UPDATE` da fatura, decide reusar ou criar e reserva a tentativa `creating`. Commit.
  2. Fora do lock: `PUT /v2/cob/:txid` (nova) ou `GET /v2/cob/:txid` (reuso; confere `ATIVA`, valor, chave e
     `configId`). Repetição ou conflito do PUT → GET e comparação [PT-3].
  3. Em transação curta, atualiza a tentativa e revalida a fatura (paga ou cancelada no intervalo → não exibe o QR).
- RF2.3 Tentativa `creating` com commit próprio. Falha externa → `failed`. Tentativa órfã → GET antes de nova criação.
  Nunca existe cobrança sem registro local.
- RF2.3a Índice único parcial em `SaaSPaymentAttempts.externalTxid` (migration aditiva).
- RF2.4 Cada tentativa guarda fonte, `configId`, slot, ambiente e commit.
- RF2.4a Toda cobrança nova mantém `solicitacaoPagador = "#Fatura:<id>"`, para o pipeline legado processá-la após um rollback.
- RF2.5 Com v2, o checkout não registra webhook.
- RF2.6 `GET /saas/finance/efi/charges/:txid` (Super Admin): consulta status, valor, `horario` e e2eId na Efí, sem
  alterar dados financeiros (só `gatewayStatus`).
- RF2.7 `POST /saas/finance/efi/webhook/register` e `GET /saas/finance/efi/webhook` (Super Admin), auditados. O cadastro
  só fica disponível com `EFI_PIX_CHARGE_V2_ENABLED=true`, porque o checkout legado sobrescreve a URL (C3). O **formato
  novo** da URL (token novo) só pode ser cadastrado com `EFI_WEBHOOK_PIPELINE=async`. Com `legacy`, o cadastro usa o
  formato atual (`token`), para não parar as notificações (C4/C7). A URL definitiva depende do PT-2/PT-5.

### RF3 — Webhook assíncrono, confirmação e conciliação (B3.3) — ativação: `EFI_WEBHOOK_PIPELINE=async`

**Recepção (endpoint `POST /subscription/webhook`, mesma rota)**
- RF3.1 Com `async`, a autenticação aceita o token secreto novo (`whToken`, nome provisório) e `token` (transição),
  tolerando o sufixo `/pix`, com comparação em tempo constante contra o secret da fonte ativa. Allowlist de IP opcional,
  que exige `TRUST_PROXY_HOPS`. Com `legacy`, autenticação e processamento ficam como hoje (C4).
- RF3.2 Só um corpo **sem estrutura reconhecível** (JSON inválido, sem `pix` nem `evento`) → 400. Item inválido dentro de
  um lote **não** derruba o lote: é persistido como `invalid_permanent` com a evidência mínima, para que um Pix válido do
  mesmo lote nunca seja descartado.
- RF3.3 Persistência durável: numa única transação, cada item vira uma linha em `SaaSGatewayWebhookEvents` via
  `INSERT … ON CONFLICT (eventKey) DO NOTHING`. As chaves são as de R-23:
  - `pix:<e2eId>` (com ou sem txid; a ausência de txid é classificada no worker);
  - `devolucao:<e2eId>:<idDevolucao>:<status>`;
  - `teste:<hash>`.
- RF3.4 HTTP 200 **somente após o commit**. Falha de persistência → **503**, sem 200 parcial. O 200 significa
  recebimento durável, não pagamento processado.
- RF3.5 Depois do commit, publicar um job por evento novo (`jobId` = id do evento, timeout curto). Falha do Redis ou
  da publicação **não** muda a resposta: o evento fica `received` para recuperação. A recepção não depende do Redis.
- RF3.6 Payload persistido mínimo: `e2eId`, `txid`, valor, horário, chave mascarada, devoluções (id/valor/status),
  fonte de credencial, `receivedAt`. Sem dados do pagador, cabeçalhos ou query.

**Processamento (worker)**
- RF3.7 Claim atômico no banco antes de processar (`received`/`retry_scheduled` → `processing`, com `lockedBy`/`lockedAt`).
  Dois workers nunca processam o mesmo evento.
- RF3.8 Fila: Redis com **Bull 4 (já instalado; PT-1 resolvida)**. BullMQ não é instalado. A fila não guarda estado definitivo:
  o status vive no PostgreSQL, fonte durável dos eventos. Redis indisponível não perde evento persistido (RF3.12, RNF8).
- RF3.9 Localização: fatura pelo txid (`SaaSPaymentAttempts`/`Invoices`); `#Fatura:` como conferência e fallback para
  cobranças anteriores à migração. Credenciais da consulta: as da fonte que criou a cobrança (RF2.4); cobrança legada sem
  registro → conta env (D-P14 garante a mesma conta).
- RF3.10 Resultados (todos terminais, exceto `retry_scheduled`):

| Caso | Status do evento | Ação |
|------|------------------|------|
| `CONCLUIDA` + fatura aberta + valor igual | `applied` | `confirmGatewayPayment` (inalterado) → pagamento + renovação |
| Mesmo txid já aplicado / baixa manual prévia com o txid | `replay` | Nenhuma (conciliação de duplicidade quando a 8.4 já abre) |
| Fatura já paga por outra fonte ou txid | `reconciliation` | Conciliação “possível duplicidade” (atual) |
| Fatura **cancelada** | `reconciliation` | D-P6: recebimento idempotente, fatura segue `cancelled`, sem renovação, conciliação. SF-1: fora da receita consolidada até a conciliação. Com substituta, SF-2: conciliação manual, sem aplicação automática |
| Fatura inexistente / valor divergente / txid sem vínculo | `reconciliation` | Item com txid/e2eId/valor |
| Pix sem txid, origem indeterminada | `unlinked` | Evidência preservada; filtro “sem vínculo”; conversão manual auditada (D-P8) |
| Pix comprovadamente fora do SaaS | `ignored_not_saas` | Só registro (D-P8) |
| Devolução | `reconciliation` | Conciliação “devolução Pix” (D-P7) |
| `teste` | `ignored_not_saas` (tipo `teste`) | Usado como evidência de homologação (RF1.7) |
| Cobrança `ATIVA` (ainda não paga) | `retry_scheduled` → `applied`, ou `failed_exhausted` | Rechecagem com backoff |
| Erro transitório (rede, timeout, Efí 5xx/429, banco) | `retry_scheduled` | Backoff exponencial |
| Esgotou as retentativas | `failed_exhausted` | Conciliação + destaque na tela |
| Inválido permanente (txid inexistente na conta, chave diferente) | `invalid_permanent` | Evidência; conciliação “não verificável” se houver valor |

- RF3.11 Retentativas controladas: backoff proposto de 1, 5, 15, 60 e 360 min, no máximo 8 tentativas [PT-11].
- RF3.12 Recuperação (`node-cron`, a cada minuto):
  - republica eventos `received`/`retry_scheduled` vencidos e sem job;
  - devolve `processing` com lock antigo (proposta: 10 min) para `retry_scheduled`;
  - reconcilia jobs × eventos (job órfão é removido; evento sem job é republicado).
- RF3.13 `EFI_WEBHOOK_WORKER_PAUSED=true` suspende o worker e a recuperação, sem afetar a recepção.
- RF3.14 Ordem e concorrência: eventos do mesmo txid se serializam pelo claim e pelo lock da fatura em
  `confirmGatewayPayment`. Uma devolução processada antes do pagamento abre conciliação, nunca estorno. O que fazer com
  o Pix que chega **depois** de uma devolução do mesmo e2eId (SF-3, aprovada): registrar evidência, status `reconciliation`,
  sem renovação, sem estorno ou compensação automática.
- RF3.14a O ramo D-P6 (fatura cancelada) em `confirmGatewayPayment` só executa quando chamado pelo pipeline `async`
  (parâmetro explícito). O pipeline legado mantém o comportamento atual (T-ACT-06).
- RF3.15 Sem renovação duplicada: `renew-invoice:<invoiceId>` (existente). Fatura cancelada não renova (D-P6).

**Administração**
- RF3.16 Reprocessamento manual (Super Admin): permitido para `failed_exhausted`, `invalid_permanent`, `unlinked` e
  `reconciliation`. Exige nota, é auditado, volta a `received` e percorre o pipeline idempotente. Não permitido para
  `applied`/`replay`.
- RF3.17 Resolver conciliação: nota obrigatória, lock, só item aberto, ator, evento no ledger, mensagem original
  preservada. Fila global paginada.
- RF3.18 Varredura Pix Efí × local: só leitura na Efí, saída em conciliação. Disparo manual, habilitado por
  `EFI_PIX_RECONCILIATION_SWEEP_ENABLED` (default `false` → 403).
- RF3.19 Tela Super Admin:
  - lista de eventos com filtros por status (pendentes, `retry_scheduled`, `failed_exhausted`, `unlinked`, `invalid_permanent`), txid e empresa;
  - detalhe com tentativas e erro sanitizado;
  - reprocessar;
  - fila global de conciliação;
  - consulta de txid;
  - indicadores: eventos pendentes há mais de X min e jobs × eventos.
- RF3.20 Retenção dos eventos [PT-10].

### RF4 — Homologação (B3.4)
- RF4.1 Rodar todos os cenários de `TESTES.md` e `HOMOLOGACAO.md` em TESTE com conta sandbox.

## 6. Requisitos não funcionais

- RNF1 Timeout em toda chamada Efí: OAuth 15 s, operações 20 s. Recepção do webhook responde em menos de 5 s em
  condição normal (só banco), bem abaixo dos 60 s da Efí.
- RNF2 Nenhuma promise sem resolução: todo erro de transporte vira erro tipado.
- RNF3 Sem nova dependência npm sem aprovação. A fila usa Bull 4, já instalado (PT-1); BullMQ não é instalado.
- RNF4 Migrations só aditivas e idempotentes, com `down` que não apaga dados financeiros.
- RNF5 Opera com uma réplica (realidade atual), e a correção não depende disso: claim atômico e locks no banco.
- RNF6 Logs estruturados com `invoiceId`, `companyId`, id do evento, sufixo de txid e e2eId. Nunca segredo, token,
  P12, dados do pagador ou URL com query. O mesmo vale para Sentry.
- RNF7 Mensagens ao usuário em pt-BR, no padrão `{ error, message }`.
- RNF8 Disponibilidade: a recepção depende só do PostgreSQL. Com o Redis indisponível, os eventos se acumulam e são
  processados na volta.
- RNF9 Observabilidade: contagem de eventos por status, idade do evento pendente mais antigo e divergência jobs × eventos,
  todos visíveis no status e na tela.

## 7. Regras financeiras

1. Um txid gera no máximo um `SaaSPayment` (índice único existente).
2. Uma fatura gera no máximo uma renovação (`renew-invoice:<id>`, existente).
3. Pagamento só com `CONCLUIDA` consultado na Efí e valor exato da fatura.
4. Dinheiro recebido nunca é descartado: vira pagamento, conciliação ou registro classificado.
5. Cortesia, renovação administrativa e pagamento histórico continuam sem receita (8.4).
6. Nenhuma alteração retroativa de `dueDate`, status ou valor de faturas existentes.
7. Fatura cancelada paga: recebimento idempotente, status `cancelled` preservado, sem renovação, conciliação (D-P6).
   Rastreabilidade preservada; fora da receita consolidada até a conciliação (SF-1). Com substituta: conciliação manual,
   sem aplicação automática nem renovação, decisão auditada (SF-2).
7a. Pix de pagamento já devolvido: evidência e conciliação; sem renovação; sem estorno ou compensação automática (SF-3).
8. Devolução: só conciliação (D-P7).
9. Nenhuma mudança em bloqueio ou inadimplência. `BILLING_AUTOMATION_NORMALIZED_DATES` continua ausente.
10. Nenhum controle financeiro é ativado sem aprovação explícita após homologação (DECISOES §8.1).

## 8. Requisitos de segurança

- S1 Segredos só em memória; P12 nunca em disco no caminho `database`.
- S2 Secret do webhook fora de logs e do Sentry (`beforeSend`); query e `Authorization` da rota removidas. Regra
  equivalente no nginx documentada, sem alteração nesta fase.
- S2a `trust proxy` só com `TRUST_PROXY_HOPS` configurado, validado como mudança global.
- S2b `EFI_CREDENTIAL_ENCRYPTION_KEY` distinta entre TESTE e PRODUÇÃO. Substituição simples proibida (D-P13).
- S3 Comparação de secret em tempo constante (`crypto.timingSafeEqual`). O secret é um **token de autenticação**, não HMAC.
- S4 Rotas novas: `isAuth + isSuper`. O webhook continua público e autenticado por token.
- S5 Rate limit na rota de webhook por IP real (S2a), generoso para os retries da Efí.
- S6 Nenhuma credencial em resposta, ledger, auditoria ou evento persistido; só máscaras e fingerprint.
- S7 A fonte `database` nunca lê `GERENCIANET_*`/`EFI_COBRANCAS_*` (mantém F5).
- S8 O slot só pode bater com o runtime (mantém F2).
- S9 Dados pessoais do pagador não são persistidos nos eventos (R-31).
- S10 mTLS no webhook como alternativa a avaliar [PT-6].

## 9. Requisitos de auditoria

- A1 Toda ação admin nova gera `PlatformEfiConfigAudit` ou `SaaSFinancialEvent`, com ator: registrar webhook,
  homologar, reprocessar evento, converter `unlinked`, resolver conciliação, varredura.
- A2 Toda notificação persistida fica rastreável até o pagamento, o replay, o item de conciliação ou a classificação.
- A3 Toda tentativa de cobrança registra fonte, `configId`, slot, ambiente e commit.
- A4 Mudanças de controle de ativação aparecem no boot e no status. A ativação fica registrada no relatório da etapa.
- A5 Cada tentativa de processamento de evento registra horário, worker, resultado e erro sanitizado.

## 10. Critérios de aceite (fase)

1. Com **todos os controles no default**, a suíte de regressão 8.4 passa e checkout/webhook se comportam como hoje
   (snapshot de contrato).
2. Com cada controle ligado isoladamente em TESTE, o comportamento novo funciona, e desligá-lo restaura o anterior.
3. Com `database` + `EFI_PIX_CHARGE_V2_ENABLED` + `async` em TESTE: ciclo cobrança → pagamento sandbox → webhook → baixa → renovação.
   - Uma segunda notificação do mesmo evento não altera nada.
   - O registro `homologate` é aceito.
4. Nenhum 200 do webhook sem a linha persistida (teste com falha de banco).
5. Com o Redis parado, notificações recebem 200 e são processadas depois que o Redis volta. Com o worker reiniciado no
   meio do processamento, o evento é recuperado sem duplicidade.
6. Dois checkouts simultâneos da mesma fatura devolvem a mesma cobrança.
7. Nenhum caso de `TESTES.md` termina com dinheiro sem pagamento local, conciliação ou registro classificado.
8. O Super Admin identifica pela interface os eventos pendentes, falhos e sem vínculo, e consegue reprocessá-los.
9. O rollback (pausa do worker, fonte de credenciais, pipeline) restabelece o comportamento esperado sem migration reversa e sem perda de eventos.
10. Nenhum segredo ou dado do pagador em logs, Sentry, respostas, auditoria ou eventos (verificado por teste).

## 11. Dependências e riscos

- **Dependências:**
  - migrations 8.4/8.4-F e B1/B2 aplicadas;
  - `STREAMHUB_RUNTIME_ENV` e `EFI_CREDENTIAL_ENCRYPTION_KEY` (distintas por ambiente) presentes;
  - conta Efí sandbox com chave Pix e P12;
  - `BACKEND_URL` público com HTTPS em TESTE;
  - Redis existente (`REDIS_URI`);
  - pendências técnicas PT-2…PT-12 resolvidas na etapa indicada em DECISOES §4 (PT-1 e SF-1…SF-3 já decididos).
- **Riscos:**
  - R1 confirmado faz os Pix pagos passarem a renovar sozinhos (D-P11);
  - reenvios represados da Efí;
  - troca de conta Efí (D-P14);
  - mTLS obrigatório (PT-6);
  - domínios antigos do SDK (PT-4);
  - perda da chave de cifra (D-P13);
  - teste atual não valida o Pix (R17);
  - `PUT /v2/cob` repetido (PT-3);
  - acúmulo de eventos se o worker ficar pausado sem monitoramento;
  - divergência de versão homologada (PT-9);
  - recebimentos em conciliação acumulados sem tratamento operacional (SF-1/SF-2);
  - rollback do pipeline exige pausa ou recadastro (C4).
