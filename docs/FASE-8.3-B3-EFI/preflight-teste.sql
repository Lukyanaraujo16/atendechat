-- Fase 8.3-B3 — verificação prévia SOMENTE LEITURA do banco de TESTE, antes do deploy (B3.4).
-- Uso (na VPS de TESTE, pelo responsável): psql "<conexão do banco de TESTE>" -f preflight-teste.sql
-- Não altera nada: tudo roda numa transação READ ONLY encerrada com ROLLBACK.
-- Não seleciona colunas cifradas nem segredos (só máscaras, flags e contagens).
-- Testado localmente em Postgres descartável (TESTES §Registro B3.4-prep).

BEGIN TRANSACTION READ ONLY;

\echo '== 1. Migrations pré-requisito (devem constar todas) =='
SELECT m.name, (s.name IS NOT NULL) AS aplicada
FROM (VALUES
  ('20261013120000-saas-finance-foundation.js'),
  ('20261015120000-platform-efi-configs.js'),
  ('20261015140000-platform-efi-admin-flags.js'),
  ('20261017120000-company-registration-fields.js'),
  ('20261018120000-saas-historical-review.js'),
  ('20261019120000-notifications-nullable-company-scope.js')
) AS m(name)
LEFT JOIN "SequelizeMeta" s ON s.name IN (m.name, replace(m.name, '.js', '.ts'))
ORDER BY m.name;

\echo '== 2. Migrations da B3 (esperado: ainda NÃO aplicadas antes do deploy) =='
SELECT m.name, (s.name IS NOT NULL) AS aplicada
FROM (VALUES
  ('20261020120000-saas-payment-attempts-txid-unique.js'),
  ('20261021120000-saas-gateway-webhook-events.js')
) AS m(name)
LEFT JOIN "SequelizeMeta" s ON s.name IN (m.name, replace(m.name, '.js', '.ts'))
ORDER BY m.name;

\echo '== 3. P-B32-04: txid repetido em SaaSPaymentAttempts (esperado: 0 linhas; senão a migration 20261020120000 PARA) =='
SELECT "externalTxid", COUNT(*) AS total
FROM "SaaSPaymentAttempts"
WHERE "externalTxid" IS NOT NULL
GROUP BY "externalTxid" HAVING COUNT(*) > 1;

\echo '== 4. Tabela nova já existe? (esperado: NULL antes do deploy) =='
SELECT to_regclass('public."SaaSGatewayWebhookEvents"')::text AS tabela_eventos;

\echo '== 5. Slots Efí (sem segredos) =='
SELECT slot, "efiEnvironment", status, "adminEnabled", "pixHomologated",
       "webhookSecretConfigured", ("certificateEncrypted" IS NOT NULL) AS tem_p12,
       "certificateFingerprint", "clientIdMasked", "pixKeyMasked", "activatedAt", "updatedAt"
FROM "PlatformEfiConfigs" ORDER BY slot;

\echo '== 6. Última ativação e homologação por slot (diffSummary já é sanitizado) =='
SELECT DISTINCT ON (slot, action) slot, action, "createdAt", "actorUserId", "diffSummary"
FROM "PlatformEfiConfigAudits"
WHERE action IN ('activate', 'homologate', 'webhook_register')
ORDER BY slot, action, "createdAt" DESC;

\echo '== 7. Cobranças Pix abertas nas últimas 2 h (pagáveis durante o deploy; acompanhar depois) =='
SELECT a.id, a."invoiceId", a."companyId", a.status, a."gatewayStatus",
       right(a."externalTxid", 6) AS txid_sufixo, a."createdAt",
       COALESCE(a."payloadSummary"->>'source', 'legacy_env') AS fonte
FROM "SaaSPaymentAttempts" a
WHERE a.method = 'pix' AND a."createdAt" > now() - interval '2 hours'
ORDER BY a."createdAt" DESC;

\echo '== 8. D-P11: faturas com txid e baixa manual (comunicação antes da ativação do pipeline) =='
SELECT COUNT(*) AS faturas_txid_baixa_manual
FROM "Invoices" i
WHERE i."externalTxid" IS NOT NULL AND i.status = 'paid' AND i."paymentSource" = 'paid_offline';

\echo '== 9. Conciliação aberta por tipo (linha de base antes das ativações) =='
SELECT kind, COUNT(*) AS abertos
FROM "SaaSReconciliationItems" WHERE status <> 'resolved'
GROUP BY kind ORDER BY abertos DESC;

\echo '== 10. Linha de base financeira (comparar depois do deploy: nada pode mudar só pelo deploy) =='
SELECT (SELECT COUNT(*) FROM "SaaSPayments") AS pagamentos,
       (SELECT COUNT(*) FROM "SaaSSubscriptionRenewals") AS renovacoes,
       (SELECT COUNT(*) FROM "Invoices" WHERE status = 'paid') AS faturas_pagas,
       (SELECT COUNT(*) FROM "Invoices" WHERE status = 'cancelled') AS faturas_canceladas,
       (SELECT COUNT(*) FROM "SaaSFinancialEvents") AS eventos_ledger;

ROLLBACK;
