import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as SaasFinanceController from "../controllers/SaasFinanceController";

const saasFinanceRoutes = express.Router();

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
