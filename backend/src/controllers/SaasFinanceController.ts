import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import {
  getCompanyFinanceSummary,
  listCompanyInvoices,
  listCompanyPayments,
  listCompanyRenewals,
  listCompanyFinancialEvents,
  listCompanyReconciliation,
  getInvoiceDetailForCompany
} from "../services/SaasBilling/ListCompanyFinanceService";
import {
  getPlatformFinanceKpis,
  listPlatformInvoices,
  listPlatformPayments
} from "../services/SaasBilling/PlatformFinanceDashboardService";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import { cancelSaasInvoice } from "../services/SaasBilling/cancelSaasInvoice";
import { applySubscriptionRenewal } from "../services/SaasBilling/applySubscriptionRenewal";
import { createEfiBoletoCharge } from "../services/SaasBilling/efiCobrancasClient";
import Invoices from "../models/Invoices";
import Company from "../models/Company";
import SaaSPayment from "../models/SaaSPayment";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import SaaSReconciliationItem from "../models/SaaSReconciliationItem";
import { saasBillingFlags } from "../config/saasBillingFlags";
import { Op } from "sequelize";
import moment from "moment";

export const platformKpis = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { from, to } = req.query as { from?: string; to?: string };
  const data = await getPlatformFinanceKpis({ from, to });
  return res.json(data);
};

export const platformInvoices = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    searchParam,
    status,
    companyId,
    planId,
    pageNumber,
    competence
  } = req.query as Record<string, string>;

  const data = await listPlatformInvoices({
    searchParam,
    status,
    companyId: companyId ? Number(companyId) : undefined,
    planId: planId ? Number(planId) : undefined,
    pageNumber,
    competence
  });
  return res.json(data);
};

export const platformPayments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, pageNumber, onlyRevenue } = req.query as Record<
    string,
    string
  >;
  const data = await listPlatformPayments({
    companyId: companyId ? Number(companyId) : undefined,
    pageNumber,
    onlyRevenue: onlyRevenue !== "false"
  });
  return res.json(data);
};

export const platformExportCsv = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const kind = String(req.query.kind || "invoices");
  if (kind === "payments") {
    const payments = await SaaSPayment.findAll({
      where: { countsAsRevenue: true },
      order: [["paidAt", "DESC"]],
      limit: 5000
    });
    const rows = [
      "id,companyId,invoiceId,amount,method,source,countsAsRevenue,paidAt,gatewaySyncStatus"
    ];
    for (const p of payments) {
      rows.push(
        [
          p.id,
          p.companyId,
          p.invoiceId ?? "",
          p.amount,
          p.method,
          p.source,
          p.countsAsRevenue,
          p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
          p.gatewaySyncStatus ?? ""
        ].join(",")
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="saas-payments.csv"'
    );
    return res.send(rows.join("\n"));
  }

  const invoices = await Invoices.findAll({
    order: [["dueDate", "DESC"]],
    limit: 5000
  });
  const rows = [
    "id,companyId,detail,status,value,dueDate,competence,paymentSource,gatewaySyncStatus"
  ];
  for (const inv of invoices) {
    rows.push(
      [
        inv.id,
        inv.companyId,
        JSON.stringify(inv.detail || ""),
        inv.status,
        inv.value,
        inv.dueDate,
        inv.competence ?? "",
        inv.paymentSource ?? "",
        inv.gatewaySyncStatus ?? ""
      ].join(",")
    );
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="saas-invoices.csv"'
  );
  return res.send(rows.join("\n"));
};

export const companySummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  if (!companyId) throw new AppError("ERR_INVALID_COMPANY", 400);
  const data = await getCompanyFinanceSummary(companyId);
  return res.json(data);
};

export const companyInvoices = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const { status, page, limit } = req.query as Record<string, string>;
  const data = await listCompanyInvoices(companyId, {
    status,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20
  });
  return res.json(data);
};

export const companyPayments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const { page, limit } = req.query as Record<string, string>;
  const data = await listCompanyPayments(companyId, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20
  });
  return res.json(data);
};

export const companyRenewals = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const renewals = await listCompanyRenewals(companyId);
  return res.json({ renewals });
};

export const companyEvents = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const events = await listCompanyFinancialEvents(companyId);
  return res.json({ events });
};

export const companyReconciliation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const items = await listCompanyReconciliation(companyId);
  return res.json({ items });
};

export const invoiceDetail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const invoiceId = Number(req.params.invoiceId);
  const data = await getInvoiceDetailForCompany(companyId, invoiceId);
  return res.json(data);
};

