# Fase 8.3-B3 — Plano de homologação (VPS de TESTE)

**Plano não executado.** Executar só na B3.4, com aprovação. Sequência operacional, preflight, configuração Efí,
certificados, webhook, rollback e ações do responsável: `IMPLANTACAO-TESTE.md` (2026-10-21). A VPS de PRODUÇÃO não é usada em nenhuma etapa deste plano.
Revisado em 2026-10-20 para as decisões aprovadas (D-P18 assíncrono, D-P2/D-P17, controles de ativação).

> **Atualização 2026-10-22 — Opção B (DECISOES §14, B34-T10).** Com o sandbox indisponível, a homologação na VPS de
> TESTE usa a conta Efí **real** (`EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API=true`, slot `homologation` em `production`).
> Os cenários abaixo valem com essa troca. Onde se lê "sandbox", entenda "conta real, valores baixos". Sequência
> H1–H12, cuidados com webhook e reversão: `IMPLANTACAO-TESTE.md` §10. **Cada cobrança real exige autorização
> específica (R-12).** H-20 e H-36 seguem não aplicáveis nesta VPS.

## 1. Pré-requisitos

- B3.1, B3.2 e B3.3 aprovadas; suíte local verde (T-REG-01/02, T-ACT-01).
- Pendências das linhas B3.1–B3.3 de `DECISOES.md` §4 resolvidas: PT-2…PT-6, PT-8, PT-9, PT-10.
  PT-1 (Bull 4), SF-1, SF-2 e SF-3 já decididos em 2026-10-20.
  D-P11 é exigida só para a promoção (§9).
- Conta Efí **sandbox** com chave Pix de homologação, aplicação com os escopos Pix confirmados no PT-4 e P12 de homologação.
- VPS de TESTE com `BACKEND_URL` público em HTTPS, alcançável pela Efí.
- Redis de TESTE (`REDIS_URI`) e worker no processo do backend (F15).
- Backup do banco de TESTE feito no dia (e restauração validada anteriormente).
- Acesso Super Admin pessoal em TESTE (sem conta compartilhada).
- Acesso operacional de TESTE para parar e iniciar o Redis e reiniciar o backend (ensaios §4.F).

## 2. Preparação do ambiente

1. Conferir, sem expor valores:
   - `STREAMHUB_RUNTIME_ENV=test`;
   - `EFI_CREDENTIAL_ENCRYPTION_KEY` presente e **diferente** da de produção (comparar fingerprint, não o valor).
2. Conferir que **todos os controles estão no default**: `EFI_CREDENTIALS_SOURCE` ausente, `EFI_PIX_CHARGE_V2_ENABLED=false`,
   `EFI_WEBHOOK_PIPELINE=legacy`, `EFI_WEBHOOK_WORKER_PAUSED=false`, `EFI_PIX_RECONCILIATION_SWEEP_ENABLED=false`,
   `TRUST_PROXY_HOPS` ausente.
3. Conferir que `BILLING_AUTOMATION_NORMALIZED_DATES` está **ausente**.
4. Conferir `SAAS_BILLING_AUTO_INVOICE=false`, `EFI_BOLETO_ENABLED=false`, `EFI_CARD_ENABLED=false`,
   `EFI_COBRANCAS_SETTLE_ENABLED=false`, `EFI_NATIVE_SUBSCRIPTION_ENABLED=false`.
5. Aplicar as migrations novas da B3 **só em TESTE** e registrar a saída.
6. Criar 3 empresas de teste (mensal, trimestral, recorrência inválida) com faturas abertas de valor baixo e distinto.
7. Gerar **antes** das ativações, com o fluxo atual, pelo menos uma cobrança Pix legada aberta. Ela serve para os
   cenários de “cobrança emitida antes da migração”.

## 3. Cuidados com credenciais

