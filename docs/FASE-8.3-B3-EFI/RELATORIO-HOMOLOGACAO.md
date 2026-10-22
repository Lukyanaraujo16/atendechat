# Fase 8.3-B3 — Relatório de homologação (VPS de TESTE, conta Efí real)

**Data:** 2026-10-22 · **Commit homologado:** `8f6babd` (código B3 + Opção B `ed2e097` + liberação TESTE) ·
**Ambiente:** VPS de TESTE `vmi3163669`, `STREAMHUB_RUNTIME_ENV=test`, slot `homologation`, API Efí **production**
(Opção B, DECISOES §14). **Resultado: APROVADO** — fluxo Pix de ponta a ponta com dinheiro real (R$ 1,00).

## 1. Configuração ativa em TESTE
| Item | Valor |
|------|-------|
| Variáveis B3 | `EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API=true`, `EFI_CREDENTIALS_SOURCE=database`, `EFI_PIX_CHARGE_V2_ENABLED=true`, `EFI_WEBHOOK_PIPELINE=async`; varredura desligada |
| Liberação de código | `EFI_RELEASED_RUNTIMES` = `["test"]` nas quatro listas; `production` em nenhuma |
| Slot | `homologation` / `production`, válido, `usable`, validação Pix registrada; chave aleatória `****04fd` confirmada na conta (`GET /v2/gn/evp`) |
| Webhook da chave | `https://api.teste.streamhubchat.com.br/subscription/webhook?whToken=***&ignorar=` (auditoria 19, `conferred: true`). Substituiu, com autorização do responsável, `https://back.desktopchat.com.br/payment/webhook` (criado em 2025-07-20, sistema desativado) — registro em `/root/backups/efi-webhook-anterior.txt` |
| Backups | `.env` antes de cada fase (`/root/backups/backend-env-pre-*`); banco `atendechat-teste-20261022-110322-pre-deploy2.dump` |

## 2. Evidências por etapa
| Etapa | Evidência | Resultado |
|-------|-----------|-----------|
| H3 OAuth | Cobranças e Pix (mTLS) ok contra `cobrancas.api` / `pix.api` | aprovado |
| Cadastro do webhook | notificação de teste da Efí: evento 1 `teste` / `ignored_not_saas`, `authVia: whToken`, IP `34.193.116.226`; mTLS do receptor não exigido (`x-skip-mtls-checking` aceito) | aprovado |
| H5 Cobrança | fatura 2 (StreamHUB, R$ 1,00, criada por `createManualInvoice`, evento `invoice_created_manual`); tentativa 1 `source: database`, `configId: 1`, `efiEnvironment: production`, txid `…2824fd`; na Efí `ATIVA`, `1.00`, chave correta, `#Fatura:2` | aprovado |
| H6 Pagamento | pago pelo responsável às 14:22:25; Efí `CONCLUIDA`, 1 Pix | aprovado |
| H7 Webhook | `POST …&ignorar=/pix` 200 às 14:22:26; evento 2 `pix`, `authVia: whToken`, e2e `…c0e90a` | aprovado |
| Processamento | worker Bull: `applied` / `paid_and_renewed` em 250 ms, 1 tentativa | aprovado |
| H8 Baixa | fatura 2 `paid`, `paymentSource: gateway`, `gatewaySyncStatus: synced`; `SaaSPayments` id 2 (R$ 1,00, `gateway`) | aprovado |
| H9 Renovação | `SaaSSubscriptionRenewals` id 2, `payment_confirmed`, 2026-11-14 → 2026-12-14 (MENSAL, +1), `idempotencyKey: renew-invoice:2` | aprovado |
| H10 Idempotência | reenvio oficial da mesma notificação (`POST /v2/gn/webhook/reenviar`, 202) recebido às 14:24:28 (200): nenhum evento, pagamento, renovação ou lançamento novo; consultas de duplicidade vazias | aprovado |
| H11 Conciliação | nenhum item de conciliação gerado (esperado: pagamento casado com a fatura) | aprovado |
| H-23 Homologação | auditoria 20 `homologate` (evento 2, pagamento 2, renovação 2; fingerprint `6cc928f4…`, ambiente `production`, commit `8f6babd`) | registrado |
| Integridade | única empresa da VPS (StreamHUB, id 1); fatura 1 inalterada; eventos financeiros da fatura 2: criação, pagamento gateway, renovação (1 de cada) | aprovado |

Não executados: varredura (desligada; H11 coberto sem itens pendentes), ensaios de falha H-28…H-32 e rollbacks H-33/H-34
(fora do escopo desta finalização; cobertos por testes automatizados da B3.3). H-20/H-36 não aplicáveis (DECISOES §14).

