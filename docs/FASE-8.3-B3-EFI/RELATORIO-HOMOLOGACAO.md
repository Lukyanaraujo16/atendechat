# Fase 8.3-B3 — Relatório de homologação (VPS de TESTE, conta Efí real)

**Data:** 2026-10-22 · **Commit homologado:** `8f6babd` (código B3 + Opção B `ed2e097` + liberação TESTE) ·
**Ambiente:** VPS de TESTE `vmi3163669`, `STREAMHUB_RUNTIME_ENV=test`, slot `homologation`, API Efí **production**
(Opção B, DECISOES §14). **Resultado: APROVADO** — fluxo Pix de ponta a ponta com dinheiro real (R$ 1,00).
**Versão implantada e homologada em TESTE para a promoção (P-1):** `07c6b66` (2026-10-22) — ver §3.2.
**Versão autorizada para PRODUÇÃO desde 2026-10-24:** `e9e0638` (B3-FIX01) — ver §3.3 (B2 interrompido com `07c6b66`)
e §3.4 (homologação da correção).

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

### 3.3 Tentativa de ativação em PRODUÇÃO com `07c6b66` — B2 interrompido (2026-10-24)
Etapa A (código, B3 desligada) e B1 (slot `production` cadastrado, OAuth Cobranças e Pix aprovado, `Ativar (admin)`)
concluídas em PRODUÇÃO. No B2, depois de desligar v2/pipeline em TESTE e ativar os três controles em PRODUÇÃO, o
cadastro do webhook foi recusado com `ERR_EFI_INTEGRATION_NOT_HOMOLOGATED`, **antes de qualquer chamada à Efí** (nenhuma
auditoria nova; webhook da `04fd` continuou em TESTE; estado financeiro idêntico; nenhuma cobrança).
- **Causa (confirmada):** `getExpectedWebhookSecret()` (`webhookReception.ts`) resolvia o secret pela finalidade
  `financial`, que no slot `production` exige o `homologate`. O mesmo secret é usado no cadastro do webhook
  (`efiPixAdminService.ts`), na recepção do webhook (`webhookReception.ts`: o `teste` receberia 503) e na conferência do
  `homologate` (`efiHomologationService.ts`), que são pré-requisitos da homologação — dependência circular. A consulta do
  painel (`getEfiWebhookForAdmin`, que habilita "Cadastrar webhook") também usava a finalidade `financial`.
- **Por que os testes não pegaram:** o slot `homologation` (TESTE) não exige homologação, e os testes de integração do
  `homologate` de produção rodavam com a fonte `legacy_env` (secret do env) e gateways simulados.
- **Estado deixado:** configuração financeira de PRODUÇÃO restaurada ao estado da Etapa A (`.env` pré-B2; fonte
  `legacy_env`, B3 desligada); slot `production` preservado (cadastrado, validado, `adminEnabled=true`); TESTE com v2 e
  pipeline desligados até a homologação da correção.

### 3.4 Homologação da correção B3-FIX01 (commit `e9e0638`, 2026-10-24)
**Correção:** `getExpectedWebhookSecret()` passa a usar a finalidade `database` — mesmo slot do runtime e mesma regra D-P2
(runtime válido, slot presente e não revogado, `adminEnabled`, validação Pix do fingerprint atual, credenciais completas),
sem exigir a homologação. O secret só autentica: cobrança e processamento continuam na finalidade `financial`, que exige
a homologação. `getEfiWebhookForAdmin` usa o gateway do slot quando a fonte efetiva é `database` (consulta só leitura).

| Arquivo | Mudança |
|---------|---------|
| `backend/src/services/SaasBilling/webhookReception.ts` | secret do webhook pela finalidade `database` |
| `backend/src/services/SaasBilling/efiPixAdminService.ts` | consulta do webhook do painel pelo gateway do slot (fonte `database`) |
| `backend/src/services/SaasBilling/__tests__/efiLegacyContract.spec.ts` | contrato P-B31-08 atualizado (recepção usa `database`; consulta segue só leitura) |
| `backend/src/__integration__/efiProductionBootstrap.it.spec.ts` | 12 testes novos: runtime `production`, fonte `database`, controles reais; consulta → cadastro → `teste` → conferência → `homologate`; cobrança e Pix bloqueados antes da homologação; slot ausente/desativado/revogado, secret errado, runtime inválido. Sem a correção, 7 dos 12 falham |