- Credenciais e P12 de **sandbox** apenas; nunca os de produção em TESTE.
- Cadastro só pelo painel Integração Efí. Nunca colar segredo em chat, ticket, commit, log ou print.
- Prints só com as máscaras visíveis. Conferir que o fingerprint bate com o arquivo entregue pela Efí.
- Nenhum print ou evidência com a URL do webhook contendo o token.
- Ao fim, se o slot for descartado: revogar pelo painel (auditoria).
- `EFI_CREDENTIAL_ENCRYPTION_KEY` de TESTE ≠ a de PRODUÇÃO. Nunca substituí-la sem o procedimento D-P13.

## 4. Cenários

A ativação em TESTE segue a ordem das fases. Cada fase registra o valor dos controles antes e depois.

### A. Default (nenhum controle ligado)
| ID | Cenário | Esperado |
|----|---------|----------|
| H-01 | Deploy com todos os controles no default; checkout/webhook como antes | Sem regressão (T-ACT-01) |
| H-02 | Status mostra todos os controles no default e a fonte `legacy_env` | DTO correto, sem segredos |

### B. Configuração do slot (sem mudar o fluxo)
| ID | Cenário | Esperado |
|----|---------|----------|
| H-03 | Cadastrar o slot `homologation` (IDs, secret ≥ 32, chave, webhook secret, P12) | Status `configured`; auditoria |
| H-04 | Teste de conexão Cobranças e Pix (mTLS, P12 validado) | Ambos ok |
| H-05 | Ativar (`adminEnabled`) | Configuração válida; homologação ainda inexistente; auditoria `activate` |

### C. `EFI_CREDENTIALS_SOURCE=database`
| ID | Cenário | Esperado |
|----|---------|----------|
| H-06 | Ligar + restart | Status mostra `database`/`homologation`/sandbox; TESTE opera sem homologação (D-P2) |

### D. `EFI_PIX_CHARGE_V2_ENABLED=true`
| ID | Cenário | Esperado |
|----|---------|----------|
| H-07 | Cadastrar o webhook pelo painel (com `legacy`) e conferir via GET | Formato atual (`token`); cadastro do formato novo recusado com `legacy` (T-ACT-08); token mascarado |
| H-08 | Checkout da fatura A | QR exibido; txid local; tentativa com fonte/`configId`/commit |
| H-09 | Checkout repetido da fatura A (2 abas) | Mesma cobrança |
| H-17 | Consulta admin de txid | Dados da Efí; só `gatewayStatus` atualizado |

### E. `EFI_WEBHOOK_PIPELINE=async`
Ao ligar, recadastrar o webhook no **formato novo** (validado no PT-2) e conferir via GET.

| ID | Cenário | Esperado |
|----|---------|----------|
| H-10 | Pagar A no sandbox | Evento `received` → `applied`; pagamento; 1 renovação; tempos registrados (recepção vs. processamento) |
| H-11 | Reenviar o mesmo webhook (`/v2/gn/webhook/reenviar`); tentar reprocessar pelo painel | Nenhuma linha nova; evento segue `applied`; reprocessamento recusado (R-30); nada muda |
| H-12 | Baixa manual da fatura B, depois pagar o Pix de B | `replay`/conciliação de duplicidade; 1 renovação |
| H-13 | Cancelar a fatura C com Pix ativo e pagar | D-P6: recebimento registrado, C segue `cancelled`, sem renovação, conciliação; fora da receita consolidada até a conciliação (SF-1) |
| H-14 | Empresa com recorrência inválida paga | Pagamento + conciliação; sem renovação |
| H-15 | Valor divergente (se o sandbox permitir) ou simulação | `reconciliation`; 200 na recepção |
| H-16 | Token errado (chamada manual com curl, sem payload real) | 401; nada persistido |
| H-21 | Pix enviado direto à chave (sem cobrança) | 200; `unlinked` ou `ignored_not_saas` conforme D-P8; evidência preservada |
| H-22 | Devolução de um Pix pago no sandbox | Conciliação de devolução; fatura e renovação intactas |
| H-24 | Usuário admin de empresa (não-super) nas rotas novas | 401 |
| H-25 | Empresa X não vê conciliação, eventos nem cobrança da empresa Y | Isolamento confirmado |
| H-27 | Pagar a cobrança **legada** criada no §2.7 (ainda aberta, se dentro da expiração) | Processada via `#Fatura:` e conta env (T-ASY-23) |

