import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as SaasHistoricalReviewController from "../controllers/SaasHistoricalReviewController";

/** Fase 8.4-F (C5) — regularização histórica de faturas (Super Admin). Registrado pelo líder em routes/index.ts. */
const saasHistoricalReviewRoutes = express.Router();

saasHistoricalReviewRoutes.get(
  "/saas/finance/historical-review",
  isAuth,
  isSuper,
  SaasHistoricalReviewController.list
);
saasHistoricalReviewRoutes.get(
  "/saas/finance/historical-review/summary",
  isAuth,
  isSuper,
  SaasHistoricalReviewController.summary
);
saasHistoricalReviewRoutes.post(
  "/saas/companies/:companyId/finance/invoices/:invoiceId/historical-review/preview",
  isAuth,
  isSuper,
  SaasHistoricalReviewController.preview
);
saasHistoricalReviewRoutes.post(
  "/saas/companies/:companyId/finance/invoices/:invoiceId/historical-review",
  isAuth,
  isSuper,
  SaasHistoricalReviewController.apply
);

export default saasHistoricalReviewRoutes;
