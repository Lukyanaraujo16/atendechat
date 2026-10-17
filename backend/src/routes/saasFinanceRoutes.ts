import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as SaasFinanceController from "../controllers/SaasFinanceController";
import * as EfiIntegrationController from "../controllers/EfiIntegrationController";
import * as EfiConfigAdminController from "../controllers/EfiConfigAdminController";

const saasFinanceRoutes = express.Router();

/** Integração Efí Pay — diagnóstico legado env (somente Super Admin; mantido até B3) */
saasFinanceRoutes.get(
  "/saas/finance/efi/status",
  isAuth,
  isSuper,
  EfiIntegrationController.status
);
saasFinanceRoutes.post(
  "/saas/finance/efi/test-auth",
  isAuth,
  isSuper,
  EfiIntegrationController.testAuth
);

/**
 * Fase 8.3-B2 — gestão administrativa de credenciais (banco).
 * Não altera checkout/webhook legado.
 */
saasFinanceRoutes.get(
  "/saas/finance/efi/config",
  isAuth,
  isSuper,
  EfiConfigAdminController.getConfig
);
saasFinanceRoutes.get(
  "/saas/finance/efi/config/audits",
  isAuth,
  isSuper,
  EfiConfigAdminController.listAudits
);
saasFinanceRoutes.put(
  "/saas/finance/efi/config/:slot",
  isAuth,
  isSuper,
  EfiConfigAdminController.upsertConfig
);
saasFinanceRoutes.post(
  "/saas/finance/efi/config/:slot/certificate",
  isAuth,
  isSuper,
  EfiConfigAdminController.efiCertUpload.single("certificate"),
  EfiConfigAdminController.uploadCertificate
);
saasFinanceRoutes.delete(
  "/saas/finance/efi/config/:slot/certificate",
  isAuth,
  isSuper,
  EfiConfigAdminController.removeCertificate
);
saasFinanceRoutes.post(
  "/saas/finance/efi/config/:slot/test-auth",
  isAuth,
  isSuper,
  EfiConfigAdminController.testAuth
);
saasFinanceRoutes.post(
  "/saas/finance/efi/config/:slot/activate",
  isAuth,
  isSuper,
  EfiConfigAdminController.activate
);
saasFinanceRoutes.post(
  "/saas/finance/efi/config/:slot/deactivate",
  isAuth,
  isSuper,
  EfiConfigAdminController.deactivate
);
saasFinanceRoutes.post(
  "/saas/finance/efi/config/:slot/revoke",
  isAuth,
  isSuper,
  EfiConfigAdminController.revoke
);

/** Central financeira Super Admin */
saasFinanceRoutes.get(
  "/saas/finance/kpis",
  isAuth,
  isSuper,
  SaasFinanceController.platformKpis
);
saasFinanceRoutes.get(
  "/saas/finance/invoices",
  isAuth,
  isSuper,
  SaasFinanceController.platformInvoices
);
saasFinanceRoutes.get(
  "/saas/finance/payments",
  isAuth,
  isSuper,
  SaasFinanceController.platformPayments
);
saasFinanceRoutes.get(
  "/saas/finance/export",
  isAuth,
  isSuper,
  SaasFinanceController.platformExportCsv
);
saasFinanceRoutes.get(
  "/saas/finance/reconciliation",
  isAuth,
  isSuper,
  SaasFinanceController.listReconciliationQueue
);
saasFinanceRoutes.post(
  "/saas/finance/reconciliation/:id/resolve",
  isAuth,
  isSuper,
  SaasFinanceController.resolveReconciliationItem
);

/** Financeiro por empresa (Super Admin) */
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/summary",
  isAuth,
  isSuper,
  SaasFinanceController.companySummary
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/invoices",
  isAuth,
  isSuper,
  SaasFinanceController.companyInvoices
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/payments",
  isAuth,
  isSuper,
  SaasFinanceController.companyPayments
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/renewals",
  isAuth,
  isSuper,
  SaasFinanceController.companyRenewals
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/events",
  isAuth,
  isSuper,
  SaasFinanceController.companyEvents
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/reconciliation",
  isAuth,
  isSuper,
  SaasFinanceController.companyReconciliation
);
saasFinanceRoutes.post(
  "/saas/companies/:companyId/finance/invoices",
  isAuth,
  isSuper,
  SaasFinanceController.createInvoice
);
saasFinanceRoutes.put(
  "/saas/companies/:companyId/finance/invoices/:invoiceId",
  isAuth,
  isSuper,
  SaasFinanceController.updateInvoice
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/renewal-preview",
  isAuth,
  isSuper,
  SaasFinanceController.renewalPreview
);
saasFinanceRoutes.get(
  "/saas/companies/:companyId/finance/invoices/:invoiceId",
  isAuth,
  isSuper,
  SaasFinanceController.invoiceDetail
);
saasFinanceRoutes.post(
  "/saas/companies/:companyId/finance/manual-payment",
  isAuth,
  isSuper,
  SaasFinanceController.manualPayment
);
saasFinanceRoutes.post(
  "/saas/companies/:companyId/finance/invoices/:invoiceId/cancel",
  isAuth,
  isSuper,
  SaasFinanceController.cancelInvoice
);
saasFinanceRoutes.post(
  "/saas/companies/:companyId/finance/adjust-due-date",
  isAuth,
  isSuper,
  SaasFinanceController.adjustDueDate
);
saasFinanceRoutes.post(
  "/saas/companies/:companyId/finance/boleto",
  isAuth,
  isSuper,
  SaasFinanceController.createBoletoCharge
);

/** Tenant — resumo da própria assinatura */
saasFinanceRoutes.get(
  "/finance/summary",
  isAuth,
  requireAnyPlanFeature("finance.invoices", "finance.subscription"),
  SaasFinanceController.tenantFinanceSummary
);

export default saasFinanceRoutes;