### F. Ensaios de falha (pipeline `async`)
| ID | Cenário | Esperado |
|----|---------|----------|
| H-28 | **Redis indisponível:** parar o Redis, pagar a fatura D | Recepção 200; evento `received`; nada processado; status mostra pendente |
| H-29 | **Recuperação:** religar o Redis | A recuperação republica; D é processada uma vez; indicador jobs × eventos zerado |
| H-30 | **Reinício do worker:** reiniciar o backend durante o processamento de um evento (fatura E) | Lock antigo recuperado; processado uma vez; 1 renovação |
| H-31 | **Eventos pendentes e conciliação:** conferir na tela e por SQL só leitura que não há evento `received`/`retry_scheduled`/`processing` além do tempo limite, e que cada `reconciliation`/`failed_exhausted`/`unlinked` tem item ou classificação correspondente | Zero divergência |
| H-32 | **Pausa do worker:** `EFI_WEBHOOK_WORKER_PAUSED=true`, pagar F, retomar | Recepção ok; F processada só após retomar |
| H-18 | Varredura manual (`EFI_PIX_RECONCILIATION_SWEEP_ENABLED=true` só em TESTE; antes, conferir 403 com `false`) | Sem itens para os casos já baixados |
| H-19 | Resolver item de conciliação com nota | Ator + ledger + mensagem original |
| H-26 | Com `TRUST_PROXY_HOPS` configurado, rajada de chamadas ao webhook acima do limite | 429; IP real registrado |

### G. Rollback com cobranças abertas
| ID | Cenário | Esperado |
|----|---------|----------|
| H-33 | Com uma cobrança v2 aberta (fatura G): `EFI_PIX_CHARGE_V2_ENABLED=false`, depois pagar G | Processada (`#Fatura:` preservado); checkout volta ao legado |
| H-20 | Com uma cobrança aberta criada pela fonte `database` (fatura H): `EFI_CREDENTIALS_SOURCE` removida + restart, depois pagar H | Processada (mesma conta, D-P14); fonte de origem visível |
| H-34 | Pipeline `async` → pausa (rollback preferencial) e depois `async` → `legacy` com recadastro da URL antiga | Pausa sem perda; `legacy` restaura o comportamento atual; nenhuma linha perdida (T-RB-03…05) |

### H. Homologação (D-P17)
| ID | Cenário | Esperado |
|----|---------|----------|
| H-23 | `homologate` no slot `homologation` sem evidência e com a evidência de H-10 | Recusa / aceite com fingerprint, ambiente e commit |
| H-35 | Trocar o webhook secret e conferir o status | Homologação invalidada; `configFingerprint` novo |
| H-36 | **Ensaio do procedimento de produção** (D-P17 2) no slot `homologation`, a partir dos controles no default, no **plano candidato C7** (não autorizado para execução em produção): v2 com `legacy_env` → `async` + URL nova → `homologate` sem pagamento → `database`, com tratamento do PT-12 (troca de secret) | Cada passo sem perda de notificação; `homologate` aceito sem pagamento; roteiro de produção validado |

## 5. Evidências necessárias (por cenário)

- Data/hora, usuário, cenário, valor dos controles e resultado (aprovado/reprovado).
- Print da tela (com máscaras) e/ou resposta HTTP sem segredos.
- IDs: fatura, txid (sufixo), e2eId (sufixo), evento de webhook, status final do evento, `SaaSPayment.id`, renovação,
  item de conciliação.
- Consulta SQL **somente leitura** do estado antes/depois (faturas, pagamentos, renovações, conciliação, eventos),
  anexada ao relatório.
- Para os ensaios de falha: horário da indisponibilidade e da volta, contagem de eventos pendentes antes e depois.
- Trecho de log sanitizado (sem query, sem token, sem dados do pagador).

## 6. Critérios de aprovação

