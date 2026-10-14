# Matriz de contratos Efí Pay — StreamHUB Chat

**Consulta:** 2026-10-13 · **Marco 0** · Sem chamadas autenticadas

## Fontes oficiais

| Tema | URL |
|------|-----|
| Hub | https://dev.efipay.com.br/ |
| Pix credenciais | https://dev.efipay.com.br/docs/api-pix/credenciais |
| Pix Cob imediatas | https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas |
| Pix webhooks | https://dev.efipay.com.br/docs/api-pix/webhooks |
| Pix gestão/devolução | https://dev.efipay.com.br/docs/api-pix/gestao-de-pix/ |
| Cobranças credenciais | https://dev.efipay.com.br/docs/api-cobrancas/credenciais/ |
| Cobranças status | https://dev.efipay.com.br/docs/api-cobrancas/status/ |
| Cobranças assinatura | https://dev.efipay.com.br/docs/api-cobrancas/assinatura |
| Cobranças cartão | https://dev.efipay.com.br/docs/api-cobrancas/cartao |
| OpenAPI Cobranças (referência comunitária espelhando contrato) | paths `/v1/charge/{id}/settle`, `/v1/charge/{id}/cancel` |

## Autenticação

| API | OAuth | Certificado | Bases |
|-----|-------|-------------|-------|
| Pix | `POST /oauth/token` client_credentials | mTLS P12 obrigatório | `pix.api.efipay.com.br` / `pix-h.api.efipay.com.br` |
| Cobranças | `POST /v1/authorize` | Sem mTLS | `cobrancas.api.efipay.com.br` / `cobrancas-h.api.efipay.com.br` |

## Matriz por modalidade

| Operação | Pix (API Pix) | Boleto (API Cobranças) | Cartão (API Cobranças) |
|----------|---------------|------------------------|------------------------|
| Emitir | **Suportado** Cob imediata `/v2/cob` | **Suportado** charge + banking_billet | **Suportado** charge + credit_card (payment_token) |
| Consultar | **Suportado** `GET /v2/cob/:txid` | **Suportado** detail charge | **Suportado** detail charge |
| Notificar | **Suportado** webhook + mTLS | **Suportado** notification_url / callbacks | Idem |
| **Marcar pago manualmente** | **Não suportado** — não inventar; Pix só confirma com pagamento real | **Suportado** `PUT /v1/charge/{id}/settle` → status `settled` | **Suportado** mesmo settle (cobrança Cobranças) |
| Cancelar | Remover Cob (`REMOVIDA_...`) | `PUT /v1/charge/{id}/cancel` | Idem |
| Estornar | Devolução Pix `PUT /v2/pix/:e2eId/devolucao/:id` | Status `refunded` (fluxo Cobranças) | Idem |
| Recorrência nativa | Pix Automático (escopos `rec.*`/`cobr.*`) — **requer habilitação** | Planos `/v1/plan` + subscription | Idem + trial_days |

## Estratégia de divergência (baixa manual)

1. **Pix:** baixa local `paid_offline` / `manual_writeoff`; status externo permanece o real (`ATIVA`/`CONCLUIDA`/…); fila de conciliação; opcional cancelar Cob se ainda ativa e operação for correta (não simular CONCLUIDA).
2. **Boleto/Cartão:** após baixa local confirmada, tentar `PUT /v1/charge/{id}/settle` se `chargeId` existir e flag `EFI_COBRANCAS_SETTLE_ENABLED=true`; registrar sync status (`synced` \| `pending` \| `failed` \| `unsupported`).
3. Falha de sync **nunca** aparece como sucesso de sincronização; receita local permanece auditada.

## Feature flags (defaults seguros)

| Flag | Default | Significado |
|------|---------|-------------|
| `SAAS_BILLING_AUTO_INVOICE` | `false` | Geração automática de faturas |
| `SAAS_BILLING_AUTO_RENEW_ON_PAYMENT` | `true` | Renovar dueDate após pagamento confirmado (idempotente) |
| `EFI_PIX_ENABLED` | `true` se credenciais presentes | Checkout Pix |
| `EFI_BOLETO_ENABLED` | `false` | Emissão boleto Cobranças |
| `EFI_CARD_ENABLED` | `false` | Emissão cartão Cobranças |
| `EFI_COBRANCAS_SETTLE_ENABLED` | `false` | Tentativa de settle na baixa manual |
| `EFI_NATIVE_SUBSCRIPTION_ENABLED` | `false` | Planos/assinaturas nativas Efí |
| `WEBHOOK_SUBSCRIPTION_SECRET` | **obrigatório** em produção | Auth webhook Pix |

## StreamHUB como dono do ciclo

Recorrência contratual (MENSAL/TRIMESTRAL/SEMESTRAL/ANUAL) é calculada localmente em meses-calendário. Recorrência nativa Efí só se flag + conta habilitada.
