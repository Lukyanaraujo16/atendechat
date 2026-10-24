# Fase 8.3-B3 — Relatório de homologação (VPS de TESTE, conta Efí real)

**Data:** 2026-10-22 · **Commit homologado:** `8f6babd` (código B3 + Opção B `ed2e097` + liberação TESTE) ·
**Ambiente:** VPS de TESTE `vmi3163669`, `STREAMHUB_RUNTIME_ENV=test`, slot `homologation`, API Efí **production**
(Opção B, DECISOES §14). **Resultado: APROVADO** — fluxo Pix de ponta a ponta com dinheiro real (R$ 1,00).
**Versão implantada e homologada em TESTE para a promoção (P-1):** `07c6b66` (2026-10-22) — ver §3.2.

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

### 3.2 Homologação técnica do pacote de PRODUÇÃO (commit `07c6b66`, 2026-10-22)
Commit `07c6b664b9f148c3f1ee3518aeb084992c122c6f` implantado na VPS de TESTE por fast-forward a partir de `7385f06`
(sem migrations nem dependências novas; build `dirty: false`; frontend `07c6b664b9f1`, sem arquivos ilegíveis ao nginx).
Inclui a liberação `["test","production"]`, B34-T11 (webhook legado) e B34-T12 (bootstrap da homologação).
| Verificação | Resultado |
|-------------|-----------|
| Testes backend (SaasBilling + config, na VPS) | 429/429 |
| Testes frontend (modal Pix + painel de cobrança, na VPS) | 10/10 |
| Integração isolada (Postgres e Redis descartáveis, Efí simulada) | 210/210 |
| Integração Efí após o deploy | runtime `test`, fonte `database`, v2 e pipeline ativos, varredura desligada, worker e Redis ok, slot utilizável |
| Webhook da chave `****04fd` | permaneceu apontando para TESTE (`pointsToThisBackend: true`) |
| Estado financeiro antes × depois | idêntico (3 faturas pagas, 3 pagamentos, 3 renovações, 2 tentativas, 3 eventos, 0 conciliação); nenhuma cobrança criada |
| Liberação `production` com controles no default | fonte `legacy_env`, v2/pipeline/varredura inativos; boleto, cartão e settle desligados |
**Resultado: APROVADO, sem regressões.**

## 4. Pendências para PRODUÇÃO
Release de PRODUÇÃO, proteção do webhook legado (B34-T11), desbloqueio do bootstrap da homologação (B34-T12),
retenção (R-5) e texto D-P11: preparados localmente (DECISOES §15). Restam decisões/conferências do responsável:
chave Pix de PRODUÇÃO e `GERENCIANET_PIX_KEY` (P-2/P-3), prazo legal de retenção e envio do aviso.

## 5. Checklist de implantação em PRODUÇÃO
Ver `IMPLANTACAO-PRODUCAO.md`.

## 6. Estado em que TESTE fica
Integração ativa com a conta Efí **real**: qualquer "Pagar" no `/financeiro` da VPS de TESTE gera Pix real. Para
desligar: remover `EFI_PIX_CHARGE_V2_ENABLED` (checkout volta ao legado) ou seguir IMPLANTACAO-TESTE §10.4.