1. H-01…H-36 aprovados, ou reprovações com causa e decisão por escrito.
2. Nenhum pagamento duplicado e nenhuma renovação duplicada.
3. Todo Pix pago no sandbox termina como pagamento, conciliação ou registro classificado.
4. Nenhum 200 sem evento persistido; nenhum evento perdido nos ensaios de falha (H-28…H-32).
5. Nenhum segredo ou dado do pagador em log, Sentry, print ou resposta.
6. Rollbacks (H-20, H-33, H-34) ensaiados com sucesso, com cobranças abertas.
7. Regressão 8.4 (T-REG-*) verde em TESTE.
8. Registro `homologate` do slot `homologation` aceito (H-23) e commit homologado anotado no relatório.

## 7. Checklist de deploy (TESTE)

- [ ] Backup do banco de TESTE do dia
- [ ] Commit/tag da build registrados
- [ ] Variáveis conferidas (§2.1–2.4), sem expor valores; todos os controles no default
- [ ] Migrations B3 aplicadas em TESTE, saída registrada
- [ ] Backend reiniciado; log de boot mostra o valor de cada controle
- [ ] Worker da fila de webhook registrado e Redis acessível
- [ ] `GET /saas/finance/efi/status` ok
- [ ] Smoke: login, Central de Assinaturas, `/financeiro` do tenant

## 8. Checklist de rollback

Ordem do mais leve ao mais pesado. Registrar cada passo no relatório.
- [ ] **Pipeline (preferencial):** `EFI_WEBHOOK_WORKER_PAUSED=true`. A recepção continua e os eventos ficam pendentes; conferir a contagem.
- [ ] **Pipeline (total):** `EFI_WEBHOOK_PIPELINE=legacy` **somente com o recadastro da URL antiga** na Efí (C4). Eventos já persistidos ficam para retomada posterior.
- [ ] **Cobrança:** `EFI_PIX_CHARGE_V2_ENABLED=false`. As cobranças v2 abertas continuam processáveis (`#Fatura:`).
- [ ] **Credenciais:** remover `EFI_CREDENTIALS_SOURCE` (volta a `legacy_env`) + restart.
- [ ] Migrations aditivas **não** revertidas; tabelas novas sem uso não são apagadas.
- [ ] Conferir as cobranças abertas criadas no período e acompanhar os pagamentos delas por 24 h.
- [ ] Conferir que não restou evento `processing` antigo nem divergência jobs × eventos.

## 9. Condições para promoção a PRODUÇÃO

1. Relatório de homologação B3.4 aprovado por escrito pelo responsável, com o commit homologado.
2. D-P11 executada: levantamento só leitura das faturas com `externalTxid` e baixa manual, e aviso ao financeiro.
3. D-P14 confirmada: mesma conta Efí e mesma chave Pix.
4. Deploy em produção do **mesmo commit** homologado, com **todos os controles no default**. Nenhum efeito financeiro.
5. Slot `production` cadastrado pelo painel **em PRODUÇÃO**, com credenciais de produção, teste Pix (mTLS) ok e ativado
   (configuração válida, D-P2).
6. Registro `homologate` de produção conforme D-P17 (2), **sem pagamento real** (no passo 3 da ordem do item 7):
   - referência ao relatório de TESTE do mesmo commit;
   - configuração válida;
   - webhook conferido via GET;
   - evento `teste` persistido (PT-7).
7. Ativação **um controle por vez**, cada um com aprovação, janela, responsável disponível, monitoramento (eventos
   pendentes, conciliação, logs) e o rollback do §8 pronto. **Plano candidato** (C7), **não autorizado para execução**: depende da validação no H-36 e de aprovação posterior:
   1. `EFI_PIX_CHARGE_V2_ENABLED=true` com `legacy_env` (cadastro na URL atual);
   2. `EFI_WEBHOOK_PIPELINE=async` + cadastro da URL nova;
   3. registro `homologate` do slot `production` (item 6 acima, possível só a partir daqui);
   4. `EFI_CREDENTIALS_SOURCE=database`, com o tratamento do PT-12.
8. Monitoramento reforçado por 7 dias após cada ativação.
9. `BILLING_AUTOMATION_NORMALIZED_DATES` continua ausente.
