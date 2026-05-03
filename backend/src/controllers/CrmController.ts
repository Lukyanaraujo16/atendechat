import { Request, Response } from "express";
import { Op, Transaction } from "sequelize";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import sequelize from "../database";
import CrmPipeline from "../models/CrmPipeline";
import CrmStage from "../models/CrmStage";
import CrmDeal, { CrmDealSource, CrmDealStatus } from "../models/CrmDeal";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import User from "../models/User";
import { normalizeBusinessSegment } from "../config/businessSegment";
import { crmPipelineTemplates } from "../config/crmPipelineTemplates";
import { stageWinLostFromName } from "../services/CrmService/BootstrapCrmForCompanyService";
import {
  dealStatusFromStage,
  assertStageBelongsToPipeline,
  mergeDealWhereWithSearch
} from "../services/CrmService/crmDealUtils";

const STAGE_COLORS = [
  "#5c6bc0",
  "#7e57c2",
  "#26a69a",
  "#42a5f5",
  "#66bb6a",
  "#ef5350"
];

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

const dealInclude = [
  {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number"],
    required: false
  },
  {
    model: User,
    as: "assignedUser",
    attributes: ["id", "name"],
    required: false
  },
  {
    model: Ticket,
    as: "ticket",
    attributes: ["id", "status", "lastMessage", "updatedAt"],
    required: false
  }
];

export const listPipelines = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await CrmPipeline.findAll({
    where: { companyId },
    include: [
      {
        model: CrmStage,
        required: false,
        separate: true,
        order: [["position", "ASC"]]
      }
    ],
    order: [["id", "ASC"]]
  });
  return res.json(rows);
};

export const createPipeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const schema = Yup.object({
    name: Yup.string().min(1).max(255).required(),
    segment: Yup.string().nullable()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const segment = normalizeBusinessSegment(body.segment || undefined);
  const stageNames = crmPipelineTemplates[segment] ?? crmPipelineTemplates.general;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const pipeline = await CrmPipeline.create(
      {
        companyId,
        name: body.name.trim(),
        segment,
        isDefault: false
      },
      { transaction: t }
    );
    await Promise.all(
      stageNames.map((stageName, index) => {
        const { isWon, isLost } = stageWinLostFromName(stageName);
        return CrmStage.create(
          {
            pipelineId: pipeline.id,
            companyId,
            name: stageName,
            position: index,
            color: STAGE_COLORS[index % STAGE_COLORS.length],
            isWon,
            isLost
          },
          { transaction: t }
        );
      })
    );
    return CrmPipeline.findByPk(pipeline.id, {
      transaction: t,
      include: [
        {
          model: CrmStage,
          separate: true,
          order: [["position", "ASC"]]
        }
      ]
    });
  });

  return res.status(201).json(result);
};

export const updatePipeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const schema = Yup.object({ name: Yup.string().min(1).max(255).required() });
  const { name } = await schema.validate(req.body);
  const pipeline = await CrmPipeline.findOne({ where: { id, companyId } });
  if (!pipeline) throw new AppError("ERR_NO_CRM_PIPELINE", 404);
  await pipeline.update({ name: String(name).trim() });
  return res.json(pipeline);
};

async function resolvePipelineIdForCompany(
  companyId: number,
  pipelineIdParam: string | undefined
): Promise<number> {
  if (pipelineIdParam && Number.isFinite(Number(pipelineIdParam))) {
    const pid = Number(pipelineIdParam);
    const exists = await CrmPipeline.findOne({ where: { id: pid, companyId } });
    if (!exists) throw new AppError("ERR_NO_CRM_PIPELINE", 404);
    return pid;
  }
  const def = await CrmPipeline.findOne({
    where: { companyId, isDefault: true }
  });
  if (!def) return -1;
  return def.id;
}

export const listDeals = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const {
    pipelineId: pipelineIdQ,
    search,
    assignedUserId: assignedQ,
    status
  } = req.query as Record<string, string | undefined>;

  const pipelineId = await resolvePipelineIdForCompany(companyId, pipelineIdQ);
  if (pipelineId < 0) return res.json([]);

  const where: Record<string, unknown> = { companyId, pipelineId };

  if (assignedQ !== undefined && assignedQ !== "") {
    if (assignedQ === "unassigned") {
      where.assignedUserId = { [Op.is]: null };
    } else {
      const n = Number(assignedQ);
      if (Number.isFinite(n)) where.assignedUserId = n;
    }
  }

  if (status === "open" || status === "won" || status === "lost") {
    where.status = status as CrmDealStatus;
  }

  const finalWhere =
    search && String(search).trim()
      ? mergeDealWhereWithSearch(where, String(search))
      : where;

  const deals = await CrmDeal.findAll({
    where: finalWhere,
    include: dealInclude,
    order: [["updatedAt", "DESC"]]
  });
  return res.json(deals);
};

export const showDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await CrmDeal.findOne({
    where: { id, companyId },
    include: dealInclude
  });
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);
  return res.json(deal);
};

const sourceSchema = Yup.string()
  .oneOf(["whatsapp", "manual", "instagram", "other"])
  .nullable();

