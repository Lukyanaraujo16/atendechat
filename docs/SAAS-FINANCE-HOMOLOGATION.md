# Homologação — Financeiro SaaS + Efí Pay (ambiente TESTE)

## Build frontend (Node)

- Script oficial: `cd frontend && npm run build`
- Já inclui `NODE_OPTIONS=--openssl-legacy-provider` (necessário no Node 17+)
- Compatível com **Node 18 LTS** (recomendado) ou Node 20/24 com a flag OpenSSL
- Não migrar CRA/React só por causa do OpenSSL

## Pré-requisitos

1. Rodar migration: `20261013120000-saas-finance-foundation.ts` **somente em TESTE**
2. Configurar `.env` (ver `backend/.env.example`):
   - `GERENCIANET_SANDBOX=true`
   - `WEBHOOK_SUBSCRIPTION_SECRET=<segredo forte>`
   - `SAAS_BILLING_AUTO_INVOICE=false` até validar geração
   - `EFI_BOLETO_ENABLED=false` / `EFI_CARD_ENABLED=false` / `EFI_COBRANCAS_SETTLE_ENABLED=false` até contas habilitadas
3. Certificado P12 homologação em `backend/certs/` (só necessário para checkout Pix)

## Checklist

- [ ] Super Admin acessa `/saas/finance` e vê KPIs (MRR/ARR/faturado/recebido)
- [ ] Abrir empresa → seção Financeiro (`?focus=&section=finance`)
- [ ] Baixa manual com motivo; cortesia não aumenta “Recebido”
- [ ] Tenant `/financeiro` mostra resumo + lista; botão Pagar abre Pix
- [ ] Webhook sem secret → 401 (com `NODE_ENV=production` ou secret required)
- [ ] `PUT /invoices/:id` com `status=paid` → 403
- [ ] `POST /subscription/create/webhook` sem Super → 401
- [ ] Replay do mesmo txid não dobra `dueDate`
- [ ] Renovação usa meses-calendário (MENSAL/TRIMESTRAL/SEMESTRAL/ANUAL), nunca +30
- [ ] Faturas legadas permanecem; `legacyUnknown=true` sem inventar paidAt

## Limitações por modalidade

| Modalidade | Baixa manual Efí |
|------------|------------------|
| Pix | **Não suportada** — só local + pendência conciliação |
| Boleto/Cartão | `PUT /v1/charge/{id}/settle` se flag + chargeId |

Ver `docs/EFI-PAY-CONTRACTS-MATRIX.md`.

## Deploy

Não promover a produção sem homologação integral neste checklist.
Commit/push/deploy ficam a cargo do responsável (GitHub Desktop + painel Super Admin).
