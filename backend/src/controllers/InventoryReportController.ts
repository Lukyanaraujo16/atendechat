import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetInventoryReportSummaryService from "../services/InventoryService/GetInventoryReportSummaryService";
import GetInventoryReportSellersService from "../services/InventoryService/GetInventoryReportSellersService";
import GetInventoryReportProductsService from "../services/InventoryService/GetInventoryReportProductsService";
import GetInventoryReportCustomersService from "../services/InventoryService/GetInventoryReportCustomersService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function reportFilters(req: Request) {
  return {
    companyId: companyIdOrThrow(req),
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    sellerUserId: req.query.sellerUserId
  };
}

export const getReportSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = await GetInventoryReportSummaryService(reportFilters(req));
  return res.json(data);
};

export const getReportSellers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const rows = await GetInventoryReportSellersService(reportFilters(req));
  return res.json(rows);
};

export const getReportProducts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const rows = await GetInventoryReportProductsService(reportFilters(req));
  return res.json(rows);
};

export const getReportCustomers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const rows = await GetInventoryReportCustomersService(reportFilters(req));
  return res.json(rows);
};