Commit `e9e06382ef6530087911e453721f2f041a7b7b02` implantado na VPS de TESTE por fast-forward a partir de `07c6b66` (sem
migrations, dependências nem frontend); depois, `EFI_PIX_CHARGE_V2_ENABLED` e `EFI_WEBHOOK_PIPELINE` reativados em TESTE.
| Verificação | Resultado |
|-------------|-----------|
| Testes backend (SaasBilling + config, na VPS) | 429/429 |
| Integração isolada (Postgres e Redis descartáveis, Efí simulada) | 16/16 suítes, **222/222**, nenhum pulado (inclui `gatewayWebhookRedis` e os 12 novos) |
| Build backend | `build-info.json` → `e9e0638…`, `dirty: false`; boot `currentCommit: e9e0638…`, `invalid: []` |
| Controles em TESTE | runtime `test`, fonte `database`, v2 e pipeline ativos, worker registrado, varredura desligada |
| Consulta do webhook (painel) | `registered: true`, `registerAvailable: true`, fonte `database` |
| `webhook-check` | `pointsToThisBackend: true` |
| Notificação real da Efí | cadastro da **mesma** URL de TESTE (hash do `whToken` igual antes e depois; auditoria 21 `webhook_register`, `conferred: true`); `POST` da Efí (`34.193.116.226`) com **HTTP 200**; evento 5 `teste` / **`ignored_not_saas`**, fonte `database`, `authVia: whToken` |
| Fila e erros | fila vazia, nenhum evento pendente, nenhum 401/503, nenhum erro de autorização |
| Estado financeiro antes × depois | **idêntico** (3 faturas, 3 pagamentos, 3 renovações, 2 tentativas, 9 eventos financeiros, 0 conciliação); nenhuma cobrança criada |
Não executados: "Testar OAuth" (grava no slot; o OAuth Pix com mTLS foi exercido pelas chamadas reais) e Pix real
(o worker e a cobrança não mudaram; cobertos pela integração e pela homologação de `8f6babd`).
**Resultado: APROVADO.** `e9e0638` substitui `07c6b66` como versão autorizada para PRODUÇÃO.

## 4. Pendências para PRODUÇÃO
Release de PRODUÇÃO, proteção do webhook legado (B34-T11), desbloqueio do bootstrap da homologação (B34-T12 + B3-FIX01),
retenção (R-5) e texto D-P11: preparados (DECISOES §15). P-2/P-3 decididos em 2026-10-24 (chave `04fd`;
`GERENCIANET_PIX_KEY` de PRODUÇÃO ≠ `04fd`). Slot `production` já cadastrado, validado e administrativamente ativo; B3
desligada em PRODUÇÃO. Restam: implantar `e9e0638` em PRODUÇÃO (código), desligar v2/pipeline em TESTE, ativar e
transferir o webhook com `homologate` usando `testReportCommit` = `e9e0638` (IMPLANTACAO-PRODUCAO §3–§6); prazo legal
de retenção e envio do aviso.

## 5. Checklist de implantação em PRODUÇÃO
Ver `IMPLANTACAO-PRODUCAO.md`.

## 6. Estado em que TESTE fica
Atualizado em 2026-10-24 (após §3.4): commit `e9e0638`, **Pix V2 e pipeline ativos** com a conta Efí **real**, webhook
da `04fd` apontando para TESTE. Qualquer "Pagar" no `/financeiro` da VPS de TESTE gera Pix real. **Antes da
transferência do webhook para PRODUÇÃO**, remover `EFI_PIX_CHARGE_V2_ENABLED` e `EFI_WEBHOOK_PIPELINE` (+ restart),
conforme IMPLANTACAO-PRODUCAO §5.1; para desligar a qualquer momento, o mesmo ou IMPLANTACAO-TESTE §10.4.