## 3. Achados
- **Chave Pix de outra conta:** a primeira chave cadastrada (`****3eec`) não pertencia à conta das credenciais
  (`400 chave_invalida` no cadastro do webhook). O OAuth não valida a chave. Corrigido pelo responsável (`****04fd`).
- **`webhook-check` (B34-T10d):** tratava só HTTP 404 como "sem webhook"; a Efí responde `400 webhook_nao_encontrado`.
  **Corrigido** (`efiPixChargeGateway.ts`, `databaseGateway.getWebhook`): só esse `400` vira "nenhum webhook"; outros
  `400` continuam erro (`efiPixChargeV2.spec`).
- **Modal Pix não confirmava o pagamento:** o backend emite `company-{id}-payment` com `action: "paid"`
  (`confirmGatewayPayment`), mas o modal (`CheckoutSuccess.js`) e o estado da assinatura (`useAuth`) só aceitavam
  `"CONCLUIDA"`. **Corrigido:** aceitam `paid` (e `CONCLUIDA`); o modal usa a fatura persistida (`GET /invoices/:id`,
  filtrada pela empresa) como fonte da verdade, com consulta a cada evento e polling de 10 s enquanto aguarda (para ao
  pagar, fechar ou desmontar; falha de rede só mostra "tentando novamente"); exibe "Pagamento confirmado!" e a nova
  data da assinatura, sem redirecionar. Fechar o modal recarrega a lista do Financeiro. Testes: `CheckoutSuccess.test.js` (6).

### Homologação visual do modal (commit `7385f06`, 2026-10-22)
Fatura 3 (StreamHUB, R$ 1,00, competência 2026-12): cobrança `…bfbde9` gerada às 15:00:12, paga, webhook recebido
às 15:00:28 e processado em ~0,5 s; fatura `paid`, um pagamento, uma renovação (2026-12-14 → 2027-01-14), nenhum
item de conciliação. O responsável confirmou a confirmação automática no modal e a fatura como paga. **Aprovado.**

## 4. Pendências impeditivas para PRODUÇÃO
1. Release "liberação PRODUÇÃO": acrescentar `"production"` às quatro listas (passa por TESTE antes; HOMOLOGACAO §9).
2. **Chave Pix e webhook por ambiente:** a chave `04fd` está com o webhook apontado para TESTE. PRODUÇÃO precisa de
   uma chave própria (ou mover este webhook, desligando TESTE). Uma chave nunca serve aos dois ambientes.
3. R-5 / PT-10: decisão de retenção de `SaaSGatewayWebhookEvents`.
4. D-P11: comunicação aos clientes antes de ativar (Pix pago passa a renovar automaticamente).
5. ~~Correções do §3 (modal Pix e `webhook-check`)~~ — implantadas em TESTE (`7385f06`) e homologadas.

## 5. Checklist de implantação em PRODUÇÃO (com autorização explícita, um controle por vez)
1. Backup do banco e do `.env`; `preflight-teste.sql` sem txid repetido.
2. Deploy do commit com a liberação PRODUÇÃO; migrations `20261020120000` e `20261021120000` (aditivas).
3. `.env`: `STREAMHUB_RUNTIME_ENV=production`; `EFI_CREDENTIAL_ENCRYPTION_KEY` **nova e exclusiva**; **sem**
   `EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API`; controles B3 ausentes. Boot com tudo no default.
4. Painel: slot `production` — Client ID/Secret, chave Pix **exclusiva de PRODUÇÃO**, webhook secret (≥ 32), P12;
   testar OAuth (Cobranças + Pix); ativar; `webhook-check` sem conflito.
5. `EFI_CREDENTIALS_SOURCE=database` → `EFI_PIX_CHARGE_V2_ENABLED=true` → `EFI_WEBHOOK_PIPELINE=async`, restart e
   conferência no card a cada passo.
6. Cadastrar o webhook pelo painel; conferir a notificação de teste (`teste` / `ignored_not_saas`).
7. Registrar `homologate` no slot `production` (evidência: evento de teste + referência a este relatório; D-P17).
8. Primeira cobrança real acompanhada; consultas de duplicidade (IMPLANTACAO-TESTE §8).
9. Rollback: `EFI_WEBHOOK_WORKER_PAUSED=true` (preferencial) ou IMPLANTACAO-TESTE §7.2.

## 6. Estado em que TESTE fica
Integração ativa com a conta Efí **real**: qualquer "Pagar" no `/financeiro` da VPS de TESTE gera Pix real. Para
desligar: remover `EFI_PIX_CHARGE_V2_ENABLED` (checkout volta ao legado) ou seguir IMPLANTACAO-TESTE §10.4.