async function assertRelationsForDeal(
  companyId: number,
  pipelineId: number,
  stageId: number,
  contactId: number | null | undefined,
  ticketId: number | null | undefined
): Promise<CrmStage> {
  const pipeline = await CrmPipeline.findOne({ where: { id: pipelineId, companyId } });
  if (!pipeline) throw new AppError("ERR_NO_CRM_PIPELINE", 404);

  const stage = await CrmStage.findOne({ where: { id: stageId, companyId } });
  assertStageBelongsToPipeline(stage, pipelineId, companyId);

  if (contactId != null) {
    const c = await Contact.findOne({ where: { id: contactId, companyId } });
    if (!c) throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (ticketId != null) {
    const tk = await Ticket.findOne({ where: { id: ticketId, companyId } });
    if (!tk) throw new AppError("ERR_NO_TICKET_FOUND", 404);
    if (contactId != null && tk.contactId !== contactId) {
      throw new AppError("ERR_TICKET_CONTACT_MISMATCH", 400);
    }
  }

  return stage as CrmStage;
}

export const storeDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const userId = req.user?.id != null ? Number(req.user.id) : null;

  const schema = Yup.object({
    title: Yup.string().min(1).max(500).required(),
    pipelineId: Yup.number().integer().required(),
    stageId: Yup.number().integer().required(),
    contactId: Yup.number().integer().nullable(),
    ticketId: Yup.number().integer().nullable(),
    value: Yup.number().nullable(),
    assignedUserId: Yup.number().integer().nullable(),
    expectedCloseAt: Yup.date().nullable(),
    notes: Yup.string().nullable().max(65535),
    source: sourceSchema
  });

  const body = await schema.validate(req.body, { abortEarly: false });
  const stage = await assertRelationsForDeal(
    companyId,
    body.pipelineId,
    body.stageId,
    body.contactId ?? null,
    body.ticketId ?? null
  );

  if (body.assignedUserId != null) {
    const u = await User.findOne({
      where: { id: body.assignedUserId, companyId }
    });
    if (!u) throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const source = (body.source || "manual") as CrmDealSource;
  const status = dealStatusFromStage(stage);

  const deal = await CrmDeal.create({
    companyId,
    pipelineId: body.pipelineId,
    stageId: body.stageId,
    contactId: body.contactId ?? null,
    ticketId: body.ticketId ?? null,
    title: body.title.trim(),
    value: body.value == null ? null : body.value,
    status,
    source,
    expectedCloseAt: body.expectedCloseAt ?? null,
    notes: body.notes ?? null,
    createdBy: userId,
    assignedUserId: body.assignedUserId ?? null
  });

  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.status(201).json(full);
};

export const updateDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await CrmDeal.findOne({ where: { id, companyId } });
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);

  const schema = Yup.object({
    title: Yup.string().min(1).max(500).nullable(),
    pipelineId: Yup.number().integer().nullable(),
    stageId: Yup.number().integer().nullable(),
    contactId: Yup.number().integer().nullable(),
    ticketId: Yup.number().integer().nullable(),
    value: Yup.number().nullable(),
    assignedUserId: Yup.number().integer().nullable(),
    expectedCloseAt: Yup.date().nullable(),
    notes: Yup.string().nullable().max(65535),
    source: sourceSchema,
    status: Yup.string().oneOf(["open", "won", "lost"]).nullable()
  });

  const body = await schema.validate(req.body, { abortEarly: false });

  const nextPipelineId = body.pipelineId ?? deal.pipelineId;
  const nextStageId = body.stageId ?? deal.stageId;

  if (
    body.pipelineId != null &&
    body.pipelineId !== deal.pipelineId &&
    body.stageId == null
  ) {
    throw new AppError("ERR_CRM_STAGE_REQUIRED_ON_PIPELINE_CHANGE", 400);
  }

  const stage = await assertRelationsForDeal(
    companyId,
    nextPipelineId,
    nextStageId,
    body.contactId !== undefined ? body.contactId : deal.contactId,
    body.ticketId !== undefined ? body.ticketId : deal.ticketId
  );

  if (body.assignedUserId !== undefined && body.assignedUserId != null) {
    const u = await User.findOne({
      where: { id: body.assignedUserId, companyId }
    });
    if (!u) throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const patch: Record<string, unknown> = {};
  if (body.title != null) patch.title = body.title.trim();
  if (body.pipelineId != null) patch.pipelineId = body.pipelineId;
  if (body.stageId != null) patch.stageId = body.stageId;
  if (body.contactId !== undefined) patch.contactId = body.contactId;
  if (body.ticketId !== undefined) patch.ticketId = body.ticketId;
  if (body.value !== undefined) patch.value = body.value;
  if (body.expectedCloseAt !== undefined) patch.expectedCloseAt = body.expectedCloseAt;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.source != null) patch.source = body.source;
  if (body.assignedUserId !== undefined) patch.assignedUserId = body.assignedUserId;

  if (body.stageId != null || body.pipelineId != null) {
    patch.status = dealStatusFromStage(stage);
  } else if (body.status != null) {
    patch.status = body.status;
  }

  await deal.update(patch);
  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.json(full);
};

export const moveDealStage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const schema = Yup.object({ stageId: Yup.number().integer().required() });
  const { stageId } = await schema.validate(req.body);

  const deal = await CrmDeal.findOne({ where: { id, companyId } });
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);

  const stage = await CrmStage.findOne({ where: { id: stageId, companyId } });
  assertStageBelongsToPipeline(stage, deal.pipelineId, companyId);

  const status = dealStatusFromStage(stage as CrmStage);
  await deal.update({ stageId, status });
  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.json(full);
};

export const removeDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await CrmDeal.findOne({ where: { id, companyId } });
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);
  await deal.destroy();
  return res.status(204).send();
};