export const manualPayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const schema = Yup.object().shape({
    invoiceId: Yup.number().required(),
    kind: Yup.string().oneOf(["paid_offline", "courtesy"]).required(),
    amount: Yup.number().positive().required(),
    method: Yup.string().required(),
    paidAt: Yup.date().required(),
    reason: Yup.string().trim().min(3).required(),
    renewSubscription: Yup.boolean().optional()
  });

  await schema.validate(req.body);

  const result = await registerManualPayment({
    invoiceId: Number(req.body.invoiceId),
    companyId,
    actorUserId: Number(req.user.id),
    kind: req.body.kind,
    amount: Number(req.body.amount),
    method: String(req.body.method),
    paidAt: new Date(req.body.paidAt),
    reason: String(req.body.reason),
    renewSubscription: req.body.renewSubscription !== false
  });

  return res.status(201).json(result);
};

export const cancelInvoice = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const invoiceId = Number(req.params.invoiceId);
  const schema = Yup.object().shape({
    reason: Yup.string().trim().min(3).required()
  });
  await schema.validate(req.body);

  const invoice = await cancelSaasInvoice({
    invoiceId,
    companyId,
    actorUserId: Number(req.user.id),
    reason: String(req.body.reason)
  });
  return res.json({ invoice });
};

export const adjustDueDate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  const schema = Yup.object().shape({
    dueDate: Yup.string().required(),
    reason: Yup.string().trim().min(3).required()
  });
  await schema.validate(req.body);

  const result = await applySubscriptionRenewal({
    companyId,
    reason: "due_date_adjustment",
    actorUserId: Number(req.user.id),
    explicitDueDate: String(req.body.dueDate),
    idempotencyKey: `adj:${companyId}:${req.body.dueDate}:${Date.now()}`
  });

  return res.json({
    company: result.company,
    renewal: result.renewal,
    reason: req.body.reason
  });
};

/** Tenant: resumo da própria empresa */
export const tenantFinanceSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  if (!companyId) throw new AppError("ERR_NO_COMPANY", 400);
  const data = await getCompanyFinanceSummary(companyId);
  return res.json(data);
};

/** Super: criar cobrança boleto (flag OFF por default) */
export const createBoletoCharge = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!saasBillingFlags.boletoEnabled()) {
    throw new AppError(
      "ERR_BOLETO_DISABLED",
      403,
      "EFI_BOLETO_ENABLED=false — habilite após homologação."
    );
  }

  const companyId = Number(req.params.companyId);
  const invoiceId = Number(req.body.invoiceId);
  const invoice = await Invoices.findOne({
    where: { id: invoiceId, companyId }
  });
  if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

  const company = await Company.findByPk(companyId);
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const expireAt = moment(invoice.dueDate).isValid()
    ? moment(invoice.dueDate).format("YYYY-MM-DD")
    : moment().add(3, "days").format("YYYY-MM-DD");

  const customer = {
    name: company.name,
    email: company.email || undefined,
    phone_number: company.phone || undefined,
    cpf: req.body.cpf,
    cnpj: req.body.cnpj
  };

  if (!customer.cpf && !customer.cnpj) {
    throw new AppError("ERR_DOCUMENT_REQUIRED", 400, "Informe cpf ou cnpj.");
  }

  const { chargeId, raw } = await createEfiBoletoCharge({
    amountCents: Math.round(Number(invoice.value) * 100),
    description: invoice.detail || `Fatura #${invoice.id}`,
    expireAt,
    customer,
    metadata: {
      custom_id: `invoice:${invoice.id}`,
      notification_url: process.env.EFI_COBRANCAS_NOTIFICATION_URL
    }
  });

  await invoice.update({
    externalChargeId: chargeId,
    gatewayProvider: "efi_cobrancas",
    gatewayStatus: "waiting",
    gatewaySyncStatus: "pending"
  });

  await SaaSPaymentAttempt.create({
    companyId,
    invoiceId: invoice.id,
    method: "boleto",
    status: "pending",
    externalChargeId: chargeId,
    gatewayProvider: "efi_cobrancas",
    gatewayStatus: "waiting",
    amount: Number(invoice.value),
    payloadSummary: { chargeId }
  });

  return res.status(201).json({ chargeId, invoice, raw });
};

export const listReconciliationQueue = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const items = await SaaSReconciliationItem.findAll({
    where: { status: { [Op.ne]: "resolved" } },
    order: [["id", "DESC"]],
    limit: 100
  });
  return res.json({ items });
};

export const resolveReconciliationItem = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const id = Number(req.params.id);
  const item = await SaaSReconciliationItem.findByPk(id);
  if (!item) throw new AppError("ERR_NOT_FOUND", 404);
  await item.update({
    status: "resolved",
    resolvedAt: new Date(),
    message: req.body?.note || item.message
  });
  return res.json({ item });
};
